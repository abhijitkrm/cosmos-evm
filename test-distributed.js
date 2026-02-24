#!/usr/bin/env node

/**
 * Distributed EVM Test Script
 * Runs 5 sequential tests across 4 validators in round-robin fashion
 * Test 1 on Node 0, Test 2 on Node 1, Test 3 on Node 2, Test 4 on Node 3, Test 5 on Node 0
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Validator RPC URLs
const VALIDATORS = [
  { id: 0, rpcUrl: 'http://localhost:8545', name: 'evmdnode0' },
  { id: 1, rpcUrl: 'http://localhost:8555', name: 'evmdnode1' },
  { id: 2, rpcUrl: 'http://localhost:8565', name: 'evmdnode2' },
  { id: 3, rpcUrl: 'http://localhost:8575', name: 'evmdnode3' },
];

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305'; // dev0
const RECIPIENT_ADDRESS = '0x963EBDf2e1f8DB8707D05FC75bfeFFBa1B5BaC17'; // dev1

// Load ERC20MinterBurnerDecimals contract from contracts/solidity/
const contractJsonPath = path.join(__dirname, 'contracts', 'solidity', 'ERC20MinterBurnerDecimals.json');
let ERC20_ABI = [];
let ERC20_BYTECODE = '';

try {
  const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
  ERC20_ABI = contractJson.abi;
  ERC20_BYTECODE = contractJson.bytecode;
} catch (error) {
  console.error('❌ Failed to load contract JSON:', error.message);
  process.exit(1);
}

// Store shared state across tests
let sharedState = {
  address: null,
  contractAddress: null,
  network: null,
};

async function getValidatorByIndex(testIndex) {
  return VALIDATORS[testIndex % VALIDATORS.length];
}

async function test1_GetChainID() {
  const validator = await getValidatorByIndex(0);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test 1: Get Chain ID`);
  console.log(`📋 Using Validator ${validator.id} (${validator.name})`);
  console.log(`   RPC URL: ${validator.rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    const provider = new ethers.JsonRpcProvider(validator.rpcUrl);
    const network = await provider.getNetwork();
    
    sharedState.network = network;
    sharedState.address = new ethers.Wallet(PRIVATE_KEY).address;
    
    console.log(`✅ Test 1 Passed:`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Network: ${network.name}`);
    console.log(`   Account Address: ${sharedState.address}\n`);
    
    return { success: true, validator: validator.id };
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
    return { success: false, validator: validator.id, error: error.message };
  }
}

async function test2_GetBalance() {
  const validator = await getValidatorByIndex(1);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test 2: Get Account Balance`);
  console.log(`💰 Using Validator ${validator.id} (${validator.name})`);
  console.log(`   RPC URL: ${validator.rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    const provider = new ethers.JsonRpcProvider(validator.rpcUrl);
    const balance = await provider.getBalance(sharedState.address);
    const balanceInEther = ethers.formatEther(balance);
    
    console.log(`✅ Test 2 Passed:`);
    console.log(`   Address: ${sharedState.address}`);
    console.log(`   Balance: ${balanceInEther} ETH (${balance.toString()} wei)\n`);
    
    return { success: true, validator: validator.id };
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
    return { success: false, validator: validator.id, error: error.message };
  }
}

async function test3_SendNativeTokens() {
  const validator = await getValidatorByIndex(2);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test 3: Send Native Tokens`);
  console.log(`📤 Using Validator ${validator.id} (${validator.name})`);
  console.log(`   RPC URL: ${validator.rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    const provider = new ethers.JsonRpcProvider(validator.rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);

    console.log(`   Sending 1 ETH from ${sharedState.address}`);
    console.log(`   To: ${RECIPIENT_ADDRESS}`);
    console.log(`   Waiting for confirmation...`);

    const sendTx = await signer.sendTransaction({
      to: RECIPIENT_ADDRESS,
      value: ethers.parseEther('1.0'),
    });

    const receipt = await sendTx.wait();
    
    console.log(`✅ Test 3 Passed:`);
    console.log(`   Transaction Hash: ${sendTx.hash}`);
    console.log(`   Confirmed in block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);
    
    return { success: true, validator: validator.id };
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
    return { success: false, validator: validator.id, error: error.message };
  }
}

async function test4_DeployContract() {
  const validator = await getValidatorByIndex(3);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test 4: Deploy ERC20MinterBurnerDecimals Contract`);
  console.log(`🤖 Using Validator ${validator.id} (${validator.name})`);
  console.log(`   RPC URL: ${validator.rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    const provider = new ethers.JsonRpcProvider(validator.rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);

    const contractFactory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, signer);
    
    console.log(`   Deploying "TestToken" (TTK) with 18 decimals...`);
    console.log(`   Waiting for confirmation...`);

    const deployTx = await contractFactory.deploy('TestToken', 'TTK', 18);
    await deployTx.waitForDeployment();
    const contractAddress = await deployTx.getAddress();
    
    sharedState.contractAddress = contractAddress;

    console.log(`✅ Test 4 Passed:`);
    console.log(`   Transaction Hash: ${deployTx.deploymentTransaction().hash}`);
    console.log(`   Contract deployed at: ${contractAddress}\n`);
    
    return { success: true, validator: validator.id };
  } catch (error) {
    console.error('❌ Test 4 Failed:', error.message);
    return { success: false, validator: validator.id, error: error.message };
  }
}

async function test5_InteractWithContract() {
  const validator = await getValidatorByIndex(4);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Test 5: Interact with ERC20 Contract`);
  console.log(`📝 Using Validator ${validator.id} (${validator.name})`);
  console.log(`   RPC URL: ${validator.rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    const provider = new ethers.JsonRpcProvider(validator.rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);

    const contract = new ethers.Contract(sharedState.contractAddress, ERC20_ABI, signer);

    // Mint tokens
    console.log(`   Minting 1000 TTK tokens...`);
    const mintAmount = ethers.parseEther('1000');
    const mintTx = await contract.mint(sharedState.address, mintAmount);
    const mintReceipt = await mintTx.wait();

    // Check balance
    const tokenBalance = await contract.balanceOf(sharedState.address);

    // Transfer tokens
    console.log(`   Transferring 100 TTK to ${RECIPIENT_ADDRESS}...`);
    const transferAmount = ethers.parseEther('100');
    const transferTx = await contract.transfer(RECIPIENT_ADDRESS, transferAmount);
    const transferReceipt = await transferTx.wait();

    // Check final balances
    const finalTokenBalance = await contract.balanceOf(sharedState.address);
    const recipientTokenBalance = await contract.balanceOf(RECIPIENT_ADDRESS);

    console.log(`✅ Test 5 Passed:`);
    console.log(`   Mint Tx Hash: ${mintTx.hash} (Block: ${mintReceipt.blockNumber})`);
    console.log(`   Token balance: ${ethers.formatEther(tokenBalance)} TTK`);
    console.log(`   Transfer Tx Hash: ${transferTx.hash} (Block: ${transferReceipt.blockNumber})`);
    console.log(`   Sender balance: ${ethers.formatEther(finalTokenBalance)} TTK`);
    console.log(`   Recipient balance: ${ethers.formatEther(recipientTokenBalance)} TTK\n`);
    
    return { success: true, validator: validator.id };
  } catch (error) {
    console.error('❌ Test 5 Failed:', error.message);
    return { success: false, validator: validator.id, error: error.message };
  }
}

async function runDistributedTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Distributed EVM Tests (1 test per validator, round-robin)');
  console.log('='.repeat(70));

  const results = [];

  // Run tests sequentially with small delay
  console.log('\nTest Distribution:');
  console.log('  • Test 1: Chain ID       → Node 0');
  console.log('  • Test 2: Balance        → Node 1');
  console.log('  • Test 3: Send tokens    → Node 2');
  console.log('  • Test 4: Deploy contract → Node 3');
  console.log('  • Test 5: Interact       → Node 0 (wraps around)');

  // Run tests
  results.push(await test1_GetChainID());
  await new Promise(resolve => setTimeout(resolve, 500));

  results.push(await test2_GetBalance());
  await new Promise(resolve => setTimeout(resolve, 500));

  results.push(await test3_SendNativeTokens());
  await new Promise(resolve => setTimeout(resolve, 500));

  results.push(await test4_DeployContract());
  await new Promise(resolve => setTimeout(resolve, 500));

  results.push(await test5_InteractWithContract());

  // Print final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary');
  console.log('='.repeat(70) + '\n');

  let passCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const testNum = index + 1;
    if (result.success) {
      console.log(`✅ Test ${testNum} on Node ${result.validator}: PASSED`);
      passCount++;
    } else {
      console.log(`❌ Test ${testNum} on Node ${result.validator}: FAILED - ${result.error}`);
      failCount++;
    }
  });

  console.log(`\nTotal: ${passCount} passed, ${failCount} failed\n`);
  
  if (failCount === 0) {
    console.log('🎉 All tests passed!\n');
  }
}

runDistributedTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
