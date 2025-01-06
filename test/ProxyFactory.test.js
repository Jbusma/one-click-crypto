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
        const Account = await ethers.getContractFactory("Account");
        implementation = await Account.deploy(await entryPoint.getAddress());
        await implementation.waitForDeployment();
    });

    it("deploys proxy with correct implementation and owner", async function () {
        // Deploy proxy
        const tx = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt = await tx.wait();
        
        // Get proxy address from event
        const event = receipt.logs[0];
        const [implementation_, owner_, proxyAddress] = event.args;

        // Verify proxy was deployed with code
        const code = await ethers.provider.getCode(proxyAddress);
        expect(code.length).to.be.gt(2);

        // Verify proxy is initialized correctly
        const proxy = await ethers.getContractAt("Account", proxyAddress);
        expect(await proxy.owner()).to.equal(owner.address);
        expect(await proxy.entryPoint()).to.equal(await entryPoint.getAddress());
    });

    it("deploys to predicted address", async function () {
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

        // Deploy proxy
        const tx = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => log.eventName === "ProxyDeployed");
        const deployedAddress = event.args[2];

        // Verify deployed address matches prediction
        expect(deployedAddress).to.equal(predictedAddress);

        // Verify code was deployed
        const code = await ethers.provider.getCode(deployedAddress);
        expect(code.length).to.be.gt(2);
    });

    it("deploys to same address given same parameters", async function () {
        // Deploy first proxy
        const tx1 = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt1 = await tx1.wait();
        const event1 = receipt1.logs.find(log => log.eventName === "ProxyDeployed");
        const address1 = event1.args[2];

        // Try to deploy again with same parameters
        await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        
        // Get code at address1 to verify it still exists
        const code = await ethers.provider.getCode(address1);
        expect(code.length).to.be.gt(2);
    });

    it("doesn't redeploy if proxy exists", async function () {
        // Deploy first time
        const tx1 = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt1 = await tx1.wait();

        // Deploy second time with same parameters
        const tx2 = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt2 = await tx2.wait();

        // Second deployment should use less gas since proxy exists
        expect(receipt2.gasUsed).to.be.lt(110000);
    });

    it("deploys to different addresses for different owners", async function () {
        const [_, addr1, addr2] = await ethers.getSigners();

        // Deploy for first owner
        const tx1 = await proxyFactory.createProxy(
            await implementation.getAddress(),
            addr1.address
        );
        const receipt1 = await tx1.wait();
        const event1 = receipt1.logs.find(log => log.eventName === "ProxyDeployed");
        const address1 = event1.args[2];

        // Deploy for second owner
        const tx2 = await proxyFactory.createProxy(
            await implementation.getAddress(),
            addr2.address
        );
        const receipt2 = await tx2.wait();
        const event2 = receipt2.logs.find(log => log.eventName === "ProxyDeployed");
        const address2 = event2.args[2];

        // Addresses should be different
        expect(address1).to.not.equal(address2);

        // Both should have code
        const code1 = await ethers.provider.getCode(address1);
        const code2 = await ethers.provider.getCode(address2);
        expect(code1.length).to.be.gt(2);
        expect(code2.length).to.be.gt(2);
    });
}); 