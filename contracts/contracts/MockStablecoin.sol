// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title  MockStablecoin
/// @notice A 6-decimal ERC-20 that stands in for a USD stablecoin (e.g. USDQ) during local
///         tests and on Quai testnet, so the full checkout loop can be exercised before a
///         real stablecoin is confirmed live on Quai.
/// @dev    Has an open `mint` faucet — FOR TESTING/TESTNET ONLY, never deploy to mainnet.
contract MockStablecoin is ERC20 {
    constructor() ERC20("Mock USDQ", "mUSDQ") {}

    /// @notice USD stablecoins conventionally use 6 decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address. Open faucet for testing only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
