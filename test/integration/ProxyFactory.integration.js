const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployments } = require("hardhat");

describe("ProxyFactory Integration", function () {
    let proxyFactory;
    let implementation;
    let owner;
    let entryPoint;

    before(async function () {
        // Deploy all contracts using the deployment scripts
        await deployments.fixture(['EntryPoint', 'ProxyFactory', 'Account']);
        [owner] = await ethers.getSigners();
        
        // Get the deployed contracts' addresses
        const entryPointDeployment = await deployments.get('EntryPoint');
        const proxyFactoryDeployment = await deployments.get('ProxyFactory');
        const accountDeployment = await deployments.get('Account');

        // Connect to the existing deployed contracts
        entryPoint = await ethers.getContractAt("EntryPoint", entryPointDeployment.address);
        proxyFactory = await ethers.getContractAt("ProxyFactory", proxyFactoryDeployment.address);
        implementation = await ethers.getContractAt("Account", accountDeployment.address);
    });

    it("works with deployed contracts", async function () {
        const proxyAddress = await proxyFactory.getAddress(await implementation.getAddress(), owner.address);
        expect(proxyAddress).to.be.properAddress;
        console.log("Integration test - Calculated proxy address:", proxyAddress);
    });
}); 