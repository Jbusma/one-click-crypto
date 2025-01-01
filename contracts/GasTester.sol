// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./ProxyFactory.sol";

contract GasTester {
    ProxyFactory public factory;
    
    constructor(address _factory) {
        factory = ProxyFactory(_factory);
    }
    
    function testGetAddress(address implementation, address owner) public view returns (address) {
        return factory.getAddress(implementation, owner);
    }
} 