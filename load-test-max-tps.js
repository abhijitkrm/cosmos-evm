#!/usr/bin/env node

/**
 * EVM Chain Load Test - Max TPS Mode
 * Aggressively optimized for maximum throughput
 * 
 * Usage:
 *   RPC_URL=http://localhost:8545 PRIVATE_KEY=0x... node load-test-max-tps.js [options]
 * 
 * Options:
 *   --duration=30          Test duration in seconds
 *   --concurrency=20       Number of concurrent transaction senders
 *   --gas-price=1000000000 Gas price in wei (1 gwei default)
 */

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';

const args = {
  duration: parseInt(process.argv.find(a => a.startsWith('--duration='))?.split('=')[1] || '30'),
  concurrency: parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '20'),
  gasPrice: process.argv.find(a => a.startsWith('--gas-price='))?.split('=')[1] || '50000000000', // 50 gwei default
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('         EVM Chain Load Test - Maximum TPS Mode                 ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Configuration:');
console.log(`   RPC URL:       ${RPC_URL}`);
console.log(`   Duration:      ${args.duration}s`);
console.log(`   Concurrency:   ${args.concurrency} senders`);
console.log(`   Gas Price:     ${args.gasPrice} wei\n`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMaxTpsTest() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log('🔗 Connecting...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ${network.chainId}\n`);

    // Create sender and recipient
    console.log('👛 Setting up accounts...');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const signerAddr = await signer.getAddress();
    
    // Create deterministic recipient (different from sender)
    const recipientPrivKey = ethers.keccak256(ethers.toUtf8Bytes('recipient'));
    const recipient = new ethers.Wallet(recipientPrivKey);
    const recipientAddr = recipient.address;

    console.log(`   Sender:    ${signerAddr}`);
    console.log(`   Recipient: ${recipientAddr}\n`);

    // Get balance
    console.log('💰 Checking balance...');
    const balance = await provider.getBalance(signerAddr);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Get nonce
    const nonce = await provider.getTransactionCount(signerAddr);
    console.log(`   Current Nonce: ${nonce}\n`);

    // Get gas price
    const feeData = await provider.getFeeData();
    const gasPrice = BigInt(args.gasPrice);
    console.log(`   Using Gas Price: ${gasPrice} wei (${ethers.formatUnits(gasPrice, 'gwei')} gwei)\n`);

    // Start load test
    console.log('🚀 Starting load test...');
    console.log(`   Target: ${args.concurrency} concurrent senders for ${args.duration}s\n`);

    const startTime = Date.now();
    let txCount = 0;
    let errorCount = 0;
    let currentNonce = nonce;
    const txHashes = [];

    // Create workers that send txs continuously
    const workers = [];
    for (let w = 0; w < args.concurrency; w++) {
      workers.push((async () => {
        let workerNonce = currentNonce + w;
        while ((Date.now() - startTime) < args.duration * 1000) {
          try {
            // Build and send raw transaction
            const tx = {
              to: recipientAddr,
              value: ethers.parseEther('0.001'), // 0.001 ETH per transfer
              gasLimit: 21000,
              gasPrice: gasPrice,
              nonce: workerNonce,
              chainId: network.chainId,
            };

            const txResponse = await signer.sendTransaction(tx);
            txHashes.push(txResponse.hash);
            txCount++;
            workerNonce++;

            // Print progress every 50 transactions
            if (txCount % 50 === 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = txCount / elapsed;
              if (txCount % 250 === 0) {
                console.log(`   ${txCount} txs sent (${rate.toFixed(2)} txs/s)...`);
              }
            }
          } catch (err) {
            errorCount++;
            // On nonce error, wait a bit before retrying
            if (err.message.includes('nonce')) {
              await sleep(100);
            }
          }

          // Small delay to avoid overwhelming the node
          await sleep(0);
        }
      })());
    }

    // Wait for all workers to finish
    await Promise.all(workers);
    const elapsedTime = (Date.now() - startTime) / 1000;

    console.log(`\n✅ Submission phase complete\n`);

    // Monitor confirmations
    console.log('⏳ Monitoring confirmations (this may take a while)...\n');
    let confirmed = 0;
    let failed = 0;
    const confirmationTimes = [];

    const confirmStart = Date.now();
    for (let i = 0; i < txHashes.length; i++) {
      const hash = txHashes[i];
      try {
        const txStartTime = Date.now();
        const receipt = await provider.waitForTransaction(hash, 1, 180000); // 3 min timeout
        const confirmTime = (Date.now() - txStartTime) / 1000;
        
        if (receipt) {
          confirmed++;
          confirmationTimes.push(confirmTime);
        }
      } catch (err) {
        failed++;
      }

      // Show progress
      if ((i + 1) % 100 === 0) {
        console.log(`   ${i + 1}/${txHashes.length} confirmations checked...`);
      }
    }

    const confirmTime = (Date.now() - confirmStart) / 1000;

    // Calculate statistics
    const avgConfirmTime = confirmationTimes.length > 0
      ? confirmationTimes.reduce((a, b) => a + b, 0) / confirmationTimes.length
      : 0;

    const tps = confirmed / elapsedTime;

    // Print results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    📊 MAX TPS TEST RESULTS                     ');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Submission Phase:');
    console.log(`   Duration:        ${elapsedTime.toFixed(2)}s`);
    console.log(`   Txs Sent:        ${txCount}`);
    console.log(`   Errors:          ${errorCount}`);
    console.log(`   Submission Rate: ${(txCount / elapsedTime).toFixed(2)} txs/s\n`);

    console.log('Confirmation Phase:');
    console.log(`   Duration:        ${confirmTime.toFixed(2)}s`);
    console.log(`   Confirmed:       ${confirmed}/${txHashes.length} (${((confirmed / txHashes.length) * 100).toFixed(2)}%)`);
    console.log(`   Failed:          ${failed}/${txHashes.length}\n`);

    console.log('⚡ PEAK TPS ACHIEVED:');
    console.log(`   TPS (steady):    ${tps.toFixed(2)} txs/s`);
    console.log(`   Avg Confirm:     ${avgConfirmTime.toFixed(3)}s\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMaxTpsTest().catch(console.error);
