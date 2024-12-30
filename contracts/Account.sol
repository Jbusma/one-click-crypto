// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Importing OpenZeppelin's Ownable for ownership management
import "@openzeppelin/contracts/access/Ownable.sol";

// Importing IAccount interface from Account Abstraction
import "@account-abstraction/contracts/interfaces/IAccount.sol";

// Importing EntryPoint from Account Abstraction
import "@account-abstraction/contracts/core/EntryPoint.sol";

// Importing OpenZeppelin's ECDSA library for signature operations
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Account
 * @dev Implements the IAccount interface for Account Abstraction as per EIP-4337.
 */
contract Account is Ownable, IAccount {
    using ECDSA for bytes32;

    EntryPoint public immutable entryPoint;
    uint256 public nonce;

    /**
     * @dev Constructor sets the fixed EntryPoint address.
     */
    constructor(address payable _entrypoint_address) {
        entryPoint = EntryPoint(_entrypoint_address);
    }

    /**
     * @dev Validates a UserOperation. Called by EntryPoint.
     *
     * @param userOp The UserOperation struct containing operation details.
     * @param userOpHash The hash of the user operation.
     * @param missingAccountFunds The amount of funds missing to cover gas fees.
     *
     * @return validationData A bitmask indicating the validation result.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        // Ensure that only the EntryPoint contract can call this function
        require(msg.sender == address(entryPoint), "Only EntryPoint can call validateUserOp");

        // Verify that the sender in UserOp is this contract
        require(userOp.sender == address(this), "Invalid sender");

        // Validate the signature using the provided userOpHash
        require(_validateSignature(userOpHash, userOp.signature), "Invalid signature");

        // Validate the nonce
        require(userOp.nonce == nonce, "Invalid nonce");
        nonce += 1; // Increment nonce to prevent replay

        // Additional validations can be added here (e.g., balance checks)

        // Indicate successful validation without any special flags
        return 0;
    }

    /**
     * @dev Internal function to validate the signature of the UserOperation.
     *
     * @param userOpHash The hash of the user operation.
     * @param signature The signature of the user operation.
     *
     * @return bool indicating whether the signature is valid.
     */
    function _validateSignature(bytes32 userOpHash, bytes calldata signature) internal view returns (bool) {
        // Recover the signer's address from the signature
        address signer = userOpHash.toEthSignedMessageHash().recover(signature);

        // The signer must be the owner of the contract
        return (signer == owner());
    }

    function execute(address dest, uint256 value, bytes calldata data) external onlyOwner {
        (bool success, ) = dest.call{value: value}(data);
        require(success, "Call failed");
    }
}

contract AccountFactory {
    event AccountCreated(address indexed account);
    address payable public entryPoint;  

    constructor(address payable _entrypoint_address) {
        entryPoint = _entrypoint_address;
    }

    function createAccount() external returns (address) {
        Account account = new Account(entryPoint);
        emit AccountCreated(address(account));
        return address(account);
    }
}