// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OrderBasedSwap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Order {
        address seller;
        address tokenToSell;
        uint256 amountToSell;
        address tokenToBuy;
        uint256 amountToBuy;
        bool isActive;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    mapping(address => mapping(address => uint256)) public userBalances;

    event OrderCreated(uint256 indexed orderId, address indexed seller, address tokenToSell, uint256 amountToSell, address tokenToBuy, uint256 amountToBuy);
    event OrderCancelled(uint256 indexed orderId);
    event OrderFulfilled(uint256 indexed orderId, address indexed buyer);
    event TokensDeposited(address indexed user, address indexed token, uint256 amount);
    event TokensWithdrawn(address indexed user, address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function depositTokens(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        userBalances[msg.sender][token] += amount;
        emit TokensDeposited(msg.sender, token, amount);
    }

    function withdrawTokens(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userBalances[msg.sender][token] >= amount, "Insufficient balance");
        userBalances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(msg.sender, token, amount);
    }

    function createOrder(address tokenToSell, uint256 amountToSell, address tokenToBuy, uint256 amountToBuy) external nonReentrant {
        require(amountToSell > 0 && amountToBuy > 0, "Amounts must be greater than 0");
        require(userBalances[msg.sender][tokenToSell] >= amountToSell, "Insufficient balance");

        uint256 orderId = nextOrderId++;
        orders[orderId] = Order({
            seller: msg.sender,
            tokenToSell: tokenToSell,
            amountToSell: amountToSell,
            tokenToBuy: tokenToBuy,
            amountToBuy: amountToBuy,
            isActive: true
        });

        userBalances[msg.sender][tokenToSell] -= amountToSell;

        emit OrderCreated(orderId, msg.sender, tokenToSell, amountToSell, tokenToBuy, amountToBuy);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.isActive, "Order is not active");
        require(order.seller == msg.sender, "Not the order creator");

        order.isActive = false;
        userBalances[msg.sender][order.tokenToSell] += order.amountToSell;

        emit OrderCancelled(orderId);
    }

    function fulfillOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.isActive, "Order is not active");
        require(userBalances[msg.sender][order.tokenToBuy] >= order.amountToBuy, "Insufficient balance to fulfill order");

        order.isActive = false;
        userBalances[msg.sender][order.tokenToBuy] -= order.amountToBuy;
        userBalances[order.seller][order.tokenToBuy] += order.amountToBuy;
        userBalances[msg.sender][order.tokenToSell] += order.amountToSell;

        emit OrderFulfilled(orderId, msg.sender);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getBalance(address user, address token) external view returns (uint256) {
        return userBalances[user][token];
    }
}