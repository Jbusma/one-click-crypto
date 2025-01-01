// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OneClickPaymaster is BasePaymaster {
    // Mapping of supported tokens and their exchange rates
    mapping(address => uint256) public supportedTokens;
    
    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    // Add/remove supported tokens
    function addSupportedToken(address token, uint256 rate) external onlyOwner {
        supportedTokens[token] = rate;
    }

    // Validate that we can sponsor this operation
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal virtual override returns (bytes memory context, uint256 validationData) {
        // Decode token and amount from paymasterAndData
        (address token, uint256 tokenAmount) = abi.decode(userOp.paymasterAndData[20:], (address, uint256));
        
        // Verify token is supported
        require(supportedTokens[token] > 0, "Token not supported");
        
        // Transfer tokens from user to paymaster
        IERC20(token).transferFrom(userOp.sender, address(this), tokenAmount);
        
        return (abi.encode(token, tokenAmount), 0);
    }
} 