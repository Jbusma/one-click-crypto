// Solidity
// File: MyToken.sol
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OneClickCheckoutToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("OneClickCheckoutToken", "OCCT") {
        _mint(msg.sender, initialSupply);
    }
}