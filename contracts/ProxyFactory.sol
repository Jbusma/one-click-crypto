// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ProxyFactory {
    error Create2Failed();
    error InitializationFailed();

    event ProxyDeployed(address indexed implementation, address indexed owner, address proxy);

    // Internal function to get deployment data
    function _getDeploymentData(address implementation) internal pure returns (bytes memory) {
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
    }

    /**
     * @dev Deploys a new proxy instance pointing to implementation
     * @param implementation Address of the implementation contract
     * @param owner Address that will own this account
     */
    function createProxy(address implementation, address owner) public returns (address proxy) {
        bytes32 salt = bytes32(uint256(uint160(owner)));
        bytes memory deploymentData = _getDeploymentData(implementation);
        
        // Get the deterministic address before deployment
        proxy = getAddress(implementation, owner);
        
        // Only deploy if not already deployed
        if (proxy.code.length == 0) {
            assembly {
                proxy := create2(0, add(deploymentData, 0x20), mload(deploymentData), salt)
            }
            
            if (proxy == address(0)) revert Create2Failed();

            // Initialize the proxy
            (bool success, ) = proxy.call(abi.encodeWithSignature("initialize(address)", owner));
            if (!success) revert InitializationFailed();

            emit ProxyDeployed(implementation, owner, proxy);
        }
    }

    /**
     * @dev Predicts the address where a proxy will be deployed
     */
    function getAddress(address implementation, address owner) public view returns (address) {
        bytes32 salt = bytes32(uint256(uint160(owner)));
        bytes memory deploymentData = _getDeploymentData(implementation);
        
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(deploymentData)
        )))));
    }
} 