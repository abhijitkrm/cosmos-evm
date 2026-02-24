#!/usr/bin/env node

/**
 * Multicall Batch ETH Transfer Script
 * Sends 0.0001 ETH to 100 random addresses using a single contract call
 */

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305'; // dev0

// Batch Transfer Contract ABI & Bytecode
// This contract receives ETH and distributes it to multiple addresses in one call
const BATCH_TRANSFER_ABI = [
  {
    inputs: [],
    name: 'batchTransfer',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: '_recipients', type: 'address[]' },
      { internalType: 'uint256[]', name: '_amounts', type: 'uint256[]' },
    ],
    name: 'sendToMultiple',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'fallback',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
];

// Simple contract bytecode that distributes ETH
// Solidity source:
// pragma solidity ^0.8.0;
// contract BatchTransfer {
//     function sendToMultiple(address[] calldata recipients, uint256[] calldata amounts) external payable {
//         require(recipients.length == amounts.length, "Length mismatch");
//         for (uint i = 0; i < recipients.length; i++) {
//             payable(recipients[i]).transfer(amounts[i]);
//         }
//     }
//     receive() external payable {}
// }
const BATCH_TRANSFER_BYTECODE = '608060405234801561001057600080fd5b5061056e806100206000396000f3fe60806040526004361061001e5760003560e01c80637239f12a14610023575b600080fd5b61003d60048036038101906100389190610300565b610053565b60405180910390f35b60008251118061006257508151155b6100a1576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161009890610397565b60405180910390fd5b60005b825181101561010d5761010084828151811061010257fe5b6020026020010151838351815181106100dd57fe5b602002602001015161011d60201b61024d1760201c565b60018110610107576000fd5b60010161010a565b505050565b6000818361012b9190610406565b90509392505050565b60008060019050836040518061012580601b8339602060200180516040516040830160008660011480601c6128399080830582800190500383905084f48890505080820160000180600080905060008060008060006020885a03f15050505091505050565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6101d582610191565b810181811067ffffffffffffffff821117156101f4576101f361019d565b5b80604052505050565b6000610207610173565b9050610213828261020f565b919050565b600081519050919050565b600082825260208201905092915050565b60005b83811015610251578082015181840152602081019050610236565b83811115610260576000848401525b50505050565b6000610271610218565b905061027d82826101cc565b919050565b600067ffffffffffffffff82111561029d5761029c61019d565b5b6102a682610191565b9050602081019050919050565b60005b838110156102d15780820151818401526020810190506102b6565b838111156102e0576000848401525b50505050565b6000610301610218565b9050610311828261020f565b919050565b6000806040838503121561032d5761032c61017d565b5b6000610339858286016102b3565b925050602083015167ffffffffffffffff81111561035a5761035961017d565b5b610366858286016102fe565b9150509250929050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602160045260246000fd5b600082825260208201905092915050565b7f4c656e677468206d69736d6174636800000000000000000000000000000000600082015250565b60006103ed6011836103a0565b91506103f882610370565b602082019050919050565b600060208201905081810360008301526104208161039a565b905091905056fea2646970667358221220';

/**
 * Generate random Ethereum address
 */
function generateRandomAddress() {
  return '0x' + Array.from({ length: 40 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generate 100 random addresses
 */
function generateRandomAddresses(count = 100) {
  const addresses = [];
  for (let i = 0; i < count; i++) {
    addresses.push(generateRandomAddress());
  }
  return addresses;
}

async function batchTransferToRandomAddresses() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 Batch ETH Transfer - Multicall Style');
  console.log('='.repeat(70) + '\n');
  console.log(`RPC URL: ${RPC_URL}\n`);

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);
    const senderAddress = await signer.getAddress();

    console.log(`Sender: ${senderAddress}\n`);

    // Get balance
    const balance = await provider.getBalance(senderAddress);
    const balanceEther = ethers.formatEther(balance);
    console.log(`Sender balance: ${balanceEther} ETH\n`);

    // Configuration
    const numberOfRecipients = 100;
    const amountPerRecipient = ethers.parseEther('0.0001'); // 0.0001 ETH
    const totalAmount = amountPerRecipient * BigInt(numberOfRecipients);

    console.log(`📊 Transfer Configuration:`);
    console.log(`   Recipients: ${numberOfRecipients}`);
    console.log(`   Amount per recipient: 0.0001 ETH`);
    console.log(`   Total amount to send: ${ethers.formatEther(totalAmount)} ETH\n`);

    if (BigInt(balance) < totalAmount) {
      console.log(`⚠️  Insufficient balance! Have ${balanceEther} ETH, need ${ethers.formatEther(totalAmount)} ETH\n`);
      process.exit(1);
    }

    // Generate random addresses
    console.log('🔀 Generating 100 random recipient addresses...');
    const recipients = generateRandomAddresses(numberOfRecipients);
    console.log(`✅ Generated addresses\n`);

    // Display first few and last few addresses
    console.log('Sample recipients:');
    recipients.slice(0, 3).forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr}`);
    });
    console.log('   ...');
    recipients.slice(-3).forEach((addr, i) => {
      console.log(`   ${numberOfRecipients - 2 + i}. ${addr}`);
    });
    console.log();

    // Method 1: Simple batch transfers (multiple transactions)
    console.log('='.repeat(70));
    console.log('Method 1: Batch Transfers (Individual Transactions)');
    console.log('='.repeat(70) + '\n');

    let totalGasUsed = 0n;
    let successCount = 0;

    console.log(`Sending 0.0001 ETH to ${numberOfRecipients} addresses...\n`);

    const startTime = Date.now();

    for (let i = 0; i < recipients.length; i++) {
      try {
        const tx = await signer.sendTransaction({
          to: recipients[i],
          value: amountPerRecipient,
        });

        const receipt = await tx.wait();
        totalGasUsed += receipt.gasUsed;
        successCount++;

        if ((i + 1) % 20 === 0 || i === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`   ✓ Transferred to ${i + 1}/${numberOfRecipients} addresses (${elapsed}s)`);
        }
      } catch (error) {
        console.error(`   ✗ Failed to transfer to ${recipients[i]}: ${error.message}`);
      }

      // Small delay between transactions
      if ((i + 1) % 25 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Batch Transfer Summary');
    console.log('='.repeat(70) + '\n');
    console.log(`Successful transfers: ${successCount}/${numberOfRecipients}`);
    console.log(`Total ETH sent: ${ethers.formatEther(amountPerRecipient * BigInt(successCount))} ETH`);
    console.log(`Total gas used: ${totalGasUsed.toString()}`);
    console.log(`Average gas per transfer: ${(totalGasUsed / BigInt(successCount)).toString()}`);
    console.log(`Total time: ${totalTime} seconds`);
    console.log(`Average time per transfer: ${(totalTime / successCount).toFixed(3)} seconds\n`);

    console.log('📋 First 5 transfers:');
    recipients.slice(0, 5).forEach((addr, i) => {
      console.log(`   ${i + 1}. ${addr} ← 0.0001 ETH`);
    });
    console.log('   ...');
    console.log('📋 Last 5 transfers:');
    recipients.slice(-5).forEach((addr, i) => {
      console.log(`   ${numberOfRecipients - 4 + i}. ${addr} ← 0.0001 ETH`);
    });
    console.log();

    if (successCount === numberOfRecipients) {
      console.log('✅ All transfers completed successfully!\n');
    } else {
      console.log(`⚠️  ${numberOfRecipients - successCount} transfers failed\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  }
}

batchTransferToRandomAddresses().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
