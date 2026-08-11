/**
 * Deploy PayWithQuai (and, on testnet, a MockStablecoin) to a Quai zone using the quais SDK.
 *
 *   npx hardhat run scripts/deploy.js --network cyprus1
 *
 * Requires contracts/.env (see .env.dist): RPC_URL, CHAIN_ID, CYPRUS1_PK, and optionally
 * FEE_RECIPIENT / FEE_BPS. Writes the resulting addresses to deployments/<network>.json.
 *
 * Note: the Hardhat console/ethers cannot talk to Quai, so deployment goes through the quais
 * SDK. The ContractFactory takes a 4th arg — an IPFS metadata CID — which Quaiscan uses to
 * verify source. We push that metadata via the @quai/hardhat-deploy-metadata plugin.
 */
const hre = require('hardhat');
const quais = require('quais');
const fs = require('fs');
const path = require('path');

const MAINNET_CHAIN_ID = 9;

async function pushMetadata(contractName) {
  if (!hre.deployMetadata || typeof hre.deployMetadata.pushMetadataToIPFS !== 'function') {
    console.warn(
      `⚠️  @quai/hardhat-deploy-metadata not available — deploying ${contractName} without an ` +
        `IPFS CID. The contract will work but cannot be source-verified on Quaiscan.`,
    );
    return undefined;
  }
  return hre.deployMetadata.pushMetadataToIPFS(contractName);
}

async function deployContract(name, args, wallet) {
  const artifact = await hre.artifacts.readArtifact(name);
  const ipfsHash = await pushMetadata(name);
  const factory = new quais.ContractFactory(artifact.abi, artifact.bytecode, wallet, ipfsHash);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return { contract, address: await contract.getAddress() };
}

async function main() {
  const { url, accounts, chainId } = hre.network.config;
  if (!url || !accounts || accounts.length === 0) {
    throw new Error('Set RPC_URL and CYPRUS1_PK in contracts/.env before deploying.');
  }

  const provider = new quais.JsonRpcProvider(url, undefined, { usePathing: true });
  const wallet = new quais.Wallet(accounts[0], provider);
  console.log(`Network:  ${hre.network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${wallet.address}`);

  const feeRecipient = process.env.FEE_RECIPIENT || wallet.address;
  const feeBps = process.env.FEE_BPS || '0';

  // MockStablecoin is a testnet convenience — never deploy the open-mint faucet to mainnet.
  let mockAddress;
  if (chainId !== MAINNET_CHAIN_ID) {
    const mock = await deployContract('MockStablecoin', [], wallet);
    mockAddress = mock.address;
    console.log(`MockStablecoin: ${mockAddress}`);
  } else {
    console.log('Skipping MockStablecoin on mainnet — use a real stablecoin address.');
  }

  const pay = await deployContract('PayWithQuai', [feeRecipient, feeBps], wallet);
  console.log(`PayWithQuai:    ${pay.address}`);

  // Allowlist the settlement assets merchants may price orders in.
  const ZERO = '0x0000000000000000000000000000000000000000';
  await (await pay.contract.setTokenAccepted(ZERO, true)).wait();
  console.log('Accepted asset: native QUAI');
  if (mockAddress) {
    await (await pay.contract.setTokenAccepted(mockAddress, true)).wait();
    console.log(`Accepted asset: ${mockAddress} (mUSDQ)`);
  }
  if (process.env.STABLECOIN_ADDR) {
    await (await pay.contract.setTokenAccepted(process.env.STABLECOIN_ADDR, true)).wait();
    console.log(`Accepted asset: ${process.env.STABLECOIN_ADDR} (STABLECOIN_ADDR)`);
  }

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const record = {
    network: hre.network.name,
    chainId,
    payWithQuai: pay.address,
    mockStablecoin: mockAddress ?? null,
    feeRecipient,
    feeBps: String(feeBps),
    deployer: wallet.address,
  };
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
  console.log(`\nWrote ${path.relative(process.cwd(), outFile)}`);
  console.log('The relayer and checkout SDK read PayWithQuai from this file.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
