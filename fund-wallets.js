#!/usr/bin/env node

/**
 * Wallet Funding Script
 * Transfers ETH from main account to multiple derived wallets
 * 
 * Usage:
 *   RPC_URL=http://localhost:8545 PRIVATE_KEY=0x... node fund-wallets.js [options]
 * 
 * Options:
 *   --num-wallets=5    Number of wallets to create and fund
 *   --amount=1.0       ETH amount per wallet
 */

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';

const args = {
  numWallets: parseInt(process.argv.find(a => a.startsWith('--num-wallets='))?.split('=')[1] || '5'),
  amount: parseFloat(process.argv.find(a => a.startsWith('--amount='))?.split('=')[1] || '1.0'),
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('              Wallet Funding Utility                            ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Configuration:');
console.log(`   RPC URL:       ${RPC_URL}`);
console.log(`   Wallets to Fund: ${args.numWallets}`);
console.log(`   Amount per Wallet: ${args.amount} ETH`);
console.log(`   Total to Send: ${(args.numWallets * args.amount).toFixed(2)} ETH\n`);

// Generate deterministic wallets (same as load-test script)
function generateWallets(count, basePrivateKey) {
  const wallets = [];
  for (let i = 0; i < count; i++) {
    const derivedKey = ethers.keccak256(
      ethers.solidityPacked(['bytes', 'uint256'], [basePrivateKey, i])
    );
    try {
      const wallet = new ethers.Wallet(derivedKey);
      wallets.push(wallet);
    } catch (e) {
      console.error(`Failed to derive wallet ${i}:`, e.message);
    }
  }
  return wallets;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fundWallets() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log('🔗 Connecting to provider...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ${network.chainId}\n`);

    // Create signer from main private key
    const mainSigner = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`💰 Funding from: ${await mainSigner.getAddress()}\n`);

    // Check balance
    const mainBalance = await provider.getBalance(mainSigner.address);
    console.log(`   Main Account Balance: ${ethers.formatEther(mainBalance)} ETH`);
    
    const totalNeeded = ethers.parseEther((args.numWallets * args.amount).toString());
    if (mainBalance < totalNeeded) {
      console.error(`\n❌ Insufficient balance!`);
      console.error(`   Need: ${ethers.formatEther(totalNeeded)} ETH`);
      console.error(`   Have: ${ethers.formatEther(mainBalance)} ETH\n`);
      process.exit(1);
    }
    console.log(`   Will need: ${ethers.formatEther(totalNeeded)} ETH`);
    console.log(`   Sufficient! ✅\n`);

    // Generate wallets
    console.log(`👛 Generating ${args.numWallets} wallets...\n`);
    const wallets = generateWallets(args.numWallets, PRIVATE_KEY);
    const addresses = wallets.map((w, i) => ({ index: i, address: w.address }));

    // Display wallet list
    console.log('📅 Wallets to fund:');
    addresses.forEach(({ index, address }) => {
      console.log(`   [${index}] ${address}`);
    });
    console.log('');

    // Send transactions
    console.log(`📤 Sending ${args.amount} ETH to each wallet...\n`);
    const txHashes = [];
    const startTime = Date.now();

    for (let i = 0; i < addresses.length; i++) {
      try {
        const tx = await mainSigner.sendTransaction({
          to: addresses[i].address,
          value: ethers.parseEther(args.amount.toString()),
        });
        txHashes.push({ index: i, hash: tx.hash, address: addresses[i].address });
        console.log(`   [${i}] Sent to ${addresses[i].address.slice(0, 10)}... (${tx.hash.slice(0, 10)}...)`);
      } catch (err) {
        console.error(`   [${i}] ❌ Failed: ${err.message}`);
      }

      // Small delay between transactions
      if (i < addresses.length - 1) {
        await sleep(100);
      }
    }

    console.log(`\n✅ All transactions sent. Waiting for confirmations...\n`);

    // Monitor confirmations
    let confirmed = 0;
    let failed = 0;

    console.log('⏳ Confirmation Status:');
    for (const { index, hash, address } of txHashes) {
      try {
        const receipt = await provider.waitForTransaction(hash, 1, 60000); // 1 minute timeout
        if (receipt) {
          confirmed++;
          console.log(`   [${index}] ✅ Confirmed in block ${receipt.blockNumber}`);
        }
      } catch (err) {
        failed++;
        console.log(`   [${index}] ❌ Confirmation timeout`);
      }
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final report
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    🎉 FUNDING COMPLETE                        ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Summary:');
    console.log(`   Total Transactions: ${txHashes.length}`);
    console.log(`   Confirmed: ${confirmed}/${txHashes.length}`);
    console.log(`   Failed: ${failed}/${txHashes.length}`);
    console.log(`   Total Time: ${elapsedTime}s`);
    console.log(`   Total Funds Sent: ${ethers.formatEther(totalNeeded)} ETH\n`);

    console.log('✨ Wallets are now funded and ready for load testing!\n');
    console.log('Next steps:');
    console.log('   1. Run the load test:');
    console.log('   node load-test-eth-transfers.js --num-wallets=5 --num-txs=100\n');

  } catch (error) {
    console.error('❌ Funding failed:', error.message);
    process.exit(1);
  }
}

// Run funding
fundWallets().catch(console.error);
