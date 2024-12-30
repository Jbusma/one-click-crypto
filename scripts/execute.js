const hre = require("hardhat");

async function main() {
  const { deployer } = await hre.getNamedAccounts();

  // Retrieve the deployed AccountFactory
  const AccountFactory = await hre.ethers.getContractAt('AccountFactory', deployer);

  console.log(`Using AccountFactory at: ${accountFactoryAddress}`);

  // Create a new account
  console.log("Creating a new account...");

  // Send the transaction to create a new account
  const tx = await AccountFactory.createAccount();

  // Wait for the transaction to be mined and get the receipt
  const receipt = await tx.wait();

  // Log the transaction status: 1 = success, 0 = failure
  console.log("Transaction status:", receipt.status);

  // Access the logs from the receipt
  const logs = receipt.logs;

  // Parse each log to find the 'AccountCreated' event
  let newAccountAddress = null;

  // Use the contract's interface to parse logs
  for (const log of logs) {
    // Skip logs that are not from the AccountFactory contract
    if (log.address.toLowerCase() !== accountFactoryAddress.toLowerCase()) continue;
 
    try {
      const parsedLog = AccountFactory.interface.parseLog(log);
      if (parsedLog.name === 'AccountCreated') {
        newAccountAddress = parsedLog.args.account;
        console.log(`New Account created at address: ${newAccountAddress}`);
        break;
      }
    } catch (error) {
      // Ignore logs that can't be parsed by the interface
    }
  }

  if (!newAccountAddress) {
    console.log("AccountCreated event not found in the transaction receipt.");
  }
} 

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error executing script:", error);
    process.exit(1);
  });