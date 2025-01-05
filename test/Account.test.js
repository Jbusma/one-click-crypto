const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Account Proxy Deployment", function () {
    let implementation;
    let owner;
    let entryPoint;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy EntryPoint first
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPoint.deploy();
        await entryPoint.waitForDeployment();
        
        // Deploy Account implementation
        const Account = await ethers.getContractFactory("Account");
        implementation = await Account.deploy(await entryPoint.getAddress());
        await implementation.waitForDeployment();
    });

    it("can deploy minimal proxy pointing to implementation", async function () {
        const implementationAddress = await implementation.getAddress();
        
        // Create minimal proxy bytecode (EIP-1167)
        const proxyBytecode = 
            "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" +
            implementationAddress.slice(2) +  // remove 0x prefix
            "5af43d82803e903d91602b57fd5bf3";

        // Create deployment transaction
        const deployTx = {
            data: proxyBytecode
        };

        // Deploy proxy
        const proxyContract = await owner.sendTransaction(deployTx);
        const receipt = await proxyContract.wait();
        
        // Get deployed proxy address
        const proxyAddress = receipt.contractAddress;
        expect(proxyAddress).to.be.properAddress;
        
        // Verify proxy works by attaching Account ABI
        const proxy = await ethers.getContractAt("Account", proxyAddress);
        expect(await proxy.entryPoint()).to.equal(await entryPoint.getAddress());
        
        console.log("Deployed proxy at:", proxyAddress);
    });

    it("can calculate deterministic proxy address", async function () {
        const implementationAddress = await implementation.getAddress();
        const salt = ethers.zeroPadValue(owner.address, 32); // Use owner address as salt
        
        // Create minimal proxy bytecode (EIP-1167)
        const proxyBytecode = 
            "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" +
            implementationAddress.slice(2) +
            "5af43d82803e903d91602b57fd5bf3";

        // Calculate deterministic address (CREATE2)
        const proxyAddress = ethers.getCreate2Address(
            owner.address,  // deployer
            salt,          // salt
            ethers.keccak256(proxyBytecode) // init code hash
        );

        console.log("Predicted proxy address:", proxyAddress);
        expect(proxyAddress).to.be.properAddress;
    });
}); 