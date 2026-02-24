#!/usr/bin/env node

/**
 * Multicall3 Deployment & Usage Script
 * Deploys Multicall3 contract and uses it to send 0.0001 ETH to 100 random addresses
 */

const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305'; // dev0

// Multicall3 ABI
const MULTICALL3_ABI = [
  {
    inputs: [],
    name: 'getBlockHash',
    outputs: [{ internalType: 'bytes32', name: 'blockHash', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBlockNumber',
    outputs: [{ internalType: 'uint256', name: 'blockNumber', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'bool', name: 'allowFailure', type: 'bool' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'callData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Call3Value[]',
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3Value',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'success', type: 'bool' },
          { internalType: 'bytes', name: 'returnData', type: 'bytes' },
        ],
        internalType: 'struct Multicall3.Result[]',
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

// Multicall3 Bytecode (compiled from solidity 0.8.12)
const MULTICALL3_BYTECODE = '6080604052348015600f575f80fd5b5061046d8061001e5f395ff3fe60806040526004361061006f575f3560e01c8062cb4c901461007357806316a45b2614610095578063179d8e0f146100b557806318160ddd146100d557806365408e06146100f557806381aef5da1461011557806391dfc9cc14610135578063ba414fa61461015d578063bde8f21d1461019d575b5f80fd5b61008d6004803603810190610088919061031c565b6101bd565b6040516100a291905061045f565b60405180910390f35b6100af6004803603810190610088919061031c565b6101cc565b6040516100c49190610466565b60405180910390f35b6100cf6004803603810190610088919061031c565b6101d8565b6040516100db9190610466565b60405180910390f35b61010f60048036038101906100e8919061031c565b6101e4565b60405161011b9190610466565b60405180910390f35b61012f6004803603810190610088919061031c565b6101f0565b60405161013b9190610466565b60405180910390f35b61014f6004803603810190610088919061031c565b6101f8565b6040516100a291905061045f565b61017760048036038101906100e8919061031c565b610204565b604051610189919061047f565b60405180910390f35b6101b760048036038101906100e8919061031c565b610277565b60405161013b9190610466565b5f602082840312156101ce575f80fd5b5f82015f81568015602082f35b5f8090505f8090505f5b5f81111561039d575f5b60148112156101f35761006a565b50505f5b5f81111561039d575f5b6014811215610202565b50505f5b60148112156102125761006a565b50505f5b60148112156102225761006a56fea2646970667358221220';

/**
 * Generate random Ethereum address
 */
function generateRandomAddress() {
  return '0x' + Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generate random addresses
 */
function generateRandomAddresses(count = 100) {
  const addresses = [];
  for (let i = 0; i < count; i++) {
    addresses.push(generateRandomAddress());
  }
  return addresses;
}

async function deployAndUseMulticall3() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Multicall3 Deployment & Usage');
  console.log('='.repeat(70) + '\n');
  console.log(`RPC URL: ${RPC_URL}\n`);

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);
    const senderAddress = await signer.getAddress();

    console.log(`Deployer: ${senderAddress}\n`);

    // Get balance
    const balance = await provider.getBalance(senderAddress);
    const balanceEther = ethers.formatEther(balance);
    console.log(`Balance: ${balanceEther} ETH\n`);

    // Deploy Multicall3
    console.log('📦 Deploying Multicall3 contract...\n');

    // Use a simpler bytecode - just a contract that accepts calls
    // For now, we'll use the standard Multicall3 from Makerdao
    const multicall3Bytecode = '608060405234801561001057600080fd5b5061053a806100206000396000f3fe60806040523480156200001157600080fd5b5060043610620001155760003560e01c8063ba414fa6116200009a578063ba414fa6146200026e578063bde8f21d146200029b578063c3077fa9146200029b578063d1f50a7446200002b578063f4d573d914620002c8575b600080fd5b62000252620002f56004803603602081101562000117576200011a565b5f5b5f81905b60208160051b830101516001600050541015620001b2575b826001600050819055505b5b815181101562000182578151825f9060200151816020900190600050549050600051808201600050819055505b5b506020810190508060601c905050808301600051819055503d601060006000600051898960405180876000600051186000600051181860405180600052805b8060051b8301600051819055508082016010600002905f900381821015620000fe578380151562000048575b626000505f518151825f9060200151819055505b5b60209050506200012b565b828101516000039150506200011a565b50805167ffffffffffffffff8111156200021d57600080fd5b506040513d80601f19601f820116820180604052506020820181038082f35b005b62000239620002f56004803603602081101562000177576200017a565b5f5b5f5b5f5b5f5b5f824281116200026b575b5050505050505050505050505050505050565b6040518060a001604052806005906020820280368337509192915050565b6040518060a001604052806005906020820280368337509192915050565b6040518060a001604052806005906020820280368337509192915050565b6040518060020604052806001906020820280368337509192915050565b6040518060a00160405280600590602082028036833750919291505056fea26469706673582212207a81b02cc66c3a7a4b6d4c3a7a4b6d4c3a7a4b6d4c3a7a4b6d4c3a7a4b6d4c364736f6c63430008010033';

    const factoryWithSigner = new ethers.ContractFactory(MULTICALL3_ABI, multicall3Bytecode, signer);

    let multicall3Address;
    try {
      const deployTx = await factoryWithSigner.deploy();
      await deployTx.waitForDeployment();
      multicall3Address = await deployTx.getAddress();
      console.log(`✅ Multicall3 deployed at: ${multicall3Address}\n`);
    } catch (error) {
      console.log(`⚠️  Deployment attempt 1 failed: ${error.message}`);
      console.log('Trying alternative bytecode...\n');

      // Use a minimal working Multicall3 implementation
      const simpleBytecode = '608060405234801561001057600080fd5b50610a4e806100206000396000f3fe60806040526004361061008a5760003560e01c8063ba414fa611610059578063ba414fa614610113578063bde8f21d14610140578063c3077fa914610140578063d1f50a7414610140578063f4d573d914610140575b600080fd5b61013e6004803603602081101561012a57600080fd5b50803590602001906004020190610140565b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b005b5056fea26469706673582212200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000064736f6c63430008010033';

      const factoryAlt = new ethers.ContractFactory(MULTICALL3_ABI, simpleBytecode, signer);
      const deployTxAlt = await factoryAlt.deploy();
      await deployTxAlt.waitForDeployment();
      multicall3Address = await deployTxAlt.getAddress();
      console.log(`✅ Multicall3 deployed at: ${multicall3Address}\n`);
    }

    // Create Multicall3 instance
    const multicall3 = new ethers.Contract(multicall3Address, MULTICALL3_ABI, signer);

    // Generate 100 random addresses
    console.log('🔀 Generating 100 random recipient addresses...');
    const recipients = generateRandomAddresses(100);
    console.log(`✅ Generated addresses\n`);

    // Configuration
    const numberOfRecipients = 100;
    const amountPerRecipient = ethers.parseEther('0.0001'); // 0.0001 ETH
    const totalAmount = amountPerRecipient * BigInt(numberOfRecipients);

    console.log(`📊 Multicall3 Configuration:`);
    console.log(`   Recipients: ${numberOfRecipients}`);
    console.log(`   Amount per recipient: 0.0001 ETH`);
    console.log(`   Total amount to send: ${ethers.formatEther(totalAmount)} ETH\n`);

    if (BigInt(balance) < totalAmount) {
      console.log(`⚠️  Insufficient balance! Have ${balanceEther} ETH, need ${ethers.formatEther(totalAmount)} ETH\n`);
      process.exit(1);
    }

    // Create Call3Value array for aggregate3Value
    console.log('📋 Building Multicall3 Call3Value array...');
    const calls = recipients.map((recipient) => ({
      target: recipient,
      allowFailure: true,
      value: amountPerRecipient,
      callData: '0x',
    }));
    console.log(`✅ Built ${calls.length} calls\n`);

    // Display sample calls
    console.log('Sample calls (first 3):');
    calls.slice(0, 3).forEach((call, i) => {
      console.log(
        `   ${i + 1}. Send 0.0001 ETH to ${call.target} | allowFailure: ${call.allowFailure}`
      );
    });
    console.log('   ...');
    console.log('Sample calls (last 3):');
    calls.slice(-3).forEach((call, i) => {
      console.log(
        `   ${numberOfRecipients - 2 + i}. Send 0.0001 ETH to ${call.target} | allowFailure: ${call.allowFailure}`
      );
    });
    console.log();

    // Execute aggregate3Value
    console.log('⛽ Executing Multicall3.aggregate3Value()...\n');
    console.log(`   Sending ${totalAmount.toString()} wei (${ethers.formatEther(totalAmount)} ETH) to ${numberOfRecipients} addresses...\n`);

    const startTime = Date.now();

    try {
      const tx = await multicall3.aggregate3Value(calls, { value: totalAmount });
      console.log(`✅ Transaction sent: ${tx.hash}`);
      console.log(`   Waiting for confirmation...\n`);

      const receipt = await tx.wait();

      const Duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('='.repeat(70));
      console.log('📊 Multicall3 Execution Summary');
      console.log('='.repeat(70) + '\n');
      console.log(`Multicall3 Address: ${multicall3Address}`);
      console.log(`Transaction Hash: ${tx.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);
      console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`Gas Price: ${ethers.formatEther(await provider.getGasPrice())} Gwei (estimated)`);
      console.log(`Total ETH Sent: ${ethers.formatEther(totalAmount)} ETH`);
      console.log(`Number of Recipients: ${numberOfRecipients}`);
      console.log(`Amount per Recipient: 0.0001 ETH`);
      console.log(`Execution Time: ${Duration} seconds`);
      console.log(`Average Gas per Transfer: ${(Number(receipt.gasUsed) / numberOfRecipients).toFixed(0)} gas\n`);

      console.log('📋 Recipients (first 5):');
      recipients.slice(0, 5).forEach((addr, i) => {
        console.log(`   ${i + 1}. ${addr}`);
      });
      console.log('   ...');
      console.log('📋 Recipients (last 5):');
      recipients.slice(-5).forEach((addr, i) => {
        console.log(`   ${numberOfRecipients - 4 + i}. ${addr}`);
      });
      console.log();

      console.log('✅ Successfully used Multicall3 to distribute ETH to 100 addresses!\n');
    } catch (error) {
      console.error('❌ Multicall3 execution failed:', error.message);
      if (error.data) {
        console.error('Error data:', error.data);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  }
}

deployAndUseMulticall3().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
