#!/usr/bin/env node

/**
 * 100 Wallet Sequential Fund + Concurrent Load Test
 * 
 * This script:
 * 1. Creates 100 wallets deterministically
 * 2. Sequentially transfers 0.01 ETH from dev wallet to each
 * 3. Concurrently sends ETH back from all 100 wallets to dev wallet
 * 4. Outputs detailed TPS and throughput metrics
 * 
 * Usage:
 *   RPC_URL=http://localhost:8545 PRIVATE_KEY=0x... node load-test-100-wallets.js [options]
 * 
 * Options:
 *   --num-wallets=100      Number of wallets to create (default: 100)
 *   --fund-amount=0.01     ETH to send to each wallet (default: 0.01)
 *   --return-amount=0.009  ETH to send back per wallet (default: 0.009)
 *   --concurrency=50       Concurrent senders during load test (default: 50)
 *   --txs-per-wallet=1     Transactions per wallet (default: 1)
 */

const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';

// Parse arguments
const args = {
  numWallets: parseInt(process.argv.find(a => a.startsWith('--num-wallets='))?.split('=')[1] || '100'),
  fundAmount: parseFloat(process.argv.find(a => a.startsWith('--fund-amount='))?.split('=')[1] || '0.01'),
  returnAmount: parseFloat(process.argv.find(a => a.startsWith('--return-amount='))?.split('=')[1] || '0.009'),
  concurrency: parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '50'),
  txsPerWallet: parseInt(process.argv.find(a => a.startsWith('--txs-per-wallet='))?.split('=')[1] || '1'),
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('      100 Wallet Sequential Fund + Concurrent Load Test      ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Configuration:');
console.log(`   RPC URL:              ${RPC_URL}`);
console.log(`   Wallets to Create:    ${args.numWallets}`);
console.log(`   Fund Amount per Wallet: ${args.fundAmount} ETH`);
console.log(`   Return Amount:        ${args.returnAmount} ETH per wallet`);
console.log(`   Concurrent Senders:   ${args.concurrency}`);
console.log(`   Txs per Wallet:       ${args.txsPerWallet}`);
console.log(`   Total Expected Txs:   ${args.numWallets * args.txsPerWallet}\n`);

// Utility functions
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

function formatTime(seconds) {
  if (seconds < 1) return `${(seconds * 1000).toFixed(2)}ms`;
  return `${seconds.toFixed(2)}s`;
}

// Main execution
async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // === Phase 1: Connection & Setup ===
    console.log('🔗 Connecting to provider...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ${network.chainId}\n`);

    // === Phase 2: Wallet Generation ===
    console.log(`👛 Generating ${args.numWallets} wallets...\n`);
    const wallets = generateWallets(args.numWallets, PRIVATE_KEY);
    const walletAddresses = wallets.map(w => w.address);

    // Show wallet list (first 10 and last 10)
    console.log('📅 Generated Wallets (showing first 5 and last 5):');
    for (let i = 0; i < Math.min(5, walletAddresses.length); i++) {
      console.log(`   [${String(i).padStart(3, ' ')}] ${walletAddresses[i]}`);
    }
    if (walletAddresses.length > 10) {
      console.log('   ...');
      for (let i = Math.max(5, walletAddresses.length - 5); i < walletAddresses.length; i++) {
        console.log(`   [${String(i).padStart(3, ' ')}] ${walletAddresses[i]}`);
      }
    }
    console.log('');

    // === Phase 3: Dev Wallet Setup & Balance Check ===
    const devSigner = new ethers.Wallet(PRIVATE_KEY, provider);
    const devAddress = await devSigner.getAddress();

    console.log('💰 Checking dev wallet balance...');
    const devBalance = await provider.getBalance(devAddress);
    const devBalanceEther = ethers.formatEther(devBalance);

    console.log(`   Dev Address: ${devAddress}`);
    console.log(`   Dev Balance: ${devBalanceEther} ETH`);

    const totalFundingNeeded = ethers.parseEther((args.numWallets * args.fundAmount).toString());
    const totalFundingEther = ethers.formatEther(totalFundingNeeded);

    if (devBalance < totalFundingNeeded) {
      console.error(`\n❌ Insufficient balance!`);
      console.error(`   Need: ${totalFundingEther} ETH`);
      console.error(`   Have: ${devBalanceEther} ETH\n`);
      process.exit(1);
    }
    console.log(`   Will need: ${totalFundingEther} ETH for funding`);
    console.log(`   Sufficient! ✅\n`);

    // === Phase 4: Sequential Funding ===
    console.log(`📤 PHASE 1: Sequentially funding ${args.numWallets} wallets with ${args.fundAmount} ETH each...\n`);
    const fundingStartTime = Date.now();
    const fundingTxHashes = [];
    let fundingSuccessCount = 0;

    for (let i = 0; i < walletAddresses.length; i++) {
      try {
        const tx = await devSigner.sendTransaction({
          to: walletAddresses[i],
          value: ethers.parseEther(args.fundAmount.toString()),
        });
        fundingTxHashes.push({ index: i, hash: tx.hash, address: walletAddresses[i] });
        fundingSuccessCount++;

        if ((i + 1) % 10 === 0) {
          console.log(`   [${String(i + 1).padStart(3, ' ')}/${args.numWallets}] Sent to ${walletAddresses[i].slice(0, 10)}... (${tx.hash.slice(0, 10)}...)`);
        }
      } catch (err) {
        console.error(`   [${String(i + 1).padStart(3, ' ')}/${args.numWallets}] ❌ Failed: ${err.message}`);
      }

      // Small delay between transactions to ensure nonce ordering
      if (i < walletAddresses.length - 1) {
        await sleep(1000);
      }
    }

    console.log(`   [${args.numWallets}/${args.numWallets}] Funding transactions submitted\n`);

    // Wait for funding confirmations
    console.log('⏳ Waiting for funding confirmations...\n');
    let fundingConfirmed = 0;
    let fundingFailed = 0;

    for (let i = 0; i < fundingTxHashes.length; i++) {
      const { index, hash, address } = fundingTxHashes[i];
      try {
        const receipt = await provider.waitForTransaction(hash, 1, 60000);
        if (receipt) {
          fundingConfirmed++;
          if ((i + 1) % 10 === 0) {
            console.log(`   [${String(i + 1).padStart(3, ' ')}/${fundingTxHashes.length}] Confirmed in block ${receipt.blockNumber}`);
          }
        }
      } catch (err) {
        fundingFailed++;
        console.log(`   [${String(i + 1).padStart(3, ' ')}/${fundingTxHashes.length}] ❌ Confirmation timeout`);
      }
    }

    const fundingTime = (Date.now() - fundingStartTime) / 1000;
    console.log(`\n✅ Funding phase complete in ${formatTime(fundingTime)}`);
    console.log(`   Confirmed: ${fundingConfirmed}/${fundingTxHashes.length}\n`);

    // === Phase 5: Verify Funded Wallet Balances ===
    console.log('💰 Verifying funded wallet balances...');
    const fundedSigners = wallets.map(w => w.connect(provider));
    const fundedBalances = await Promise.all(
      fundedSigners.map(s => provider.getBalance(s.address))
    );

    let totalFundedBalance = 0n;
    let minBalance = fundedBalances[0];
    let maxBalance = fundedBalances[0];

    fundedBalances.forEach(balance => {
      totalFundedBalance += balance;
      minBalance = balance < minBalance ? balance : minBalance;
      maxBalance = balance > maxBalance ? balance : maxBalance;
    });

    console.log(`   Avg Balance per Wallet: ${ethers.formatEther(totalFundedBalance / BigInt(args.numWallets))} ETH`);
    console.log(`   Min Balance: ${ethers.formatEther(minBalance)} ETH`);
    console.log(`   Max Balance: ${ethers.formatEther(maxBalance)} ETH`);
    console.log(`   Total Balance: ${ethers.formatEther(totalFundedBalance)} ETH\n`);

    // === Phase 6: Concurrent Load Test ===
    console.log(`🚀 PHASE 2: Starting concurrent load test...\n`);
    console.log(`   Each of ${args.numWallets} wallets will send ${args.returnAmount} ETH back to dev wallet`);
    console.log(`   Concurrency: ${args.concurrency} senders`);
    console.log(`   Total transactions: ${args.numWallets * args.txsPerWallet}\n`);

    const loadTestStartTime = Date.now();
    const txHashes = [];
    let txCount = 0;
    let errorCount = 0;

    // Create workers that send transactions concurrently
    const workers = [];
    const walletQueue = [];

    // Create queue of wallet indices to process
    for (let txNum = 0; txNum < args.txsPerWallet; txNum++) {
      for (let walletIdx = 0; walletIdx < args.numWallets; walletIdx++) {
        walletQueue.push({ walletIdx, txNum });
      }
    }

    // Shuffle queue for better randomness
    for (let i = walletQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [walletQueue[i], walletQueue[j]] = [walletQueue[j], walletQueue[i]];
    }

    // Start workers that process from queue
    for (let w = 0; w < args.concurrency; w++) {
      workers.push((async () => {
        while (walletQueue.length > 0) {
          const job = walletQueue.shift();
          if (!job) break;

          const { walletIdx, txNum } = job;
          try {
            const wallet = fundedSigners[walletIdx];
            const tx = await wallet.sendTransaction({
              to: devAddress,
              value: ethers.parseEther(args.returnAmount.toString()),
              gasPrice: ethers.parseUnits('50', 'gwei'),
            });
            txHashes.push(tx.hash);
            txCount++;

            if (txCount % 50 === 0) {
              const elapsed = (Date.now() - loadTestStartTime) / 1000;
              const rate = txCount / elapsed;
              console.log(`   📊 Progress: ${txCount}/${args.numWallets * args.txsPerWallet} txs (${rate.toFixed(2)} txs/s)`);
            }
          } catch (err) {
            errorCount++;
            console.error(`   ❌ Wallet ${walletIdx} tx${txNum}: ${err.message}`);
          }
        }
      })());
    }

    await Promise.all(workers);
    const submissionTime = (Date.now() - loadTestStartTime) / 1000;

    console.log(`\n✅ All transactions submitted\n`);
    console.log(`   Total Sent: ${txCount}`);
    console.log(`   Failed: ${errorCount}`);
    console.log(`   Submission Time: ${formatTime(submissionTime)}`);
    console.log(`   Submission Rate: ${(txCount / submissionTime).toFixed(2)} txs/s\n`);

    // === Phase 7: Confirmation Monitoring ===
    console.log('⏳ Monitoring confirmations...\n');
    const confirmationStartTime = Date.now();
    let confirmed = 0;
    let failed = 0;
    const confirmationTimes = [];
    const gasUsedList = [];

    for (let i = 0; i < txHashes.length; i++) {
      const hash = txHashes[i];
      const txStartTime = Date.now();

      try {
        const receipt = await provider.waitForTransaction(hash, 1, 120000);
        const confirmTime = (Date.now() - txStartTime) / 1000;

        if (receipt) {
          confirmed++;
          confirmationTimes.push(confirmTime);
          gasUsedList.push(receipt.gasUsed);
        }
      } catch (err) {
        failed++;
      }

      if ((i + 1) % 100 === 0) {
        const elapsed = (Date.now() - confirmationStartTime) / 1000;
        const rate = confirmed / elapsed;
        console.log(`   ⏳ ${i + 1}/${txHashes.length} checked (${confirmed} confirmed, ${rate.toFixed(2)} confirmations/s)`);
      }
    }

    const confirmationTime = (Date.now() - confirmationStartTime) / 1000;
    const totalTime = (Date.now() - loadTestStartTime) / 1000;

    // Calculate statistics
    const avgConfirmTime = confirmationTimes.length > 0
      ? confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length
      : 0;
    const maxConfirmTime = confirmationTimes.length > 0 ? Math.max(...confirmationTimes) : 0;
    const minConfirmTime = confirmationTimes.length > 0 ? Math.min(...confirmationTimes) : 0;
    const medianConfirmTime = confirmationTimes.length > 0
      ? confirmationTimes.sort((a, b) => a - b)[Math.floor(confirmationTimes.length / 2)]
      : 0;

    const avgGasUsed = gasUsedList.length > 0
      ? gasUsedList.reduce((a, b) => a + b, 0n) / BigInt(gasUsedList.length)
      : 0n;

    const tps = confirmed / totalTime;
    const peakTps = confirmed / submissionTime;

    // === Phase 8: Results Summary ===
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    📊 COMPREHENSIVE TEST RESULTS                ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('PHASE 1 - Funding Summary:');
    console.log(`   Wallets Created:      ${args.numWallets}`);
    console.log(`   Funding Txs:          ${fundingTxHashes.length}`);
    console.log(`   Confirmed:            ${fundingConfirmed}`);
    console.log(`   Failed:               ${fundingFailed}`);
    console.log(`   Total Time:           ${formatTime(fundingTime)}`);
    console.log(`   Success Rate:         ${((fundingConfirmed / fundingTxHashes.length) * 100).toFixed(2)}%\n`);

    console.log('PHASE 2 - Load Test Submission:');
    console.log(`   Total Txs Sent:       ${txCount}`);
    console.log(`   Submission Time:      ${formatTime(submissionTime)}`);
    console.log(`   Submission Rate:      ${(txCount / submissionTime).toFixed(2)} txs/s`);
    console.log(`   Errors During Submit: ${errorCount}\n`);

    console.log('Load Test Confirmation:');
    console.log(`   Confirmed:            ${confirmed}/${txHashes.length}`);
    console.log(`   Failed:               ${failed}/${txHashes.length}`);
    console.log(`   Success Rate:         ${((confirmed / txHashes.length) * 100).toFixed(2)}%`);
    console.log(`   Confirmation Time:    ${formatTime(confirmationTime)}\n`);

    console.log('Confirmation Timing Statistics:');
    console.log(`   Avg Confirm Time:     ${formatTime(avgConfirmTime)}`);
    console.log(`   Median Confirm Time:  ${formatTime(medianConfirmTime)}`);
    console.log(`   Min Confirm Time:     ${formatTime(minConfirmTime)}`);
    console.log(`   Max Confirm Time:     ${formatTime(maxConfirmTime)}\n`);

    console.log('⚡ THROUGHPUT METRICS:');
    console.log(`   Peak TPS:             ${peakTps.toFixed(2)} txs/s (submission phase)`);
    console.log(`   Average TPS:          ${tps.toFixed(2)} txs/s (total)`);
    console.log(`   Total Time (Phase 2):  ${formatTime(totalTime)}\n`);

    console.log('Gas Metrics:');
    console.log(`   Avg Gas per Tx:       ${avgGasUsed.toString()}`);
    console.log(`   Total Gas Used:       ${(avgGasUsed * BigInt(confirmed)).toString()}\n`);

    // Dev wallet final balance
    const devFinalBalance = await provider.getBalance(devAddress);
    const devFinalBalanceEther = ethers.formatEther(devFinalBalance);
    const devBalanceChange = ethers.formatEther(devFinalBalance - devBalance);

    console.log('Final Balances:');
    console.log(`   Dev Wallet Start:     ${devBalanceEther} ETH`);
    console.log(`   Dev Wallet End:       ${devFinalBalanceEther} ETH`);
    console.log(`   Net Change:           ${devBalanceChange} ETH\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
