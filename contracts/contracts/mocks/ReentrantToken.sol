// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPayWithQuaiToken {
    function payOrder(address merchant, bytes32 orderId) external;
}

/// @title  ReentrantToken
/// @notice Test-only ERC-20 whose `transferFrom` re-enters PayWithQuai.payOrder on the first
///         pull. Used to prove the ReentrancyGuard blocks re-entry through a malicious token.
contract ReentrantToken is ERC20 {
    IPayWithQuaiToken private _pay;
    address private _merchant;
    bytes32 private _orderId;
    bool private _armed;

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Arm the attack: the next transferFrom will attempt a re-entrant payOrder.
    function arm(address pay_, address merchant_, bytes32 orderId_) external {
        _pay = IPayWithQuaiToken(pay_);
        _merchant = merchant_;
        _orderId = orderId_;
        _armed = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (_armed) {
            _armed = false;
            _pay.payOrder(_merchant, _orderId); // re-enter — must be blocked by nonReentrant
        }
        return super.transferFrom(from, to, value);
    }
}
