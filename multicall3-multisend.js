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

async function multisend() {
  // Setup provider and signer
  const provider = new ethers.JsonRpcProvider('http://localhost:8545');
  const privateKey = '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305';
  const signer = new ethers.Wallet(privateKey, provider);

  console.log(`Sender: ${signer.address}`);

  // Create Multicall3 contract instance
  const multicall3 = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, signer);

  // Generate random recipients and amounts
  const numRecipients = 680;
  const amountPerRecipient = ethers.parseEther('0.0001'); // 0.0001 ETH each
  const calls = [];

  console.log(`\n📤 Building multisend with ${numRecipients} recipients...`);
  console.log(`Amount per recipient: ${ethers.formatEther(amountPerRecipient)} ETH\n`);

  let totalValue = 0n;

  for (let i = 0; i < numRecipients; i++) {
    const randomAddress = ethers.getAddress('0x' + Math.random().toString(16).slice(2).padStart(40, '0'));
    
    calls.push({
      target: randomAddress,  // Direct transfer to address (no contract call)
      allowFailure: false,    // Require success for all transfers
      value: amountPerRecipient,
      callData: '0x'          // Empty callData for direct transfers
    });

    totalValue += amountPerRecipient;
  }

  console.log(`Total value to send: ${ethers.formatEther(totalValue)} ETH\n`);

  try {
    // Estimate gas first
    console.log('⏳ Estimating gas...');
    const gasEstimate = await multicall3.aggregate3Value.estimateGas(calls, { value: totalValue });
    console.log(`📊 Estimated gas: ${gasEstimate.toString()}\n`);

    // Execute multisend via Multicall3.aggregate3Value
    console.log('⏳ Executing multisend via Multicall3...');
    const tx = await multicall3.aggregate3Value(calls, { value: totalValue });
    console.log(`✅ Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`\n✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);

    // Parse results
    console.log(`\n✅ All ${numRecipients} transfers completed successfully!`);

  } catch (error) {
    // console.error('❌ Error executing multisend:', error.message);
    process.exit(1);
  }
}

multisend().catch(console.error);
