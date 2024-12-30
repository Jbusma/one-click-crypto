# One Click Crypto

A smart contract system implementing Account Abstraction (EIP-4337) for seamless crypto payments. This project aims to simplify cryptocurrency transactions by providing a user-friendly account abstraction layer.

## Project Components

- **Account Contract**: An EIP-4337 compatible smart contract wallet implementation
- **AccountFactory**: Factory contract for deploying new Account instances
- **OneClickCheckoutToken**: ERC20 token implementation for the payment system
- **EntryPoint**: Standard EIP-4337 EntryPoint contract deployment

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run local Hardhat node:
```bash
npm run restart-hardhat
```

3. Deploy contracts:
```bash
npx hardhat deploy
```

## Development Commands

```bash
# Run tests
npx hardhat test

# Clean and redeploy contracts
npx hardhat redeploy

# Clean deployments folder
npx hardhat clean-deployments
```

## Project Structure

- `contracts/`: Smart contract source files
  - `Account.sol`: EIP-4337 compatible wallet implementation
  - `MyToken.sol`: ERC20 token implementation
- `deploy/`: Deployment scripts for contracts
- `scripts/`: Utility scripts for contract interaction
- `test/`: Contract test files

## Dependencies

- Hardhat
- OpenZeppelin Contracts
- Account Abstraction (EIP-4337) Contracts
- Ethers.js v6

## License

ISC
