require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    }
  },
  networks:{
    localhost:{
      url:"http://127.0.0.1:8545",
      accounts: ['0x88cbead91aee890d27bf06e003ade3d4e952427e88f88d31d61d3ef5e5d54305']
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    }
  },
  etherscan: {
    apiKey: {
      localhost: 'empty'
    },
    customChains: [
      {
        network: "localhost",
        chainId: 262144,
        urls: {
          apiURL: "http://localhost/api",
          browserURL: "http://localhost"
        }
      }
    ]
  },
};
