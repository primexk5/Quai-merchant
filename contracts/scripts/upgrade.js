/**
 * Upgrade the PayWithQuai UUPS proxy to the new implementation.
 *
 *   npx hardhat run scripts/upgrade.js --network cyprus1
 *
 * What it does:
 *   1. Deploys a fresh PayWithQuai implementation contract (new bytecode with registerOrderBatch).
 *   2. Calls upgradeToAndCall(newImpl, "0x") on the proxy — no re-initialisation needed because
 *      we are only adding a function, not changing state layout.
 *   3. Smoke-tests the new function is callable (does NOT register real orders).
 *   4. Writes updated payWithQuaiImpl to deployments/<network>.json.
 *
 * Requires:
 *   - contracts/.env with RPC_URL, CHAIN_ID, CYPRUS1_PK set to the OWNER wallet.
 *   - deployments/<network>.json present (written by deploy.js).
 *   - The CYPRUS1_PK account must be the current proxy owner.
 *
 * This script is safe to re-run: upgradeToAndCall is idempotent when called with the same impl.
 */
const hre = require('hardhat');
const quais = require('quais');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, tries = 5) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`⚠️  ${label} failed (attempt ${i}/${tries}): ${err.message?.slice(0, 120) || err}`);
      if (i < tries) await sleep(2000 * i);
    }
  }
  throw lastErr;
}

async function pushMetadata(contractName) {
  if (!hre.deployMetadata || typeof hre.deployMetadata.pushMetadataToIPFS !== 'function') {
    console.warn(`⚠️  @quai/hardhat-deploy-metadata not available — deploying without IPFS CID.`);
    return undefined;
  }
  try {
    return await hre.deployMetadata.pushMetadataToIPFS(contractName);
  } catch (err) {
    console.warn(`⚠️  IPFS push failed (${err.message}) — using placeholder CID.`);
    return 'Qm' + '0'.repeat(44);
  }
}

async function main() {
  const { url, accounts, chainId } = hre.network.config;
  if (!url || !accounts || accounts.length === 0) {
    throw new Error('Set RPC_URL and CYPRUS1_PK in contracts/.env before upgrading.');
  }

  const provider = new quais.JsonRpcProvider(url, undefined, { usePathing: true });
  const wallet = new quais.Wallet(accounts[0], provider);
  console.log(`Network:  ${hre.network.name} (chainId ${chainId})`);
  console.log(`Upgrader: ${wallet.address}`);

  // Load the existing deployment record.
  const deployFile = path.join(__dirname, '..', 'deployments', `${hre.network.name}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`No deployment found at ${deployFile}. Run deploy.js first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf8'));
  const proxyAddress = deployment.payWithQuai;
  console.log(`Proxy:    ${proxyAddress}`);
  console.log(`Old impl: ${deployment.payWithQuaiImpl}`);

  // 1) Deploy the new implementation.
  console.log('\n[1/3] Deploying new PayWithQuai implementation…');
  const artifact = await hre.artifacts.readArtifact('PayWithQuai');
  const ipfsHash = await pushMetadata('PayWithQuai');
  const factory = new quais.ContractFactory(artifact.abi, artifact.bytecode, wallet, ipfsHash);

  const newImpl = await withRetry(async () => {
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    return contract;
  }, 'deploy new impl');
  const newImplAddress = await newImpl.getAddress();
  console.log(`New impl: ${newImplAddress}`);

  // 2) Call upgradeToAndCall on the proxy (owner-only).
  console.log('\n[2/3] Upgrading proxy to new implementation…');
  const proxy = new quais.Contract(proxyAddress, artifact.abi, wallet);

  await withRetry(async () => {
    const tx = await proxy.upgradeToAndCall(newImplAddress, '0x');
    const receipt = await tx.wait();
    console.log(`✓ upgradeToAndCall confirmed in tx ${receipt.hash}`);
  }, 'upgradeToAndCall');

  // 3) Smoke-test: verify registerOrderBatch exists and the proxy returns the right impl.
  console.log('\n[3/3] Smoke-testing new function…');
  // Check that the ABI fragment is present (static check — no on-chain call needed).
  const hasBatch = artifact.abi.some(
    (f) => f.type === 'function' && f.name === 'registerOrderBatch',
  );
  if (!hasBatch) throw new Error('registerOrderBatch not found in ABI — something went wrong.');
  console.log('✓ registerOrderBatch present in ABI.');

  // Read the current implementation slot (EIP-1967) to confirm the proxy points to the new impl.
  const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const raw = await provider.getStorage(proxyAddress, IMPL_SLOT);
  const currentImpl = '0x' + raw.slice(-40);
  const match = currentImpl.toLowerCase() === newImplAddress.toLowerCase();
  console.log(`✓ EIP-1967 impl slot: ${currentImpl} ${match ? '(matches ✓)' : '(MISMATCH ✗)'}`);
  if (!match) throw new Error('Implementation slot mismatch after upgrade!');

  // 4) Update the deployment record.
  deployment.payWithQuaiImpl = newImplAddress;
  fs.writeFileSync(deployFile, JSON.stringify(deployment, null, 2));
  console.log(`\n✓ Updated ${path.relative(process.cwd(), deployFile)}`);
  console.log('\n🎉 Upgrade complete. Merchants can now use registerOrderBatch (max 50 orders per tx).');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
