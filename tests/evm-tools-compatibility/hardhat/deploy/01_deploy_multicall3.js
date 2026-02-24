module.exports = async ({ getNamedAccounts, deployments, ethers }) => {
  const { deploy } = deployments;
  let deployer;
  
  try {
    const accounts = await getNamedAccounts();
    deployer = accounts.deployer;
  } catch (e) {
    // Fallback if getNamedAccounts fails
    const signers = await ethers.getSigners();
    deployer = signers[0].address;
  }

  console.log('Deploying Multicall3...');
  console.log(`Deployer: ${deployer}`);

  const deployment = await deploy('Multicall3', {
    from: deployer,
    log: true,
  });

  console.log(`✅ Multicall3 deployed at: ${deployment.address}`);

  return { Multicall3: deployment.address };
};

module.exports.tags = ['Multicall3'];
