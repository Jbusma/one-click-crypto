# 🚀 One Click Crypto Checkout

Seamless crypto payments for your e-commerce platform. One account, any merchant, zero friction.

## 💡 Why One Click Crypto?

- **Universal Login**: Users create one account that works across all merchants
- **No More Forms**: Shipping info is stored on-chain, auto-filled for every purchase
- **Gas-Free Experience**: We sponsor gas fees for a true Web2-like UX
- **Account Abstraction**: Built on EIP-4337 for maximum security and flexibility
- **Token Agnostic**: Support any ERC20 token, with automatic swaps if needed

## 🏃‍♂️ Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/your-username/one-click-crypto.git
cd one-click-crypto
npm install
```

### 2. Start Local Node
```bash
npx hardhat node
```

### 3. Deploy Contracts
```bash
# In a new terminal
npx hardhat deploy
```

That's it! Your local environment is ready for development.

## 🛠 Development

### Run All Tests
```bash
npx hardhat test
```

### Run Specific Test Suite
```bash
npx hardhat test test/AccountPayment.test.js
```

### Restart Node
```bash
# Kills existing node and starts fresh
npx hardhat restart-node
```

### Redeploy Contracts
```bash
npx hardhat redeploy
```

## 🏗 Architecture

### Smart Contracts
- `Account.sol`: EIP-4337 smart wallet that handles payments and shipping info
- `ProxyFactory.sol`: Minimal proxy factory for gas-efficient account creation
- `OneClickPaymaster.sol`: Gas sponsorship with rate limiting and token support
- `OneClickToken.sol`: Example ERC20 token for testing

### Key Features
- **Single Transaction Flow**: Token transfer + shipping info in one tx
- **Gas Sponsorship**: Paymaster covers gas for better UX
- **Proxy Pattern**: EIP-1167 minimal proxies for cheap account creation
- **Rate Limiting**: Built-in protection against spam and abuse

## 🔒 Security

- Follows EIP-4337 best practices
- Comprehensive test suite with 100% coverage
- Gas-optimized for minimal costs
- Built on battle-tested OpenZeppelin contracts

## 📖 Integration Guide

### 1. Deploy Core Contracts
```bash
npx hardhat deploy --network your-network
```

### 2. Add Token Support
```javascript
// Add your token to the paymaster
await paymaster.addSupportedToken(tokenAddress, exchangeRate);
```

### 3. Create User Account
```javascript
// Deploy minimal proxy for new user
const accountAddress = await factory.createAccount(ownerAddress);
```

### 4. Process Payment
```javascript
// One tx: transfer tokens + shipping info
await account.executePayment(tokenAddress, merchantAddress, amount);
```