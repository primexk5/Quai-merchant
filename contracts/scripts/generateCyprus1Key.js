/**
 * Generate a fresh Quai wallet in the Cyprus-1 zone (address prefix 0x00).
 *
 *   node scripts/generateCyprus1Key.js
 *
 * Quai encodes the zone in the first byte of the address, so a random key has a
 * ~1/256 chance of landing in a given zone. This loops until one matches.
 * Put the printed CYPRUS1_PK into contracts/.env and fund the address from the
 * Quai faucet. NEVER commit this file's output or the key.
 */
const quais = require('quais');
const crypto = require('crypto');

const MAX_TRIES = 100000;
for (let i = 0; i < MAX_TRIES; i++) {
  const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
  const wallet = new quais.Wallet(privateKey);
  if (wallet.address.startsWith('0x00')) {
    console.log(`Found Cyprus-1 address after ${i + 1} tries:`);
    console.log(`  CYPRUS1_PK=${privateKey}`);
    console.log(`  address  =${wallet.address}`);
    console.log(`  zone     =${quais.getZoneForAddress(wallet.address)}`);
    console.log('\nFund this address from the Quai Orchard faucet, then set CYPRUS1_PK in contracts/.env');
    process.exit(0);
  }
}
console.error(`No Cyprus-1 address found in ${MAX_TRIES} tries — run again.`);
process.exit(1);