const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const DoomEternalToken = await hre.ethers.getContractFactory("DoomEternalToken");
  const tokenWarzone = await DoomEternalToken.deploy("Warzone", "WRZ", hre.ethers.parseEther("1000000"));
  const tokenVanguard = await DoomEternalToken.deploy("Vanguard", "VGD", hre.ethers.parseEther("1000000"));

  await tokenWarzone.waitForDeployment();
  await tokenVanguard.waitForDeployment();

  console.log("Warzone Token deployed to:", await tokenWarzone.getAddress());
  console.log("Vanguard Token deployed to:", await tokenVanguard.getAddress());

  const OrderBasedSwap = await hre.ethers.getContractFactory("OrderBasedSwap");
  const orderBasedSwap = await OrderBasedSwap.deploy();

  await orderBasedSwap.waitForDeployment();

  console.log("OrderBasedSwap deployed to:", await orderBasedSwap.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });