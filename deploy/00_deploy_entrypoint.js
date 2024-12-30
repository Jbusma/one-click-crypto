module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
  
    const entryPoint = await deploy('EntryPoint', {
      from: deployer,
      log: true,
    });
  };