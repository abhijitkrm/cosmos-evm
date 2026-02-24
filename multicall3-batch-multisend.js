const ethers = require('ethers');

// Deployed Multicall3 address
const MULTICALL3_ADDRESS = '0x6186B45C735006Ce5b92D3282B812867AB4E2B05';

// Multicall3 ABI (aggregate3Value function)
const MULTICALL3_ABI = [
  {
    name: 'aggregate3Value',
    type: 'function',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' }
        ]
      }
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' }
        ]
      }
    ],
    stateMutability: 'payable'
  }
];

async function multisendBatch() {
  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');
  const privateKey = '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';
  const signer = new ethers.Wallet(privateKey, provider);

  console.log(`Sender: ${signer.address}\n`);

  // Create Multicall3 contract instance
  const multicall3 = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, signer);

  // Configuration
  const totalRecipients = 700;
  const batchSize = 200;  // 200 addresses per transaction (safe limit)
  const amountPerRecipient = ethers.parseEther('0.0001'); // 0.0001 ETH each
  
  console.log(`📤 Building ${totalRecipients} transfers in batches of ${batchSize}...`);
  console.log(`Amount per recipient: ${ethers.formatEther(amountPerRecipient)} ETH`);
  console.log(`Total value to distribute: ${ethers.formatEther(BigInt(totalRecipients) * amountPerRecipient)} ETH\n`);

  // Generate all recipients upfront
  const recipients = [];
  for (let i = 0; i < totalRecipients; i++) {
    recipients.push('0x' + Math.random().toString(16).slice(2).padStart(40, '0'));
  }

  // Process in batches
  let totalGasUsed = 0n;
  const numBatches = Math.ceil(totalRecipients / batchSize);

  for (let batchNum = 0; batchNum < numBatches; batchNum++) {
    const startIdx = batchNum * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalRecipients);
    const batchRecipients = recipients.slice(startIdx, endIdx);
    const batchSize_ = batchRecipients.length;

    console.log(`\n[Batch ${batchNum + 1}/${numBatches}] Sending to ${batchSize_} addresses...`);

    // Build calls for this batch
    const calls = [];
    let batchValue = 0n;

    for (const recipient of batchRecipients) {
      calls.push({
        target: ethers.getAddress(recipient),
        allowFailure: false,
        value: amountPerRecipient,
        callData: '0x'
      });
      batchValue += amountPerRecipient;
    }

    try {
      console.log(`⏳ Sending batch ${batchNum + 1}/${numBatches}...`);
      const tx = await multicall3.aggregate3Value(calls, { value: batchValue });
      console.log(`✅ TX sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`📊 Gas used: ${receipt.gasUsed.toString()} (${ethers.formatUnits(receipt.gasUsed, 'gwei')} gwei)`);
      
      totalGasUsed += receipt.gasUsed;

      // Small delay between batches to avoid rate limiting
      if (batchNum < numBatches - 1) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Batch ${batchNum + 1} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n✅ All batches completed!`);
  console.log(`📊 Total gas used across all batches: ${totalGasUsed.toString()}`);
  console.log(`📊 Average gas per address: ${(totalGasUsed / BigInt(totalRecipients)).toString()}`);
}

multisendBatch().catch(console.error);
