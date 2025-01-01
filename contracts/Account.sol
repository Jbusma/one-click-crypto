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

// Importing OpenZeppelin's ERC20 interface
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Account
 * @dev Implements the IAccount interface for Account Abstraction as per EIP-4337.
 */
contract Account is Ownable, IAccount {
    using ECDSA for bytes32;

    EntryPoint public immutable entryPoint;
    uint256 public nonce;

    // Shipping info structure
    struct ShippingInfo {
        string name;
        string streetAddress;
        string city;
        string country;
        string postalCode;
        string email;
    }

    ShippingInfo public shippingInfo;
    
    event ShippingInfoUpdated(address indexed account);

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

    // Update shipping info
    function setShippingInfo(
        string memory _name,
        string memory _streetAddress,
        string memory _city,
        string memory _country,
        string memory _postalCode,
        string memory _email
    ) external onlyOwner {
        shippingInfo = ShippingInfo({
            name: _name,
            streetAddress: _streetAddress,
            city: _city,
            country: _country,
            postalCode: _postalCode,
            email: _email
        });
        
        emit ShippingInfoUpdated(address(this));
    }
}