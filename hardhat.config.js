require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
const fs = require('fs');
const path = require('path');

task("clean-deployments", "Cleans the deployments folder", async () => {
  const deploymentsPath = path.join(__dirname, "deployments");
  if (fs.existsSync(deploymentsPath)) {
    fs.rmSync(deploymentsPath, { recursive: true, force: true });
    console.log("Deployments folder cleaned");
  }
});

task("redeploy", "Cleans and redeploys the contracts")
  .setAction(async (taskArgs, hre) => {
    // Run the default clean task
    await hre.run("clean");

    // Clean the deployments folder
    await hre.run("clean-deployments");

    // Deploy the contracts
    await hre.run("deploy");
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "localhost",
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // By default, use the first account as the deployer
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
  },
}