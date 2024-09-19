const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBasedSwap", function () {
  let orderBasedSwap;
  let warzoneToken;
  let vanguardToken;
  let owner;
  let addr1;
  let addr2;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const DoomEternalToken = await ethers.getContractFactory("DoomEternalToken");
    warzoneToken = await DoomEternalToken.deploy("Warzone", "WRZ", INITIAL_SUPPLY);
    vanguardToken = await DoomEternalToken.deploy("Vanguard", "VGD", INITIAL_SUPPLY);

    const OrderBasedSwap = await ethers.getContractFactory("OrderBasedSwap");
    orderBasedSwap = await OrderBasedSwap.deploy();

    await warzoneToken.mint(addr1.address, ethers.parseEther("1000"));
    await vanguardToken.mint(addr2.address, ethers.parseEther("1000"));

    await warzoneToken.connect(addr1).approve(await orderBasedSwap.getAddress(), ethers.parseEther("1000"));
    await vanguardToken.connect(addr2).approve(await orderBasedSwap.getAddress(), ethers.parseEther("1000"));
  });

  describe("Deposit and Withdraw", function () {
    it("Should allow users to deposit tokens", async function () {
      await expect(orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100")))
        .to.emit(orderBasedSwap, "TokensDeposited")
        .withArgs(addr1.address, await warzoneToken.getAddress(), ethers.parseEther("100"));

      const balance = await orderBasedSwap.getBalance(addr1.address, await warzoneToken.getAddress());
      expect(balance).to.equal(ethers.parseEther("100"));
    });

    it("Should not allow depositing 0 tokens", async function () {
      await expect(orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), 0))
        .to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should allow users to withdraw tokens", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      
      await expect(orderBasedSwap.connect(addr1).withdrawTokens(await warzoneToken.getAddress(), ethers.parseEther("50")))
        .to.emit(orderBasedSwap, "TokensWithdrawn")
        .withArgs(addr1.address, await warzoneToken.getAddress(), ethers.parseEther("50"));

      const balance = await orderBasedSwap.getBalance(addr1.address, await warzoneToken.getAddress());
      expect(balance).to.equal(ethers.parseEther("50"));
    });

    it("Should not allow withdrawing more tokens than available", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      
      await expect(orderBasedSwap.connect(addr1).withdrawTokens(await warzoneToken.getAddress(), ethers.parseEther("150")))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Order Creation and Cancellation", function () {
    it("Should allow users to create orders", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      
      await expect(orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      )).to.emit(orderBasedSwap, "OrderCreated")
        .withArgs(0, addr1.address, await warzoneToken.getAddress(), ethers.parseEther("50"), await vanguardToken.getAddress(), ethers.parseEther("25"));

      const order = await orderBasedSwap.getOrder(0);
      expect(order.seller).to.equal(addr1.address);
      expect(order.tokenToSell).to.equal(await warzoneToken.getAddress());
      expect(order.amountToSell).to.equal(ethers.parseEther("50"));
      expect(order.tokenToBuy).to.equal(await vanguardToken.getAddress());
      expect(order.amountToBuy).to.equal(ethers.parseEther("25"));
      expect(order.isActive).to.be.true;
    });

    it("Should not allow creating orders with insufficient balance", async function () {
      await expect(orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("1001"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      )).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow users to cancel their orders", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      await orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      );

      await expect(orderBasedSwap.connect(addr1).cancelOrder(0))
        .to.emit(orderBasedSwap, "OrderCancelled")
        .withArgs(0);

      const order = await orderBasedSwap.getOrder(0);
      expect(order.isActive).to.be.false;

      const balance = await orderBasedSwap.getBalance(addr1.address, await warzoneToken.getAddress());
      expect(balance).to.equal(ethers.parseEther("100"));
    });

    it("Should not allow non-creators to cancel orders", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      await orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      );

      await expect(orderBasedSwap.connect(addr2).cancelOrder(0))
        .to.be.revertedWith("Not the order creator");
    });
  });

  describe("Order Fulfillment", function () {
    it("Should allow users to fulfill orders", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      await orderBasedSwap.connect(addr2).depositTokens(await vanguardToken.getAddress(), ethers.parseEther("100"));

      await orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      );

      await expect(orderBasedSwap.connect(addr2).fulfillOrder(0))
        .to.emit(orderBasedSwap, "OrderFulfilled")
        .withArgs(0, addr2.address);

      const order = await orderBasedSwap.getOrder(0);
      expect(order.isActive).to.be.false;

      const addr1BalanceA = await orderBasedSwap.getBalance(addr1.address, await warzoneToken.getAddress());
      const addr1BalanceB = await orderBasedSwap.getBalance(addr1.address, await vanguardToken.getAddress());
      const addr2BalanceA = await orderBasedSwap.getBalance(addr2.address, await warzoneToken.getAddress());
      const addr2BalanceB = await orderBasedSwap.getBalance(addr2.address, await vanguardToken.getAddress());

      expect(addr1BalanceA).to.equal(ethers.parseEther("50"));
      expect(addr1BalanceB).to.equal(ethers.parseEther("25"));
      expect(addr2BalanceA).to.equal(ethers.parseEther("50"));
      expect(addr2BalanceB).to.equal(ethers.parseEther("75"));
    });

    it("Should not allow fulfilling inactive orders", async function () {
      await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      await orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      );

      await orderBasedSwap.connect(addr1).cancelOrder(0);

      await expect(orderBasedSwap.connect(addr2).fulfillOrder(0))
        .to.be.revertedWith("Order is not active");
    });
  });

  describe("Gas Usage", function () {
    it("Should have reasonable gas costs for main operations", async function () {
      const depositTx = await orderBasedSwap.connect(addr1).depositTokens(await warzoneToken.getAddress(), ethers.parseEther("100"));
      const depositReceipt = await depositTx.wait();
      console.log("Gas used for deposit:", depositReceipt.gasUsed.toString());

      const createOrderTx = await orderBasedSwap.connect(addr1).createOrder(
        await warzoneToken.getAddress(),
        ethers.parseEther("50"),
        await vanguardToken.getAddress(),
        ethers.parseEther("25")
      );
      const createOrderReceipt = await createOrderTx.wait();
      console.log("Gas used for create order:", createOrderReceipt.gasUsed.toString());

      await orderBasedSwap.connect(addr2).depositTokens(await vanguardToken.getAddress(), ethers.parseEther("100"));
      const fulfillOrderTx = await orderBasedSwap.connect(addr2).fulfillOrder(0);
      const fulfillOrderReceipt = await fulfillOrderTx.wait();
      console.log("Gas used for fulfill order:", fulfillOrderReceipt.gasUsed.toString());
    });
  });
});