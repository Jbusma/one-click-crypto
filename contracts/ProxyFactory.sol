// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ProxyFactory {
    event ProxyCreated(address indexed proxy, address indexed owner);

    /**
     * @dev Deploys a new proxy instance pointing to implementation
     * @param implementation Address of the implementation contract
     * @param owner Address that will own this account
     */
    function createProxy(address implementation, address owner) public returns (address proxy) {
        bytes32 salt = bytes32(uint256(uint160(owner)));
        
        // Get the deterministic address before deployment
        proxy = getAddress(implementation, owner);
        
        // Only deploy if not already deployed
        if (proxy.code.length == 0) {
            bytes memory deploymentData = abi.encodePacked(
                hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
                implementation,
                hex"5af43d82803e903d91602b57fd5bf3"
            );
            
            assembly {
                proxy := create2(0, add(deploymentData, 0x20), mload(deploymentData), salt)
            }
            
            require(proxy != address(0), "Create2 failed");
            emit ProxyCreated(proxy, owner);
        }
    }

    /**
     * @dev Predicts the address where a proxy will be deployed
     */
    function getAddress(address implementation, address owner) public view returns (address) {
        bytes32 salt = bytes32(uint256(uint160(owner)));
        bytes memory deploymentData = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(deploymentData)
            )
        );
        return address(uint160(uint256(hash)));
    }
} 