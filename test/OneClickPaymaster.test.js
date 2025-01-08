const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createSignedUserOp, createApprovalOp } = require("./helpers/userOpHelper");

// Constants
const BLOCKS_PER_PERIOD = 7200;
const INITIAL_SUPPLY = ethers.parseEther("1000000");     // 1M tokens
const ACCOUNT_FUNDING = ethers.parseEther("1000");       // 1000 tokens for testing
const PAYMENT_AMOUNT = ethers.parseEther("1");           // 1 token per payment
const APPROVAL_AMOUNT = ACCOUNT_FUNDING;                 // Approve full balance
const STAKE_AMOUNT = ethers.parseEther("1");            // 1 ETH stake
const DEPOSIT_AMOUNT = ethers.parseEther("1");          // 1 ETH deposit

describe("OneClickPaymaster Rate Limiting", function () {
    let paymaster;
    let entryPoint;
    let owner;
    let user;
    let token;
    let proxyAddress;

    async function mineBlocks(numBlocks) {
        for (let i = 0; i < numBlocks; i++) {
            await ethers.provider.send("evm_mine");
        }
    }

    async function createTransferOp(nonce) {
        return createSignedUserOp({
            sender: proxyAddress,
            signer: user,
            entryPoint,
            callData: "0x",
            tokenAddress: await token.getAddress(),
            paymasterAddress: await paymaster.getAddress(),
            nonce
        });
    }

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        
        // Deploy EntryPoint
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPoint.deploy();
        
        // Deploy test token
        const Token = await ethers.getContractFactory("contracts/OneClickToken.sol:OneClickCheckoutToken");
        token = await Token.deploy(INITIAL_SUPPLY);
        
        // Deploy Account implementation
        const Account = await ethers.getContractFactory("Account");
        const accountImplementation = await Account.deploy(await entryPoint.getAddress());
        
        // Deploy ProxyFactory
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        proxyFactory = await ProxyFactory.deploy();
        
        // Deploy proxy for user - note we're using user.address as owner
        const tx = await proxyFactory.connect(user).createProxy(
            await accountImplementation.getAddress(),
            user.address
        );
        const receipt = await tx.wait();
        
        // Get proxy address from event
        const event = receipt.logs[0];
        const [impl, , proxyAddr] = event.args;
        proxyAddress = proxyAddr;
        
        // Deploy Paymaster
        const Paymaster = await ethers.getContractFactory("OneClickPaymaster");
        paymaster = await Paymaster.deploy(await entryPoint.getAddress());
        
        // Add token to supported tokens
        await paymaster.addSupportedToken(await token.getAddress(), 1);
        
        // Fund proxy with tokens
        await token.transfer(proxyAddress, ACCOUNT_FUNDING);

        // Add stake to paymaster
        await paymaster.addStake(1, { value: STAKE_AMOUNT });
        await paymaster.deposit({ value: DEPOSIT_AMOUNT });
        
        // Unlock stake
        await paymaster.unlockStake();
        // Mine some blocks to ensure stake is unlocked
        await mineBlocks(1);
    });

    describe("Rate limiting behavior", function () {
        beforeEach(async function () {
            // Approve tokens first
            const approveOp = await createApprovalOp({
                sender: proxyAddress,
                signer: user,
                entryPoint,
                tokenAddress: await token.getAddress(),
                spender: await paymaster.getAddress(),
                amount: APPROVAL_AMOUNT,
                paymasterAddress: await paymaster.getAddress()
            });
            await entryPoint.handleOps([approveOp], owner.address);
        });

        it("should allow exactly 3 operations within a single period", async function () {
            // Try 3 operations - all should succeed
            for(let i = 1; i < 4; i++) {
                const userOp = await createTransferOp(i);
                await entryPoint.handleOps([userOp], owner.address);
            }
        });

        it("should reset attempt counter after period expiration", async function () {
            // Use up all attempts
            for (let i = 1; i < 4; i++) {
                await entryPoint.handleOps([await createTransferOp(i)], owner.address);
            }

            // Mine blocks to pass the period
            await mineBlocks(BLOCKS_PER_PERIOD);

            // Should be able to attempt again
            await entryPoint.handleOps([await createTransferOp(4)], owner.address);
        });

        it("should accurately track and report remaining attempts", async function () {
            expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(3);

            // Use one attempt
            await entryPoint.handleOps([await createTransferOp(1)], owner.address);
            expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(2);

            // Mine blocks to pass the period
            await mineBlocks(BLOCKS_PER_PERIOD);
            expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(3);
        });

        it("should reject the 4th operation within a single period", async function () {
            // Use up all 3 attempts
            for(let i = 1; i < 4; i++) {
                const userOp = await createTransferOp(i);
                await entryPoint.handleOps([userOp], owner.address);
            }

            // Try 4th attempt - should revert
            const userOp = await createTransferOp(4);
            try {
                await entryPoint.handleOps([userOp], owner.address);
                expect.fail("Should have reverted");
            } catch (error) {
                // The error data is nested inside the FailedOp error
                expect(error.message).to.include("AA33 reverted");
                
                // Verify rate limit through remaining attempts
                const remaining = await paymaster.getRemainingAttempts(proxyAddress);
                expect(remaining).to.equal(0);
            }
        });
    });
}); 