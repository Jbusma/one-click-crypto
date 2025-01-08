const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProxyFactory", function () {
    let proxyFactory;
    let implementation;
    let owner;
    let entryPoint;

    // Helper function to deploy and verify a proxy
    async function deployProxy(ownerAddress) {
        const tx = await proxyFactory.createProxy(
            await implementation.getAddress(),
            ownerAddress
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.eventName === "ProxyDeployed");
        const proxyAddress = event.args[2];

        // Verify code was deployed
        const code = await ethers.provider.getCode(proxyAddress);
        expect(code.length).to.be.gt(2, "No code at proxy address");

        return { 
            proxyAddress, 
            receipt,
            gasUsed: receipt.gasUsed 
        };
    }

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
        const Account = await ethers.getContractFactory("Account");
        implementation = await Account.deploy(await entryPoint.getAddress());
        await implementation.waitForDeployment();
    });

    it("should deploy proxy with correct implementation and owner", async function () {
        const { proxyAddress } = await deployProxy(owner.address);

        // Verify proxy is initialized correctly
        const proxy = await ethers.getContractAt("Account", proxyAddress);
        expect(await proxy.owner()).to.equal(owner.address);
        expect(await proxy.entryPoint()).to.equal(await entryPoint.getAddress());
    });

    it("should deploy to predicted address using CREATE2", async function () {
        // Calculate predicted address
        const salt = ethers.zeroPadValue(owner.address, 32);
        const deploymentData = ethers.concat([
            "0x3d602d80600a3d3981f3363d3d373d3d3d363d73",
            ethers.zeroPadValue(await implementation.getAddress(), 20),
            "0x5af43d82803e903d91602b57fd5bf3"
        ]);
        const predictedAddress = ethers.getCreate2Address(
            await proxyFactory.getAddress(),
            salt,
            ethers.keccak256(deploymentData)
        );

        // Deploy and verify
        const { proxyAddress } = await deployProxy(owner.address);
        expect(proxyAddress).to.equal(predictedAddress);
    });

    it("should deploy to same address given same parameters", async function () {
        // Deploy twice with same parameters
        const { proxyAddress: address1 } = await deployProxy(owner.address);
        await deployProxy(owner.address);

        // Verify first proxy still exists and has code
        const code = await ethers.provider.getCode(address1);
        expect(code.length).to.be.gt(2);
    });

    it("should optimize gas when proxy already exists", async function () {
        // First deployment
        const { gasUsed: gas1 } = await deployProxy(owner.address);

        // Second deployment should use less gas
        const { gasUsed: gas2 } = await deployProxy(owner.address);
        expect(gas2).to.be.lt(110000);
        expect(gas2).to.be.lt(gas1);
    });

    it("should deploy to different addresses for different owners", async function () {
        const [_, addr1, addr2] = await ethers.getSigners();

        // Deploy for two different owners
        const { proxyAddress: address1 } = await deployProxy(addr1.address);
        const { proxyAddress: address2 } = await deployProxy(addr2.address);

        // Verify addresses are different but both have code
        expect(address1).to.not.equal(address2);
        const code1 = await ethers.provider.getCode(address1);
        const code2 = await ethers.provider.getCode(address2);
        expect(code1.length).to.be.gt(2);
        expect(code2.length).to.be.gt(2);
    });
}); 