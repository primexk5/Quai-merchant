// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @title  PayWithQuai
/// @notice Non-custodial merchant payment router for the "Pay with Quai" checkout system.
///         Merchants pre-register orders; customers settle them in a single transaction. Funds
///         are forwarded immediately, and orders are marked settled to block double-fulfillment.
/// @dev    UUPS implementation behind an ERC-1967 proxy. State lives in an ERC-7201 namespaced
///         struct (`_s()`); it is append-only across upgrades — never remove or reorder fields.
///         Quai is sharded: payout wallets must be in the same zone as this deployment.
contract PayWithQuai is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Sentinel token value: the order is payable in native QUAI.
    address public constant NATIVE = address(0);

    /// @notice Maximum platform fee in basis points (500 = 5%).
    uint96 public constant MAX_FEE_BPS = 500;

    /// @notice Delay before a settled order may be purged, giving the relayer time to index it.
    uint256 public constant PURGE_DELAY = 1 days;

    /// @dev Basis-points denominator (100% = 10_000 bps).
    uint256 private constant BPS_DENOMINATOR = 10_000;

    // merchant(160) + settled(8) + exists(8) + feeBps(16) = 192 bits, packed in one slot.
    struct Order {
        address merchant;     // payout wallet (also the registrar)
        bool settled;         // set on payment — blocks double-fulfillment
        bool exists;          // distinguishes a registered order from an empty slot
        uint16 feeBps;        // fee locked in at registration time
        address token;        // ERC-20 address, or NATIVE for native QUAI
        uint256 amount;       // exact expected amount, in the token's smallest unit
        uint256 expiry;       // unix time after which the order can't be paid; 0 = never
        address feeRecipient; // fee destination, locked in at registration time
        uint256 settledAt;    // unix time the order was paid; 0 while unpaid
    }

    /// @custom:storage-location erc7201:paywithquai.main
    /// @dev All mutable state. Append-only across upgrades — never remove/reorder.
    struct MainStorage {
        mapping(bytes32 => Order) orders;       // keyed by orderKey(merchant, orderId)
        mapping(address => bool) acceptedToken; // tokens orders may be priced in
        address feeRecipient;                   // receives the platform fee
        uint96 feeBps;                          // current platform fee in bps
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
        uint16 feeBps,
        address feeRecipient
    );

    event OrderCancelled(address indexed merchant, bytes32 indexed orderId);

    /// @notice Emitted when a settled order is purged after the safety window; the id is reusable.
    event OrderPurged(address indexed merchant, bytes32 indexed orderId);

    /// @notice Emitted on successful settlement. `token` is address(0) for native QUAI;
    ///         `amount` is the gross figure the payer sent.
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

    /// @notice Emitted when the owner sweeps stray funds from the contract.
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    error OrderAlreadyExists();
    error OrderNotFound();
    error OrderAlreadySettled();
    error OrderNotSettled();
    error OrderExpired();
    error PurgeDelayNotElapsed();
    error InvalidExpiry();
    error ZeroAmount();
    error TokenNotAccepted();
    error WrongPaymentPath();
    error IncorrectNativeValue();
    error FeeTooHigh();
    error ZeroFeeRecipient();
    error ZeroAddress();
    error NativeTransferFailed();
    error ReceiveRejected();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param feeRecipient_ address to receive platform fees (must be non-zero)
    /// @param feeBps_       initial platform fee in basis points (must be <= MAX_FEE_BPS)
    /// @param owner_        initial owner
    function initialize(address feeRecipient_, uint96 feeBps_, address owner_) external initializer {
        __Ownable_init(owner_);
        __Ownable2Step_init();
        __Pausable_init();
        __ReentrancyGuard_init();
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

    /// @notice Platform fee in basis points (1 bps = 0.01%).
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
    /// @dev    `msg.sender` is recorded as merchant and payout wallet, making the
    ///         (merchant, orderId) key unforgeable by third parties.
    /// @param orderId unique id generated by the merchant backend
    /// @param token   ERC-20 token, or NATIVE for native QUAI; must be accepted
    /// @param amount  exact amount owed, in the token's smallest unit
    /// @param expiry  unix time after which the order can't be paid; 0 = never
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

        // Lock fee rate and recipient at registration. feeBps is always <= MAX_FEE_BPS (500),
        // so the uint96 -> uint16 narrowing cannot truncate; a later setFeeConfig can't
        // retroactively change this order.
        uint16 lockedFeeBps = uint16($.feeBps);
        address lockedFeeRecipient = $.feeRecipient; // guaranteed non-zero by _setFeeConfig

        $.orders[key] = Order({
            merchant: msg.sender,
            settled: false,
            exists: true,
            feeBps: lockedFeeBps,
            token: token,
            amount: amount,
            expiry: expiry,
            feeRecipient: lockedFeeRecipient,
            settledAt: 0
        });
        emit OrderRegistered(msg.sender, orderId, token, amount, expiry, lockedFeeBps, lockedFeeRecipient);
    }

    /// @notice Merchant cancels its own unpaid order, freeing the order id for reuse.
    /// @dev    Allowed while paused so merchants can always clean up reservations.
    function cancelOrder(bytes32 orderId) external {
        bytes32 key = orderKey(msg.sender, orderId);
        Order storage o = _s().orders[key];
        if (!o.exists) revert OrderNotFound();
        if (o.settled) revert OrderAlreadySettled();
        delete _s().orders[key];
        emit OrderCancelled(msg.sender, orderId);
    }

    /// @notice Merchant frees the storage of a paid order after PURGE_DELAY; the id is reusable.
    function purgeSettledOrder(bytes32 orderId) external {
        bytes32 key = orderKey(msg.sender, orderId);
        Order storage o = _s().orders[key];
        if (!o.exists) revert OrderNotFound();
        if (!o.settled) revert OrderNotSettled();
        if (block.timestamp < o.settledAt + PURGE_DELAY) revert PurgeDelayNotElapsed();
        delete _s().orders[key];
        emit OrderPurged(msg.sender, orderId);
    }

    // --------------------------------------------------------------------- //
    //                          Customer: payment                            //
    // --------------------------------------------------------------------- //

    /// @notice Settle an ERC-20 order. Caller must first approve this contract for `amount`.
    /// @dev    Checks -> effects (mark settled) -> interactions (pull & forward funds).
    function payOrder(address merchant, bytes32 orderId) external nonReentrant whenNotPaused {
        MainStorage storage $ = _s();
        Order storage o = $.orders[orderKey(merchant, orderId)];
        if (!o.exists) revert OrderNotFound();
        if (o.token == NATIVE) revert WrongPaymentPath();
        _requireOpenOrder(o);

        o.settled = true; // effects before interactions
        o.settledAt = block.timestamp;

        uint256 amount = o.amount;
        address token = o.token;
        uint256 fee = (amount * o.feeBps) / BPS_DENOMINATOR;

        if (fee > 0) {
            IERC20(token).safeTransferFrom(msg.sender, o.feeRecipient, fee);
            emit FeePaid(orderId, token, fee, o.feeRecipient);
        }
        IERC20(token).safeTransferFrom(msg.sender, o.merchant, amount - fee);

        emit PaymentReceived(o.merchant, orderId, msg.sender, token, amount, block.timestamp);
    }

    /// @notice Settle a native-QUAI order. `msg.value` must equal the registered amount exactly.
    function payOrderNative(address merchant, bytes32 orderId) external payable nonReentrant whenNotPaused {
        MainStorage storage $ = _s();
        Order storage o = $.orders[orderKey(merchant, orderId)];
        if (!o.exists) revert OrderNotFound();
        if (o.token != NATIVE) revert WrongPaymentPath();
        _requireOpenOrder(o);
        if (msg.value != o.amount) revert IncorrectNativeValue();

        o.settled = true; // effects before interactions
        o.settledAt = block.timestamp;

        uint256 amount = o.amount;
        uint256 fee = (amount * o.feeBps) / BPS_DENOMINATOR;

        if (fee > 0) {
            _sendNative(o.feeRecipient, fee);
            emit FeePaid(orderId, NATIVE, fee, o.feeRecipient);
        }
        _sendNative(o.merchant, amount - fee);

        emit PaymentReceived(o.merchant, orderId, msg.sender, NATIVE, amount, block.timestamp);
    }

    /// @dev Requires the order to be unpaid and unexpired. Pure check, no state change.
    function _requireOpenOrder(Order storage o) private view {
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
    /// @dev    Only allowlist standard, well-behaved ERC-20s: fee-on-transfer or rebasing tokens
    ///         would under-deliver to the merchant. Disabling a token blocks new registrations
    ///         only — existing orders remain payable; use `pause()` to halt settlement.
    function setTokenAccepted(address token, bool accepted) external onlyOwner {
        _s().acceptedToken[token] = accepted;
        emit AcceptedTokenUpdated(token, accepted);
    }

    /// @notice Update the platform fee and recipient. Fee is capped at MAX_FEE_BPS.
    /// @dev    Only affects orders registered after this call. `feeRecipient_` must accept
    ///         native QUAI without reverting, or it would block every native payment.
    function setFeeConfig(uint96 feeBps_, address feeRecipient_) external onlyOwner {
        _setFeeConfig(feeBps_, feeRecipient_);
    }

    /// @notice Sweep funds that reached the contract outside the payment flow.
    /// @dev    `token == NATIVE` (address(0)) sweeps native QUAI; otherwise the ERC-20.
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

    /// @dev UUPS upgrade authorization, owner-only.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @dev Reject stray native transfers — payments must go through payOrderNative.
    receive() external payable {
        revert ReceiveRejected();
    }
}