// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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
contract Account is IAccount {
    using ECDSA for bytes32;

    EntryPoint public immutable entryPoint;
    uint256 public nonce;
    address public owner;  // Set in initialize function

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
    event PaymentWithShipping(
        address indexed from,
        address indexed token,
        address indexed to,
        uint256 amount,
        string name,
        string streetAddress,
        string city,
        string country,
        string postalCode,
        string email
    );

    error OnlyEntryPoint();
    error OnlySelf();
    error InvalidSignature();
    error InvalidNonce();
    error CallFailed();
    error AlreadyInitialized();
    error NoShippingInfo();

    /**
     * @dev Constructor sets the fixed EntryPoint address.
     */
    constructor(address payable _entrypoint_address) {
        entryPoint = EntryPoint(_entrypoint_address);
    }

    /**
     * @dev Initialize function to set the owner. Called by proxy constructor.
     */
    function initialize(address _owner) external {
        if (owner != address(0)) revert AlreadyInitialized();
        owner = _owner;
    }

    /**
     * @dev Validates a UserOperation. Called by EntryPoint.
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256  // missingAccountFunds
    ) external override returns (uint256 validationData) {
        // Ensure that only the EntryPoint contract can call this function
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();

        // Verify that the sender in UserOp is this contract
        if (userOp.sender != address(this)) revert OnlySelf();

        // Validate the signature using the provided userOpHash
        if (!_validateSignature(userOpHash, userOp.signature)) revert InvalidSignature();

        // Validate the nonce
        if (userOp.nonce != nonce) revert InvalidNonce();
        nonce += 1; // Increment nonce to prevent replay

        return 0;
    }

    /**
     * @dev Internal function to validate the signature of the UserOperation.
     */
    function _validateSignature(bytes32 userOpHash, bytes calldata signature) internal view returns (bool) {
        // Add Ethereum prefix to match how signMessage works
        bytes32 prefixedHash = ECDSA.toEthSignedMessageHash(userOpHash);
        address signer = ECDSA.recover(prefixedHash, signature);
        return (signer == owner);
    }

    /**
     * @dev Execute a call. Can only be called through the EntryPoint after validation.
     */
    function execute(address dest, uint256 value, bytes calldata data) external {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        (bool success, ) = dest.call{value: value}(data);
        if (!success) revert CallFailed();
    }

    /**
     * @dev Update shipping info. Can only be called through the EntryPoint after validation.
     */
    function setShippingInfo(
        string memory _name,
        string memory _streetAddress,
        string memory _city,
        string memory _country,
        string memory _postalCode,
        string memory _email
    ) external {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
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

    /**
     * @dev Execute a payment with shipping info. Can only be called through the EntryPoint after validation.
     */
    function executePayment(
        address token,
        address to,
        uint256 amount
    ) external {
        if (msg.sender != address(entryPoint)) revert OnlyEntryPoint();
        
        // Check that shipping info exists
        if (bytes(shippingInfo.name).length == 0) revert NoShippingInfo();
        
        // Execute the token transfer
        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert CallFailed();
        
        // Emit event with payment and shipping details
        emit PaymentWithShipping(
            address(this),
            token,
            to,
            amount,
            shippingInfo.name,
            shippingInfo.streetAddress,
            shippingInfo.city,
            shippingInfo.country,
            shippingInfo.postalCode,
            shippingInfo.email
        );
    }
}