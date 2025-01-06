const { ethers } = require("hardhat");

async function createSignedUserOp({
  sender,
  signer,
  entryPoint,
  callData = "0x",
  paymasterAndData = "0x",
  ...overrides
}) {
  const baseOp = {
    sender,
    nonce: await entryPoint.getNonce(sender, 0),
    initCode: "0x",
    callData,
    callGasLimit: 500000,
    verificationGasLimit: 500000,
    preVerificationGas: 50000,
    maxFeePerGas: ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
    paymasterAndData,
    signature: "0x"
  };

  const userOp = { ...baseOp, ...overrides };
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  userOp.signature = await signer.signMessage(ethers.getBytes(userOpHash));
  
  return userOp;
}

const FUNCTION_INTERFACES = {
  approve: ["function approve(address spender, uint256 amount)"],
  setShippingInfo: ["function setShippingInfo(string name, string streetAddress, string city, string country, string postalCode, string email)"],
  executePayment: ["function executePayment(address token, address to, uint256 amount)"],
  execute: ["function execute(address dest, uint256 value, bytes calldata data)"]
};

async function createOp({
  sender,
  signer,
  entryPoint,
  target,
  functionName,
  functionArgs,
  value = 0,
  tokenAddress,
  paymasterAddress,
  paymasterTokenAmount = "1000000000000000000",
  isAccountFunction = true
}) {
  const functionInterface = FUNCTION_INTERFACES[functionName];
  if (!functionInterface) {
    throw new Error(`Unknown function: ${functionName}`);
  }

  const iface = new ethers.Interface(functionInterface);

  let callData;
  if (isAccountFunction) {
    callData = iface.encodeFunctionData(functionName, functionArgs);
  } else {
    const targetData = iface.encodeFunctionData(functionName, functionArgs);
    const executeIface = new ethers.Interface(FUNCTION_INTERFACES.execute);
    callData = executeIface.encodeFunctionData("execute", [target, value, targetData]);
  }

  const paymasterAndData = ethers.concat([
    paymasterAddress,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [tokenAddress, paymasterTokenAmount]
    )
  ]);

  return createSignedUserOp({
    sender,
    signer,
    entryPoint,
    callData,
    paymasterAndData,
    callGasLimit: 2000000,
    verificationGasLimit: 1000000,
    preVerificationGas: 100000
  });
}

module.exports = {
  createSignedUserOp,
  createOp,
  // Convenience wrappers for common operations
  createPaymentOp: (params) => createOp({...params, functionName: "executePayment", functionArgs: [params.tokenAddress, params.to, params.amount], isAccountFunction: true}),
  createApprovalOp: (params) => createOp({...params, target: params.tokenAddress, functionName: "approve", functionArgs: [params.spender, params.amount], isAccountFunction: false}),
  createShippingInfoOp: (params) => createOp({...params, functionName: "setShippingInfo", functionArgs: [params.name, params.streetAddress, params.city, params.country, params.postalCode, params.email], isAccountFunction: true})
}; 