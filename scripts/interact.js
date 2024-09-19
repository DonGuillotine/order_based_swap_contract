const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const OrderBasedSwap = await hre.ethers.getContractFactory("OrderBasedSwap");
  const orderBasedSwap = OrderBasedSwap.attach("0x3E9c1df6D9769423B82cd59724c8F6284193f684");

  const DoomEternalToken = await hre.ethers.getContractFactory("DoomEternalToken");
  const warzoneToken = DoomEternalToken.attach("0x8da7e2ddd0747b9e1924fA127E37F9B0d8866c31");
  const vanguardToken = DoomEternalToken.attach("0xB73d126e1a62f0c1b26152292ceF917973f8a709");

  const balance = await warzoneToken.balanceOf(signer.address);
  console.log("Warzone Token Balance:", hre.ethers.formatEther(balance));

  await warzoneToken.approve(orderBasedSwap.getAddress(), hre.ethers.parseEther("100"));

  await orderBasedSwap.depositTokens(warzoneToken.getAddress(), hre.ethers.parseEther("50"));

  await orderBasedSwap.createOrder(
    warzoneToken.getAddress(),
    hre.ethers.parseEther("25"),
    vanguardToken.getAddress(),
    hre.ethers.parseEther("50")
  );

  console.log("Order created successfully!");

  const order = await orderBasedSwap.getOrder(0);
  console.log("Order details:", order);

  const balanceAfterOrder = await warzoneToken.balanceOf(signer.address);
  console.log("Warzone Token Balance after order:", hre.ethers.formatEther(balanceAfterOrder));

//   To fulfill an order
//   await orderBasedSwap.fulfillOrder(0);
//   console.log("Order fulfilled successfully!");


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });