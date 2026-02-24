#!/usr/bin/env node

/**
 * EVM Chain Load Testing Script
 * Benchmarks TPS (transactions per second) via ETH transfers
 * 
 * Usage:
 *   RPC_URL=http://localhost:8545 PRIVATE_KEY=0x... node load-test-eth-transfers.js [options]
 * 
 * Options:
 *   --num-wallets=10       Number of concurrent wallets
 *   --num-txs=100          Total transactions to send per wallet
 *   --batch-size=10        Transactions to send per batch
 *   --delay=100            Delay between batches in ms
 *   --amount=0.1           ETH amount per transfer
 */

const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';

// Parse command line arguments
const args = {
  numWallets: parseInt(process.argv.find(a => a.startsWith('--num-wallets='))?.split('=')[1] || '5'),
  numTxs: parseInt(process.argv.find(a => a.startsWith('--num-txs='))?.split('=')[1] || '50'),
  batchSize: parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '5'),
  delay: parseInt(process.argv.find(a => a.startsWith('--delay='))?.split('=')[1] || '100'),
  amount: parseFloat(process.argv.find(a => a.startsWith('--amount='))?.split('=')[1] || '0.01'),
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('           EVM Chain Load Testing - ETH Transfer Benchmark      ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Test Configuration:');
console.log(`   RPC URL:           ${RPC_URL}`);
console.log(`   Concurrent Wallets: ${args.numWallets}`);
console.log(`   Txs per Wallet:    ${args.numTxs}`);
console.log(`   Batch Size:        ${args.batchSize}`);
console.log(`   Delay Between Batches: ${args.delay}ms`);
console.log(`   Amount per Transfer: ${args.amount} ETH`);
console.log(`   Total Expected Txs: ${args.numWallets * args.numTxs}\n`);

// Generate deterministic wallets from the same seed
function generateWallets(count, basePrivateKey) {
  const baseWallet = new ethers.Wallet(basePrivateKey);
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

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format seconds to human readable
function formatTime(seconds) {
  if (seconds < 1) return `${(seconds * 1000).toFixed(2)}ms`;
  return `${seconds.toFixed(2)}s`;
}

async function runLoadTest() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Test connectivity
    console.log('🔗 Connecting to provider...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ${network.chainId}\n`);

    // Generate wallets
    console.log(`👛 Generating ${args.numWallets} wallets...`);
    const wallets = generateWallets(args.numWallets, PRIVATE_KEY);
    const addresses = wallets.map(w => w.address);
    console.log(`✅ Generated wallets:\n   ${addresses.join('\n   ')}\n`);

    // Check balances
    console.log('💰 Checking wallet balances...');
    const signers = wallets.map(w => w.connect(provider));
    const balances = await Promise.all(
      signers.map((s, i) => provider.getBalance(s.address).then(b => ({ i, addr: s.address, balance: b })))
    );

    let totalBalance = 0n;
    balances.forEach(({ i, addr, balance }) => {
      const balanceEther = ethers.formatEther(balance);
      console.log(`   Wallet ${i}: ${balanceEther} ETH`);
      totalBalance += balance;
    });
    console.log(`   Total Balance: ${ethers.formatEther(totalBalance)} ETH\n`);

    // Validate sufficient balance
    const totalCost = BigInt(args.numWallets) * BigInt(args.numTxs) * ethers.parseEther(args.amount.toString());
    if (totalBalance < totalCost) {
      console.error(`❌ Insufficient balance. Need ${ethers.formatEther(totalCost)} ETH, have ${ethers.formatEther(totalBalance)} ETH\n`);
      return;
    }

    // Send transactions
    console.log('📤 Sending transactions...\n');
    const startTime = Date.now();
    const txHashes = [];
    let txCount = 0;

    for (let batch = 0; batch < args.numTxs; batch += args.batchSize) {
      const batchStartTime = Date.now();

      // Send batch in parallel
      const batchPromises = [];
      for (let w = 0; w < args.numWallets; w++) {
        for (let t = batch; t < Math.min(batch + args.batchSize, args.numTxs); t++) {
          // Rotate recipient through all wallets
          const recipientIdx = (w + t + 1) % args.numWallets;
          const recipientAddr = addresses[recipientIdx];

          const promise = (async () => {
            try {
              const tx = await signers[w].sendTransaction({
                to: recipientAddr,
                value: ethers.parseEther(args.amount.toString()),
                gasPrice: ethers.parseUnits('50', 'gwei'), // 50 gwei minimum
              });
              txHashes.push(tx.hash);
              txCount++;
              return { hash: tx.hash, wallet: w, status: 'sent', error: null };
            } catch (err) {
              return { wallet: w, status: 'failed', error: err.message };
            }
          })();

          batchPromises.push(promise);
        }
      }

      const batchResults = await Promise.all(batchPromises);
      const successCount = batchResults.filter(r => r.status === 'sent').length;
      const failureCount = batchResults.filter(r => r.status === 'failed').length;

      const batchTime = (Date.now() - batchStartTime) / 1000;
      console.log(`   Batch ${Math.floor(batch / args.batchSize) + 1}: ${successCount} sent, ${failureCount} failed (${formatTime(batchTime)})`);

      if (failureCount > 0) {
        batchResults.filter(r => r.status === 'failed').forEach(r => {
          console.log(`      ❌ Wallet ${r.wallet}: ${r.error}`);
        });
      }

      // Delay before next batch
      if (batch + args.batchSize < args.numTxs) {
        await sleep(args.delay);
      }
    }

    const submitTime = (Date.now() - startTime) / 1000;
    console.log(`\n✅ All transactions submitted (${txCount} total) in ${formatTime(submitTime)}\n`);

    // Monitor confirmations
    console.log('⏳ Waiting for confirmations...');
    const confirmationStart = Date.now();
    let confirmed = 0;
    let failed = 0;
    const confirmationTimes = [];
    const gasUsedList = [];

    const confirmPromises = txHashes.map(async (hash) => {
      const txStartTime = Date.now();
      try {
        const receipt = await provider.waitForTransaction(hash, 1, 120000); // 2 minute timeout
        const confirmTime = (Date.now() - txStartTime) / 1000;
        confirmationTimes.push(confirmTime);

        if (receipt) {
          confirmed++;
          gasUsedList.push(receipt.gasUsed);
          return { hash, confirmed: true, gasUsed: receipt.gasUsed, confirmTime };
        }
      } catch (err) {
        failed++;
        return { hash, confirmed: false, error: err.message };
      }
    });

    // Show progress
    let lastProgress = 0;
    const progressInterval = setInterval(() => {
      const current = confirmed + failed;
      if (current > lastProgress && current % 10 === 0) {
        const elapsed = (Date.now() - confirmationStart) / 1000;
        const rate = current / elapsed;
        console.log(`   ${current}/${txCount} confirmed (${rate.toFixed(2)} txs/s)...`);
        lastProgress = current;
      }
    }, 500);

    await Promise.all(confirmPromises);
    clearInterval(progressInterval);

    const totalTime = (Date.now() - startTime) / 1000;
    const confirmTime = (Date.now() - confirmationStart) / 1000;

    // Calculate statistics
    const avgConfirmTime = confirmationTimes.length > 0 
      ? confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length
      : 0;
    const maxConfirmTime = confirmationTimes.length > 0 ? Math.max(...confirmationTimes) : 0;
    const minConfirmTime = confirmationTimes.length > 0 ? Math.min(...confirmationTimes) : 0;

    const avgGasUsed = gasUsedList.length > 0
      ? gasUsedList.reduce((a, b) => a + b, 0n) / BigInt(gasUsedList.length)
      : 0n;

    const tps = confirmed / totalTime;
    const peakTps = Math.max(...confirmationTimes.map(t => 1 / t));

    // Print results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                        📊 RESULTS SUMMARY                      ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Transaction Submission:');
    console.log(`   Total Submitted:  ${txCount}`);
    console.log(`   Submit Time:      ${formatTime(submitTime)}`);
    console.log(`   Submission Rate:  ${(txCount / submitTime).toFixed(2)} txs/s\n`);

    console.log('Transaction Confirmation:');
    console.log(`   Confirmed:        ${confirmed}/${txCount}`);
    console.log(`   Failed:           ${failed}/${txCount}`);
    console.log(`   Success Rate:     ${((confirmed / txCount) * 100).toFixed(2)}%`);
    console.log(`   Confirmation Time: ${formatTime(confirmTime)}\n`);

    console.log('Confirmation Timing:');
    console.log(`   Avg Confirm Time: ${formatTime(avgConfirmTime)}`);
    console.log(`   Min Confirm Time: ${formatTime(minConfirmTime)}`);
    console.log(`   Max Confirm Time: ${formatTime(maxConfirmTime)}\n`);

    console.log('⚡ THROUGHPUT METRICS:');
    console.log(`   Average TPS:      ${tps.toFixed(2)} txs/s`);
    console.log(`   Peak TPS:         ${peakTps.toFixed(2)} txs/s`);
    console.log(`   Total Time:       ${formatTime(totalTime)}\n`);

    console.log('Gas Metrics:');
    console.log(`   Avg Gas per Tx:   ${avgGasUsed.toString()}`);
    console.log(`   Total Gas Used:   ${(avgGasUsed * BigInt(confirmed)).toString()}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runLoadTest().catch(console.error);
