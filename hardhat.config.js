require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

task("restart-node", "Kills any running node on port 8545 and starts a new one")
  .setAction(async () => {
    try {
      // Kill any process on port 8545
      await execAsync("lsof -ti tcp:8545 | xargs kill -9");
    } catch (error) {
      // Ignore error if no process was found
    }
    // Start new node
    await hre.run("node");
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
};