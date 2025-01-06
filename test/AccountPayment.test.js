const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createSignedUserOp, createPaymentOp, createApprovalOp, createShippingInfoOp } = require("./helpers/userOpHelper");

// Token amount constants
const INITIAL_SUPPLY = ethers.parseEther("1000000");     // 1M tokens
const ACCOUNT_FUNDING = ethers.parseEther("1000");       // 1000 tokens for testing
const PAYMENT_AMOUNT = ethers.parseEther("1");           // 1 token per payment
const APPROVAL_AMOUNT = ACCOUNT_FUNDING;                 // Approve full balance

describe("Account Payment with Shipping", function () {
    let implementation;
    let proxy;
    let owner;
    let entryPoint;
    let token;
    let merchant;
    let paymaster;

    async function mineBlocks(numBlocks) {
        for (let i = 0; i < numBlocks; i++) {
            await ethers.provider.send("evm_mine");
        }
    }

    // Helper to reset token balances
    async function resetTokenBalances(token, accounts) {
        for (const account of accounts) {
            const balance = await token.balanceOf(account);
            if (balance > 0n) {
                await token.connect(await ethers.getSigner(account)).transfer(owner.address, balance);
            }
        }
    }

    async function setupTest() {
        [owner, merchant] = await ethers.getSigners();
        
        // Deploy EntryPoint
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPoint.deploy();
        
        // Deploy test token
        const Token = await ethers.getContractFactory("contracts/OneClickToken.sol:OneClickCheckoutToken");
        token = await Token.deploy(INITIAL_SUPPLY); // 1M tokens
        
        // Deploy Account implementation
        const Account = await ethers.getContractFactory("Account");
        implementation = await Account.deploy(await entryPoint.getAddress());
        
        // Deploy paymaster
        const Paymaster = await ethers.getContractFactory("OneClickPaymaster");
        paymaster = await Paymaster.deploy(await entryPoint.getAddress());
        
        // Setup paymaster
        await paymaster.addStake(1, { value: ethers.parseEther("1") });
        await paymaster.deposit({ value: ethers.parseEther("1") });
        await paymaster.addSupportedToken(await token.getAddress(), 1);
        await paymaster.unlockStake();
        
        // Mine some blocks to ensure stake is unlocked
        await mineBlocks(2);
        
        // Deploy proxy
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        const proxyFactory = await ProxyFactory.deploy();
        
        // Create proxy for owner
        const tx = await proxyFactory.createProxy(
            await implementation.getAddress(),
            owner.address
        );
        const receipt = await tx.wait();
        const event = receipt.logs[0];
        const proxyAddress = event.args[2];
        
        // Attach Account interface to proxy
        proxy = await ethers.getContractAt("Account", proxyAddress);
        
        // Reset all token balances
        await resetTokenBalances(token, [proxyAddress, merchant.address]);
        
        // Fund proxy with fresh tokens
        await token.transfer(proxyAddress, ACCOUNT_FUNDING);
        await mineBlocks(1); // Ensure token transfer is processed
    }

    describe("Payment validation requirements", function () {
        beforeEach(async function () {
            await setupTest();
        });

        it("should revert payment when shipping info is not set", async function () {
            // Verify initial token balance
            const proxyAddress = await proxy.getAddress();
            const proxyBalance = await token.balanceOf(proxyAddress);
            expect(proxyBalance).to.equal(ACCOUNT_FUNDING);

            // First approve tokens for paymaster
            const approveOp = await createApprovalOp({
                sender: await proxy.getAddress(),
                signer: owner,
                entryPoint,
                tokenAddress: await token.getAddress(),
                spender: await paymaster.getAddress(),
                amount: APPROVAL_AMOUNT,
                paymasterAddress: await paymaster.getAddress()
            });
            const approveTx = await entryPoint.handleOps([approveOp], owner.address);
            await approveTx.wait();
            await mineBlocks(2);

            // Verify approval was successful
            const allowance = await token.allowance(proxyAddress, await paymaster.getAddress());
            expect(allowance).to.equal(APPROVAL_AMOUNT);

            // Verify balance is still correct
            const balanceAfterApproval = await token.balanceOf(proxyAddress);
            expect(balanceAfterApproval).to.equal(ACCOUNT_FUNDING);

            // Create payment operation
            const paymentOp = await createPaymentOp({
                sender: await proxy.getAddress(),
                signer: owner,
                entryPoint,
                tokenAddress: await token.getAddress(),
                to: merchant.address,
                amount: PAYMENT_AMOUNT,
                paymasterAddress: await paymaster.getAddress()
            });

            // Get initial state
            const initialNonce = await proxy.nonce();
            const initialMerchantBalance = await token.balanceOf(merchant.address);

            // The operation should fail during execution and emit a revert reason
            const tx = await entryPoint.handleOps([paymentOp], owner.address);
            const receipt = await tx.wait();

            // Find the UserOperationRevertReason event
            const revertEvent = receipt.logs.find(
                log => log.topics[0] === ethers.id("UserOperationRevertReason(bytes32,address,uint256,bytes)")
            );
            expect(revertEvent).to.not.be.undefined;

            // Verify state didn't change (except nonce)
            const finalNonce = await proxy.nonce();
            const finalMerchantBalance = await token.balanceOf(merchant.address);

            expect(finalNonce).to.equal(initialNonce + 1n);
            expect(finalMerchantBalance).to.equal(initialMerchantBalance);
        });
    });

    describe("Complete payment flow with shipping", function () {
        beforeEach(async function () {
            await setupTest();
        });

        it("should successfully process payment and emit shipping details", async function () {
            // First approve tokens for paymaster
            const approveOp = await createApprovalOp({
                sender: await proxy.getAddress(),
                signer: owner,
                entryPoint,
                tokenAddress: await token.getAddress(),
                spender: await paymaster.getAddress(),
                amount: APPROVAL_AMOUNT,
                paymasterAddress: await paymaster.getAddress()
            });
            await entryPoint.handleOps([approveOp], owner.address);

            // Then set shipping info
            const shippingInfo = {
                name: "John Doe",
                streetAddress: "123 Main St",
                city: "San Francisco",
                country: "USA",
                postalCode: "94105",
                email: "john@example.com"
            };

            const setShippingOp = await createShippingInfoOp({
                sender: await proxy.getAddress(),
                signer: owner,
                entryPoint,
                ...shippingInfo,
                tokenAddress: await token.getAddress(),
                paymasterAddress: await paymaster.getAddress()
            });
            await entryPoint.handleOps([setShippingOp], owner.address);

            // Then make payment
            const paymentOp = await createPaymentOp({
                sender: await proxy.getAddress(),
                signer: owner,
                entryPoint,
                tokenAddress: await token.getAddress(),
                to: merchant.address,
                amount: PAYMENT_AMOUNT,
                paymasterAddress: await paymaster.getAddress()
            });

            await expect(entryPoint.handleOps([paymentOp], owner.address))
                .to.emit(proxy, "PaymentWithShipping")
                .withArgs(
                    await proxy.getAddress(),
                    await token.getAddress(),
                    merchant.address,
                    PAYMENT_AMOUNT,
                    shippingInfo.name,
                    shippingInfo.streetAddress,
                    shippingInfo.city,
                    shippingInfo.country,
                    shippingInfo.postalCode,
                    shippingInfo.email
                );

            // Verify token transfer happened
            expect(await token.balanceOf(merchant.address))
                .to.equal(PAYMENT_AMOUNT);
        });
    });
}); 