// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title  SelfDestructor
/// @notice TEST-ONLY helper that force-sends native QUAI to a target via `selfdestruct`,
///         bypassing PayWithQuai's reverting `receive()`. Used to fund the `rescueTokens` native
///         sweep test (a forced send is the only way native QUAI can reach the router).
contract SelfDestructor {
    constructor() payable {}

    function destroy(address payable target) external {
        selfdestruct(target);
    }
}