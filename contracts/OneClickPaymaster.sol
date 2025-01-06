// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Account.sol";

contract OneClickPaymaster is BasePaymaster {
    error RateLimitExceeded();
    error TokenNotSupported();
    error InsufficientTokenBalance();
    error InsufficientTokenAllowance();

    uint256 constant BLOCKS_PER_PERIOD = 7200; // ~24 hours at 12 sec/block
    uint256 constant MAX_TRIES = 3;
    uint256 constant COUNT_MASK = 0x3;  // 2 bits for count (max 3)
    
    // Single uint256: blockNumber in high 254 bits, count in low 2 bits
    mapping(address => uint256) public attempts;
    mapping(address => uint256) public supportedTokens;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    function addSupportedToken(address token, uint256 rate) external onlyOwner {
        supportedTokens[token] = rate;
    }

    function _getBlockNumber(uint256 packed) internal pure returns (uint256) {
        return packed >> 2;
    }

    function _getCount(uint256 packed) internal pure returns (uint256) {
        return packed & COUNT_MASK;
    }

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,  // userOpHash
        uint256   // maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        address user = userOp.sender;
        uint256 packed = attempts[user];
        uint256 lastBlock = _getBlockNumber(packed);
        uint256 count = _getCount(packed);
        
        // Reset count if we're in a new period
        if (block.number >= lastBlock + BLOCKS_PER_PERIOD) {
            // View function, actual reset happens in _postOp
            count = 1;
        } else {
            // Check if we've exceeded the rate limit
            if (count >= MAX_TRIES) revert RateLimitExceeded();
            count++;
        }

        // Decode token and amount from paymasterAndData
        (address token, uint256 tokenAmount) = abi.decode(userOp.paymasterAndData[20:], (address, uint256));
        
        // Verify token is supported
        if (supportedTokens[token] == 0) revert TokenNotSupported();
        
        // Verify user has enough tokens
        IERC20 tokenContract = IERC20(token);
        if (tokenContract.balanceOf(user) < tokenAmount) revert InsufficientTokenBalance();

        // Skip allowance check for first operation (nonce 0)
        if (userOp.nonce > 0) {
            if (tokenContract.allowance(user, address(this)) < tokenAmount) revert InsufficientTokenAllowance();
        }
        
        return (abi.encode(user, token, tokenAmount, userOp.nonce), 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256  // actualGasCost
    ) internal override {
        // Only track successful operations
        if (mode == PostOpMode.opSucceeded) {
            (address user, address token, uint256 tokenAmount, uint256 nonce) = abi.decode(context, (address, address, uint256, uint256));
            
            // Only transfer tokens for non-approval operations
            if (nonce > 0) {
                // Transfer tokens from user to paymaster
                IERC20(token).transferFrom(user, address(this), tokenAmount);
                
                uint256 packed = attempts[user];
                uint256 lastBlock = _getBlockNumber(packed);
                uint256 count = _getCount(packed);
                
                // Reset counter if we're in a new period
                if (block.number >= lastBlock + BLOCKS_PER_PERIOD || lastBlock == 0) {
                    // Pack: new block number + count of 1
                    attempts[user] = (block.number << 2) | 1;
                } else {
                    // Pack: same block number + incremented count
                    attempts[user] = (lastBlock << 2) | (count + 1);
                }
            }
        }
    }

    // View function to check remaining attempts
    function getRemainingAttempts(address user) external view returns (uint256) {
        uint256 packed = attempts[user];
        uint256 lastBlock = _getBlockNumber(packed);
        uint256 count = _getCount(packed);
        
        // If we're in a new period or no attempts yet, all attempts are available
        if (block.number >= lastBlock + BLOCKS_PER_PERIOD || lastBlock == 0) {
            return MAX_TRIES;
        }
        
        // Otherwise, return remaining attempts
        return MAX_TRIES - count;
    }
} 