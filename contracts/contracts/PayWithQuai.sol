// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/// @title  PayWithQuai
/// @notice Non-custodial merchant payment router for the "Pay with Quai" checkout system.
///         A merchant pre-registers an order (expected amount, payout token, optional expiry);
///         the customer then settles it in a single transaction. The contract verifies the
///         amount, withholds an optional platform fee, forwards the funds to the merchant,
///         marks the order settled (blocking double-fulfillment), and emits `PaymentReceived`
///         for the off-chain relayer to turn into a merchant webhook.
/// @dev    Funds never rest in the contract — every payment is forwarded within the same
///         transaction. Orders are keyed by (merchant, orderId) so a griefer cannot
///         front-register another merchant's order id. See docs §4 (Smart Contract Design).
///
///         Quai is sharded: value moves within a single zone. The merchant payout wallet and
///         `feeRecipient` MUST live in the same zone as this deployment (e.g. all Cyprus-1,
///         address prefix 0x00) — a plain transfer cannot pay an address in another zone.
///         Enforce this off-chain (backend/checkout) before registering an order.
///
///         UPGRADEABILITY: This is the *implementation* behind a UUPS (ERC-1967) proxy. All
///         mutable state lives in an ERC-7201 namespaced struct (`_s()`), and the base modules
///         (Ownable2Step, Pausable, ReentrancyGuard) each use their own namespaced slot, so a
///         future upgrade can append fields or add modules without ever colliding with existing
///         storage. When upgrading: NEVER remove or reorder fields in `MainStorage` — only
///         append. New modules should define their own `@custom:storage-location` namespace.
///         Upgrades are gated by `_authorizeUpgrade` (owner-only); in production the owner is a
///         TimelockController controlled by a multisig.
contract PayWithQuai is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    /// @notice Sentinel `token` value meaning the order is payable in native QUAI.
    address public constant NATIVE = address(0);

    /// @notice Hard cap on the platform fee (basis points). 500 = 5%. Owner cannot exceed it.
    uint96 public constant MAX_FEE_BPS = 500;

    /// @dev Basis-points denominator (100% = 10_000 bps).
    uint256 private constant BPS_DENOMINATOR = 10_000;

    // Fields are ordered so `merchant`, `settled`, `exists` and `feeBps` share one storage slot
    // (160 + 8 + 8 + 16 = 192 bits).
    struct Order {
        address merchant; // payout wallet (also the registrar)
        bool settled;     // flipped true on payment — blocks double-fulfillment
        bool exists;      // distinguishes a registered order from an empty slot
        uint16 feeBps;    // platform fee locked in at registration time (<= MAX_FEE_BPS)
        address token;    // ERC-20 token address, or NATIVE (address(0)) for native QUAI
        uint256 amount;   // exact expected amount, in the token's smallest unit
        uint256 expiry;   // unix time after which the order can no longer be paid; 0 = never
    }

    /// @custom:storage-location erc7201:paywithquai.main
    /// @dev All mutable state of the router. Append-only across upgrades — never remove/reorder.
    struct MainStorage {
        mapping(bytes32 => Order) orders;      // keyed by orderKey(merchant, orderId)
        mapping(address => bool) acceptedToken; // tokens orders may be priced in (0 = native QUAI)
        address feeRecipient;                   // receives the platform fee
        uint96 feeBps;                          // current platform fee in bps; always <= MAX_FEE_BPS
    }

    // keccak256(abi.encode(uint256(keccak256("paywithquai.main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION =
        0xddd96c3fdec0155659045c0e1367ee9451de8b2ed82190eab0e0e4385193f400;

    function _s() private pure returns (MainStorage storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }

    event OrderRegistered(
        address indexed merchant,
        bytes32 indexed orderId,
        address token,
        uint256 amount,
        uint256 expiry,
        uint16 feeBps
    );

    event OrderCancelled(address indexed merchant, bytes32 indexed orderId);

    /// @notice Emitted on successful settlement. Mirrors the structure the relayer expects (docs §4.3).
    ///         `token` is included so the relayer can act on the event without a follow-up read
    ///         (address(0) = native QUAI). `amount` is the gross figure the payer sent.
    event PaymentReceived(
        address indexed merchant,
        bytes32 indexed orderId,
        address payer,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted alongside PaymentReceived when a non-zero fee was withheld.
    event FeePaid(bytes32 indexed orderId, address token, uint256 fee, address feeRecipient);

    event FeeConfigUpdated(uint96 feeBps, address feeRecipient);
    event AcceptedTokenUpdated(address indexed token, bool accepted);

    /// @notice Emitted when the owner sweeps funds that were sent to the contract outside the
    ///         payment flow (stray ERC-20 transfers, or QUAI force-sent via selfdestruct).
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    error OrderAlreadyExists();
    error OrderNotFound();
    error OrderAlreadySettled();
    error OrderExpired();
    error InvalidExpiry();
    error ZeroAmount();
    error TokenNotAccepted();
    error WrongPaymentPath();
    error IncorrectNativeValue();
    error FeeTooHigh();
    error ZeroFeeRecipient();
    error ZeroAddress();
    error NativeTransferFailed();

    /// @dev Implementation contract is never initialized directly — only the proxy is. Locking
    ///      the implementation's initializers prevents a stray `initialize` on the logic contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Proxy initializer (replaces the constructor). Callable exactly once, on the proxy.
    /// @param feeRecipient_ address to receive platform fees (must be non-zero)
    /// @param feeBps_       initial platform fee in basis points (must be <= MAX_FEE_BPS)
    /// @param owner_        initial owner (admin key; hand this to a timelock+multisig in prod)
    function initialize(address feeRecipient_, uint96 feeBps_, address owner_) external initializer {
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        _setFeeConfig(feeBps_, feeRecipient_);
    }

    // --------------------------------------------------------------------- //
    //                               Views                                   //
    // --------------------------------------------------------------------- //

    /// @notice Address that receives the platform fee.
    function feeRecipient() external view returns (address) {
        return _s().feeRecipient;
    }

    /// @notice Platform fee in basis points (1 bps = 0.01%). Always <= MAX_FEE_BPS.
    function feeBps() external view returns (uint96) {
        return _s().feeBps;
    }

    /// @notice Deterministic storage key binding an order id to its merchant.
    function orderKey(address merchant, bytes32 orderId) public pure returns (bytes32) {
        return keccak256(abi.encode(merchant, orderId));
    }

    /// @notice Returns the full order record for (merchant, orderId).
    function getOrder(address merchant, bytes32 orderId) external view returns (Order memory) {
        return _s().orders[orderKey(merchant, orderId)];
    }

    /// @notice True once an order has been paid.
    function isSettled(address merchant, bytes32 orderId) external view returns (bool) {
        return _s().orders[orderKey(merchant, orderId)].settled;
    }

    /// @notice True if orders may be priced in `token` (address(0) = native QUAI).
    function isTokenAccepted(address token) external view returns (bool) {
        return _s().acceptedToken[token];
    }

    // --------------------------------------------------------------------- //
    //                      Merchant: order lifecycle                        //
    // --------------------------------------------------------------------- //

    /// @notice Merchant pre-registers an order it expects a customer to pay.
    /// @dev    `msg.sender` is recorded as both the merchant identity and the payout wallet,
    ///         which is what makes the (merchant, orderId) key unforgeable by third parties.
    /// @param orderId unique id generated by the merchant backend
    /// @param token   ERC-20 token to be paid, or NATIVE (address(0)) for native QUAI; must be accepted
    /// @param amount  exact amount owed, in the token's smallest unit (must be non-zero)
    /// @param expiry  unix time after which the order can no longer be paid; 0 = never expires
    function registerOrder(
        bytes32 orderId,
        address token,
        uint256 amount,
        uint256 expiry
    ) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        MainStorage storage $ = _s();
        if (!$.acceptedToken[token]) revert TokenNotAccepted();
        if (expiry != 0 && expiry <= block.timestamp) revert InvalidExpiry();

        bytes32 key = orderKey(msg.sender, orderId);
        if ($.orders[key].exists) revert OrderAlreadyExists();

        // Lock the current fee into the order. `feeBps` is always <= MAX_FEE_BPS (500), so the
        // uint96 -> uint16 narrowing cannot truncate. This fixes the merchant's net proceeds at
        // registration time — a later setFeeConfig cannot retroactively change this order.
        uint16 lockedFeeBps = uint16($.feeBps);

        $.orders[key] = Order({
            merchant: msg.sender,
            settled: false,
            exists: true,
            feeBps: lockedFeeBps,
            token: token,
            amount: amount,
            expiry: expiry
        });
        emit OrderRegistered(msg.sender, orderId, token, amount, expiry, lockedFeeBps);
    }

    /// @notice Merchant cancels its own unpaid order, freeing the order id for reuse.
    /// @dev    Allowed even while paused so merchants can always clean up reservations.
    function cancelOrder(bytes32 orderId) external {
        bytes32 key = orderKey(msg.sender, orderId);
        Order storage o = _s().orders[key];
        if (!o.exists) revert OrderNotFound();
        if (o.settled) revert OrderAlreadySettled();
        delete _s().orders[key];
        emit OrderCancelled(msg.sender, orderId);
    }

    // --------------------------------------------------------------------- //
    //                          Customer: payment                            //
    // --------------------------------------------------------------------- //

    /// @notice Settle an ERC-20 order. Caller must first `approve` this contract for `amount`.
    /// @dev    Checks -> effects (mark settled) -> interactions (pull & forward funds).
    function payOrder(address merchant, bytes32 orderId) external nonReentrant whenNotPaused {
        MainStorage storage $ = _s();
        Order storage o = $.orders[orderKey(merchant, orderId)];
        _requireOpenOrder(o);
        if (o.token == NATIVE) revert WrongPaymentPath();

        o.settled = true; // effects before interactions

        uint256 amount = o.amount;
        address token = o.token;
        uint256 fee = (amount * o.feeBps) / BPS_DENOMINATOR; // fee locked at registration
        address feeRecipient_ = $.feeRecipient;

        if (fee > 0) {
            IERC20(token).safeTransferFrom(msg.sender, feeRecipient_, fee);
            emit FeePaid(orderId, token, fee, feeRecipient_);
        }
        IERC20(token).safeTransferFrom(msg.sender, o.merchant, amount - fee);

        emit PaymentReceived(o.merchant, orderId, msg.sender, token, amount, block.timestamp);
    }

    /// @notice Settle a native-QUAI order. `msg.value` must equal the registered amount exactly.
    function payOrderNative(address merchant, bytes32 orderId) external payable nonReentrant whenNotPaused {
        MainStorage storage $ = _s();
        Order storage o = $.orders[orderKey(merchant, orderId)];
        _requireOpenOrder(o);
        if (o.token != NATIVE) revert WrongPaymentPath();
        if (msg.value != o.amount) revert IncorrectNativeValue();

        o.settled = true; // effects before interactions

        uint256 amount = o.amount;
        uint256 fee = (amount * o.feeBps) / BPS_DENOMINATOR; // fee locked at registration

        if (fee > 0) {
            _sendNative($.feeRecipient, fee);
            emit FeePaid(orderId, NATIVE, fee, $.feeRecipient);
        }
        _sendNative(o.merchant, amount - fee);

        emit PaymentReceived(o.merchant, orderId, msg.sender, NATIVE, amount, block.timestamp);
    }

    /// @dev Requires an order to exist, be unpaid, and be unexpired. Pure check, no state change.
    function _requireOpenOrder(Order storage o) private view {
        if (!o.exists) revert OrderNotFound();
        if (o.settled) revert OrderAlreadySettled();
        if (o.expiry != 0 && block.timestamp > o.expiry) revert OrderExpired();
    }

    function _sendNative(address to, uint256 value) private {
        (bool ok, ) = payable(to).call{value: value}("");
        if (!ok) revert NativeTransferFailed();
    }

    // --------------------------------------------------------------------- //
    //                               Admin                                   //
    // --------------------------------------------------------------------- //

    /// @notice Allow or disallow pricing orders in `token` (address(0) = native QUAI).
    function setTokenAccepted(address token, bool accepted) external onlyOwner {
        _s().acceptedToken[token] = accepted;
        emit AcceptedTokenUpdated(token, accepted);
    }

    /// @notice Update the platform fee and recipient. Fee is capped at MAX_FEE_BPS.
    /// @dev    Only affects orders registered *after* this call — existing orders keep the fee
    ///         they locked in at registration. `feeRecipient_` receives native QUAI on the
    ///         native path via a plain `.call`, so it MUST be an EOA or a contract that accepts
    ///         value without reverting; a reverting recipient would block every native payment.
    function setFeeConfig(uint96 feeBps_, address feeRecipient_) external onlyOwner {
        _setFeeConfig(feeBps_, feeRecipient_);
    }

    /// @notice Sweep funds that reached the contract outside the payment flow. The router never
    ///         holds funds during normal operation (payments are forwarded in the same tx), so a
    ///         non-zero balance can only come from a stray ERC-20 `transfer` or QUAI force-sent
    ///         via `selfdestruct`. This lets the owner recover them instead of stranding them.
    /// @dev    `token == NATIVE` (address(0)) sweeps native QUAI; otherwise it sweeps the ERC-20.
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (token == NATIVE) {
            _sendNative(to, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit TokensRescued(token, to, amount);
    }

    /// @notice Pause new registrations and payments (circuit breaker).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume after a pause.
    function unpause() external onlyOwner {
        _unpause();
    }

    function _setFeeConfig(uint96 feeBps_, address feeRecipient_) private {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (feeRecipient_ == address(0)) revert ZeroFeeRecipient();
        MainStorage storage $ = _s();
        $.feeBps = feeBps_;
        $.feeRecipient = feeRecipient_;
        emit FeeConfigUpdated(feeBps_, feeRecipient_);
    }

    /// @dev UUPS upgrade authorization. Only the owner (a timelock+multisig in prod) may upgrade.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev Reject stray native transfers — payments must go through payOrderNative.
    receive() external payable {
        revert("PayWithQuai: use payOrderNative");
    }
}
