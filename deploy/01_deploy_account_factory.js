module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Ensure the EntryPoint contract is deployed first
  const entryPointDeployment = await deployments.get('EntryPoint');
  const entryPointAddress = entryPointDeployment.address;

  // Deploy the AccountFactory contract
  const accountFactory = await deploy('AccountFactory', {
    from: deployer,
    args: [entryPointAddress], // Pass the EntryPoint address to the constructor
    log: true,
  });
};