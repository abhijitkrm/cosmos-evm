#!/usr/bin/env node

/**
 * Gas Consumption Test Script
 * Consumes ~100M gas units through multiple transactions
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305'; // dev0
const RECIPIENT = '0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17';

async function consumeGas() {
  console.log('\n' + '='.repeat(70));
  console.log('🔥 Gas Consumption Test - Target: ~100M Gas Units');
  console.log('='.repeat(70) + '\n');
  console.log(`RPC URL: ${RPC_URL}\n`);

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);
    const address = await signer.getAddress();

    console.log(`Account: ${address}\n`);

    const targetGas = 100_000_000; // 100M gas
    const gasPerTransfer = 21000; // ~21k for simple transfer
    const transactionsNeeded = Math.ceil(targetGas / gasPerTransfer);

    console.log(`📊 Strategy: Send multiple ETH transfers`);
    console.log(`Gas per transfer: ${gasPerTransfer.toLocaleString()}`);
    console.log(`Transfers needed: ${transactionsNeeded.toLocaleString()}\n`);
    console.log(`This is efficient - each transfer = simple tx + ~21k gas\n`);

    // Get initial balance
    const balance = await provider.getBalance(address);
    const balanceEther = ethers.formatEther(balance);
    console.log(`Account balance: ${balanceEther} ETH\n`);

    const transferAmount = ethers.parseEther('0.001'); // 0.001 ETH per transfer
    const totalEthNeeded = Number(ethers.formatEther(transferAmount * BigInt(transactionsNeeded)));

    if (parseFloat(balanceEther) < totalEthNeeded) {
      console.log(`⚠️  Warning: Need ~${totalEthNeeded} ETH for all transfers, have ${balanceEther} ETH`);
      console.log(`Adjusting to use available balance...\n`);
    }

    let totalGasUsed = 0;
    let txCount = 0;
    let startTime = Date.now();

    console.log(`⛽ Executing ${Math.min(transactionsNeeded, 5000)} transfer transactions...\n`);

    // Send transfers in batches to consume gas
    for (let i = 0; i < Math.min(transactionsNeeded, 5000) && totalGasUsed < targetGas; i++) {
      try {
        // Create a unique recipient address for each transfer (to simulate different addresses)
        // For simplicity, just send to same address
        const tx = await signer.sendTransaction({
          to: RECIPIENT,
          value: transferAmount,
        });

        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        totalGasUsed += Number(gasUsed);
        txCount++;

        if ((i + 1) % 100 === 0 || (i + 1) === Math.min(transactionsNeeded, 5000)) {
          const percentage = ((totalGasUsed / targetGas) * 100).toFixed(2);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`   Tx #${txCount}: Gas ${gasUsed.toLocaleString()} | Total: ${totalGasUsed.toLocaleString()} (${percentage}%) | ${elapsed}s elapsed`);
        }

        if (totalGasUsed >= targetGas) {
          break;
        }

        // Small delay to avoid overwhelming the node
        if ((i + 1) % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        if (error.message.includes('insufficient funds')) {
          console.log(`\n⚠️  Ran out of funds after ${txCount} transfers\n`);
          break;
        }
        throw error;
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Summary');
    console.log('='.repeat(70) + '\n');
    console.log(`Total Transactions: ${txCount}`);
    console.log(`Total Gas Consumed: ${totalGasUsed.toLocaleString()} units`);
    console.log(`Target Gas: ${targetGas.toLocaleString()} units`);
    console.log(`Achievement: ${((totalGasUsed / targetGas) * 100).toFixed(2)}%`);
    console.log(`Total Time: ${totalTime} seconds`);
    console.log(`Avg Gas per Tx: ${(totalGasUsed / txCount).toFixed(0)} units\n`);

    if (totalGasUsed >= targetGas) {
      console.log('✅ Successfully consumed ~100M gas units!\n');
    } else {
      console.log(`⚠️  Consumed ${totalGasUsed.toLocaleString()} gas (${((totalGasUsed / targetGas) * 100).toFixed(2)}% of target)\n`);
      console.log(`💡 Tip: Run the script again or adjust transferAmount to consume more gas.\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

consumeGas().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
