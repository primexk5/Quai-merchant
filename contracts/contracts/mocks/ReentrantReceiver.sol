// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IPayWithQuaiNative {
    function registerOrder(bytes32 orderId, address token, uint256 amount, uint256 expiry) external;
    function payOrderNative(address merchant, bytes32 orderId) external payable;
}

/// @title  ReentrantReceiver
/// @notice Test-only malicious merchant that tries to re-enter payOrderNative from its
///         `receive` hook when it is paid. Used to prove the ReentrancyGuard holds — the
///         re-entry must cause the whole payment to revert (funds stay safe).
contract ReentrantReceiver {
    IPayWithQuaiNative public immutable target;
    bytes32 public orderId;

    constructor(address target_) {
        target = IPayWithQuaiNative(target_);
    }

    /// @notice Register a native order with this contract as the merchant/payout wallet.
    function register(bytes32 orderId_, uint256 amount) external {
        orderId = orderId_;
        target.registerOrder(orderId_, address(0), amount, 0);
    }

    /// @dev Attempt to re-enter on receiving the payout. Guard should make this revert.
    receive() external payable {
        target.payOrderNative(address(this), orderId);
    }
}
