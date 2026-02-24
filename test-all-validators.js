#!/usr/bin/env node

/**
 * EVM Connection Test Script for All 4 Validators
 * Tests: Chain ID, Balance, Token Transfer, Contract Deployment
 * Uses ERC20MinterBurnerDecimals from contracts/solidity/
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

async function testValidator(validator) {
  const { id, rpcUrl, name } = validator;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔗 Testing Validator ${id}: ${name}`);
  console.log(`   RPC URL: ${rpcUrl}`);
  console.log('='.repeat(70) + '\n');

  try {
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer = wallet.connect(provider);

    console.log('✅ Connected to provider\n');

    // 1. Test Chain ID
    console.log('📋 Test 1: Get Chain ID');
    const network = await provider.getNetwork();
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Network: ${network.name}\n`);

    // 2. Test Balance
    console.log('💰 Test 2: Get Account Balance');
    const address = await signer.getAddress();
    console.log(`   Address: ${address}`);

    const balance = await provider.getBalance(address);
    const balanceInEther = ethers.formatEther(balance);
    console.log(`   Balance: ${balanceInEther} ETH (${balance.toString()} wei)\n`);

    // 3. Test Token Transfer (sending native tokens)
    console.log('📤 Test 3: Send Native Tokens');
    console.log(`   From: ${address}`);
    console.log(`   To: ${RECIPIENT_ADDRESS}`);
    console.log(`   Amount: 1 ETH`);

    const sendTx = await signer.sendTransaction({
      to: RECIPIENT_ADDRESS,
      value: ethers.parseEther('1.0'),
    });

    console.log(`   Transaction Hash: ${sendTx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await sendTx.wait();
    console.log(`   ✅ Confirmed in block: ${receipt.blockNumber}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}\n`);

    // 4. Deploy ERC20 Contract
    console.log('🤖 Test 4: Deploy ERC20MinterBurnerDecimals Contract');

    const contractFactory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, signer);
    console.log(`   Deploying "TestToken" (TTK) with 18 decimals...`);

    // Deploy with constructor args: name, symbol, decimals
    const deployTx = await contractFactory.deploy('TestToken', 'TTK', 18);
    console.log(`   Transaction Hash: ${deployTx.deploymentTransaction().hash}`);
    console.log(`   Waiting for confirmation...`);

    await deployTx.waitForDeployment();
    const contractAddress = await deployTx.getAddress();

    console.log(`   ✅ Contract deployed at: ${contractAddress}\n`);

    // 5. Interact with deployed contract
    console.log('📝 Test 5: Interact with ERC20 Contract');
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, signer);

    // Mint tokens
    const mintAmount = ethers.parseEther('1000'); // 1000 TTK tokens
    console.log(`   Minting 1000 TTK tokens...`);
    const mintTx = await contract.mint(address, mintAmount);
    console.log(`   Transaction Hash: ${mintTx.hash}`);
    const mintReceipt = await mintTx.wait();
    console.log(`   ✅ Confirmed in block: ${mintReceipt.blockNumber}`);

    // Check balance
    const tokenBalance = await contract.balanceOf(address);
    console.log(`   Token balance: ${ethers.formatEther(tokenBalance)} TTK\n`);

    // Transfer tokens to recipient
    console.log(`   Transferring 100 TTK to ${RECIPIENT_ADDRESS}...`);
    const transferAmount = ethers.parseEther('100');
    const transferTx = await contract.transfer(RECIPIENT_ADDRESS, transferAmount);
    console.log(`   Transaction Hash: ${transferTx.hash}`);
    const transferReceipt = await transferTx.wait();
    console.log(`   ✅ Confirmed in block: ${transferReceipt.blockNumber}`);

    // Check final balance
    const finalTokenBalance = await contract.balanceOf(address);
    const recipientTokenBalance = await contract.balanceOf(RECIPIENT_ADDRESS);
    console.log(`   Sender balance: ${ethers.formatEther(finalTokenBalance)} TTK`);
    console.log(`   Recipient balance: ${ethers.formatEther(recipientTokenBalance)} TTK\n`);

    // 6. Summary
    console.log('✅ All Tests Passed for Validator ' + id + '!\n');
    console.log('Summary:');
    console.log(`  • Chain ID: ${network.chainId}`);
    console.log(`  • Account: ${address}`);
    console.log(`  • Balance: ${balanceInEther} ETH`);
    console.log(`  • Transfer: 1 ETH sent successfully`);
    console.log(`  • ERC20 deployed at: ${contractAddress}`);
    console.log(`  • Minted 1000 TTK tokens`);
    console.log(`  • Transferred 100 TTK tokens`);
    console.log(`  • Final sender balance: ${ethers.formatEther(finalTokenBalance)} TTK`);
    console.log(`  • Final recipient balance: ${ethers.formatEther(recipientTokenBalance)} TTK`);

    return { success: true, validatorId: id, validatorName: name };
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    return { success: false, validatorId: id, validatorName: name, error: error.message };
  }
}

async function testAllValidators() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Testing All 4 Validators');
  console.log('='.repeat(70));

  const results = [];

  for (const validator of VALIDATORS) {
    const result = await testValidator(validator);
    results.push(result);
    // Small delay between validators to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Final Summary');
  console.log('='.repeat(70) + '\n');

  let passCount = 0;
  let failCount = 0;

  results.forEach(result => {
    if (result.success) {
      console.log(`✅ Validator ${result.validatorId} (${result.validatorName}): PASSED`);
      passCount++;
    } else {
      console.log(`❌ Validator ${result.validatorId} (${result.validatorName}): FAILED - ${result.error}`);
      failCount++;
    }
  });

  console.log(`\nTotal: ${passCount} passed, ${failCount} failed\n`);
  
  if (failCount === 0) {
    console.log('🎉 All validators tested successfully!\n');
  }
}

testAllValidators().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
