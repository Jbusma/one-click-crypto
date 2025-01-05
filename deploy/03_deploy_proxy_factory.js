module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
  
    // Deploy the ProxyFactory
    const proxyFactory = await deploy('ProxyFactory', {
      from: deployer,
      args: [], // ProxyFactory doesn't need constructor arguments
      log: true,
    });
};

module.exports.tags = ['ProxyFactory', 'core']; 