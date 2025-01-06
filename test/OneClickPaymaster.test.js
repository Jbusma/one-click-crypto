const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OneClickPaymaster Rate Limiting", function () {
    let paymaster;
    let entryPoint;
    let owner;
    let user;
    let token;
    const BLOCKS_PER_PERIOD = 7200;
    let proxyAddress;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        
        // Deploy EntryPoint
        const EntryPoint = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPoint.deploy();
        
        // Deploy test token
        const Token = await ethers.getContractFactory("contracts/OneClickToken.sol:OneClickCheckoutToken");
        token = await Token.deploy("1000000000000000000000000"); // 1M tokens
        
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
        
        // Verify proxy code exists
        const code = await ethers.provider.getCode(proxyAddress);
        
        // Deploy Paymaster
        const Paymaster = await ethers.getContractFactory("OneClickPaymaster");
        paymaster = await Paymaster.deploy(await entryPoint.getAddress());
        
        // Add token to supported tokens
        await paymaster.addSupportedToken(await token.getAddress(), 1);
        
        // Fund proxy with tokens
        await token.transfer(proxyAddress, "1000000000000000000000"); // 1000 tokens

        // Add stake to paymaster
        await paymaster.addStake(1, { value: ethers.parseEther("1") });
        await paymaster.deposit({ value: ethers.parseEther("1") });
        
        // Unlock stake
        await paymaster.unlockStake();
        // Mine some blocks to ensure stake is unlocked
        await mineBlocks(1);
    });

    async function createUserOp(nonce, override = null) {
        const tokenAddress = await token.getAddress();
        const paymasterAddress = await paymaster.getAddress();

        const iface = new ethers.Interface([
            "function execute(address dest, uint256 value, bytes calldata data)"
        ]);

        const tokenIface = new ethers.Interface([
            "function transfer(address to, uint256 amount)"
        ]);

        const callData = override ? 
            iface.encodeFunctionData("execute", [override.dest, override.value, override.data]) :
            iface.encodeFunctionData("execute", [
                tokenAddress,
                0,
                tokenIface.encodeFunctionData("transfer", [owner.address, "1000000000000000000"])
            ]);

        const userOp = {
            sender: proxyAddress,
            nonce,
            initCode: "0x",
            callData,
            callGasLimit: 500000,
            verificationGasLimit: 500000,
            preVerificationGas: 50000,
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
            paymasterAndData: ethers.concat([
                paymasterAddress,
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256"],
                    [tokenAddress, "1000000000000000000"]
                )
            ]),
            signature: "0x"
        };

        // Calculate UserOp hash
        const userOpHash = await entryPoint.getUserOpHash(userOp);
        
        // Sign the hash directly
        const signature = await user.signMessage(ethers.getBytes(userOpHash));
        userOp.signature = signature;
        
        return userOp;
    }

    async function mineBlocks(numBlocks) {
        for (let i = 0; i < numBlocks; i++) {
            await ethers.provider.send("evm_mine");
        }
    }

    it("allows 3 attempts within a period", async function () {
        // Approve tokens first - note we need to approve through the proxy
        const tokenIface = new ethers.Interface([
            "function approve(address spender, uint256 amount)"
        ]);
        const approveOp = await createUserOp(0, {
            dest: await token.getAddress(),
            value: 0,
            data: tokenIface.encodeFunctionData("approve", [await paymaster.getAddress(), "1000000000000000000000"])
        });
        await entryPoint.handleOps([approveOp], owner.address);

        // Try 3 operations
        for(let i = 1; i < 4; i++) {
            const userOp = await createUserOp(i);
            await entryPoint.handleOps([userOp], owner.address);
        }
    });

    it("resets attempts after period expires", async function () {
        // Approve tokens first - note we need to approve through the proxy
        const tokenIface = new ethers.Interface([
            "function approve(address spender, uint256 amount)"
        ]);
        const approveOp = await createUserOp(0, {
            dest: await token.getAddress(),
            value: 0,
            data: tokenIface.encodeFunctionData("approve", [await paymaster.getAddress(), "1000000000000000000000"])
        });
        await entryPoint.handleOps([approveOp], owner.address);

        // Use up all attempts
        for (let i = 1; i < 4; i++) {
            await entryPoint.handleOps([await createUserOp(i)], owner.address);
        }

        // Mine blocks to pass the period
        await mineBlocks(BLOCKS_PER_PERIOD);

        // Should be able to attempt again
        await entryPoint.handleOps([await createUserOp(4)], owner.address);
    });

    it("correctly reports remaining attempts", async function () {
        // Approve tokens first - note we need to approve through the proxy
        const tokenIface = new ethers.Interface([
            "function approve(address spender, uint256 amount)"
        ]);
        const approveOp = await createUserOp(0, {
            dest: await token.getAddress(),
            value: 0,
            data: tokenIface.encodeFunctionData("approve", [await paymaster.getAddress(), "1000000000000000000000"])
        });
        await entryPoint.handleOps([approveOp], owner.address);

        expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(3);

        // Use one attempt
        await entryPoint.handleOps([await createUserOp(1)], owner.address);

        expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(2);

        // Mine blocks to pass the period
        await mineBlocks(BLOCKS_PER_PERIOD);

        expect(await paymaster.getRemainingAttempts(proxyAddress)).to.equal(3);
    });

    it("denies 4th attempt within period", async function () {
        // Approve tokens first
        const tokenIface = new ethers.Interface([
            "function approve(address spender, uint256 amount)"
        ]);
        const approveOp = await createUserOp(0, {
            dest: await token.getAddress(),
            value: 0,
            data: tokenIface.encodeFunctionData("approve", [await paymaster.getAddress(), "1000000000000000000000"])
        });
        await entryPoint.handleOps([approveOp], owner.address);

        // Use up all 3 attempts
        for(let i = 1; i < 4; i++) {
            const userOp = await createUserOp(i);
            await entryPoint.handleOps([userOp], owner.address);
        }

        // Try 4th attempt - should revert
        const userOp = await createUserOp(4);
        try {
            await entryPoint.handleOps([userOp], owner.address);
            expect.fail("Should have reverted");
        } catch (error) {
            // The error data is nested inside the FailedOp error
            // FailedOp contains: opIndex (0) and message containing the nested error
            expect(error.message).to.include("AA33 reverted");
            
            // We can also verify the rate limit by checking the remaining attempts
            const remaining = await paymaster.getRemainingAttempts(proxyAddress);
            expect(remaining).to.equal(0);
        }
    });
}); 