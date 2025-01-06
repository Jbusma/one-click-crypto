const { ethers } = require("hardhat");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // Deploy EntryPoint
    const entryPoint = await deploy("EntryPoint", {
        from: deployer,
        args: [],
        log: true,
        tags: ["EntryPoint"],
    });

    // Deploy Account implementation
    const account = await deploy("Account", {
        from: deployer,
        args: [entryPoint.address],
        log: true,
        tags: ["Account"],
    });

    // Deploy ProxyFactory
    const proxyFactory = await deploy("ProxyFactory", {
        from: deployer,
        args: [],
        log: true,
        tags: ["ProxyFactory"],
    });
};

module.exports.tags = ["EntryPoint", "Account", "ProxyFactory"]; 