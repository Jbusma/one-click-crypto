const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployments, getNamedAccounts } = require("hardhat");

describe("ProxyFactory Integration", function () {
    let proxyFactory;
    let accountImplementation;
    let entryPoint;

    before(async function () {
        // Deploy all contracts
        await deployments.fixture(["Account", "ProxyFactory", "EntryPoint"]);

        // Get deployed contracts
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        const Account = await ethers.getContractFactory("Account");
        const EntryPoint = await ethers.getContractFactory("EntryPoint");

        proxyFactory = ProxyFactory.attach((await deployments.get("ProxyFactory")).address);
        accountImplementation = Account.attach((await deployments.get("Account")).address);
        entryPoint = EntryPoint.attach((await deployments.get("EntryPoint")).address);
    });

    it("works with deployed contracts", async function () {
        const [owner] = await ethers.getSigners();
        
        // Calculate deterministic address
        const expectedAddress = await proxyFactory.getAddress(
            await accountImplementation.getAddress(),
            owner.address
        );

        // Deploy proxy
        await proxyFactory.createProxy(
            await accountImplementation.getAddress(),
            owner.address
        );

        // Verify proxy was deployed to expected address
        const code = await ethers.provider.getCode(expectedAddress);
        expect(code.length).to.be.gt(2); // Has code
    });
}); 