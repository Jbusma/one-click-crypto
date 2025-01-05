module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
  
    // Get the EntryPoint address
    const entryPointDeployment = await deployments.get('EntryPoint');
    const entryPointAddress = entryPointDeployment.address;
  
    // Deploy the Account implementation
    const account = await deploy('Account', {
      from: deployer,
      args: [entryPointAddress],
      log: true,
    });
};

module.exports.tags = ['Account', 'core'];
module.exports.dependencies = ['EntryPoint']; 