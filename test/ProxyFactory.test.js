const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProxyFactory", function () {
    let proxyFactory;
    let implementation;
    let owner;
    let entryPoint;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy EntryPoint first
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPoint.deploy();
        await entryPoint.waitForDeployment();

        // Deploy ProxyFactory
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        await proxyFactory.waitForDeployment();
        
        // Deploy Account implementation with EntryPoint
        const DummyContract = await ethers.getContractFactory("Account");
        implementation = await DummyContract.deploy(await entryPoint.getAddress());
        await implementation.waitForDeployment();
    });

    it("calculates deterministic address", async function () {
        const proxyAddress = await proxyFactory.getAddress(await implementation.getAddress(), owner.address);
        expect(proxyAddress).to.be.properAddress;
        console.log("Calculated proxy address:", proxyAddress);
    });
}); 