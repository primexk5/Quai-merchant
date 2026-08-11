// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// This file exists only so Hardhat compiles these OpenZeppelin contracts into local artifacts,
// which the deploy script loads by name (via hre.artifacts.readArtifact) and deploys through the
// quais SDK. Nothing imports this file at runtime.
//
//  - ERC1967Proxy:       the UUPS proxy that sits in front of PayWithQuai and holds all state.
//  - TimelockController: the upgrade-governance owner (proposers/executors = the merchant multisig).

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
