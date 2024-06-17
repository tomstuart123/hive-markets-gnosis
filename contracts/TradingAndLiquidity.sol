// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PredictionMarket.sol";

contract TradingAndLiquidity {
    using SafeERC20 for IERC20;

    PredictionMarket public predictionMarket;
    IERC20 public currency;
    address public owner;

    event OutcomeBought(bytes32 indexed marketId, address indexed buyer, uint256 amount, uint8 outcomeIndex);
    event OutcomeSold(bytes32 indexed marketId, address indexed seller, uint256 amount, uint8 outcomeIndex);
    event LiquidityAdded(bytes32 indexed marketId, address indexed provider, uint256 amount);
    event LiquidityRemoved(bytes32 indexed marketId, address indexed provider, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _predictionMarket, address _currency) {
        predictionMarket = PredictionMarket(_predictionMarket);
        currency = IERC20(_currency);
        owner = msg.sender;
    }

    function buyOutcomeShares(bytes32 marketId, uint8 outcomeIndex, uint256 amount) public {
        (bool resolved, , ExpandedERC20 outcome1Token, ExpandedERC20 outcome2Token, , , , , ) = predictionMarket.getMarket(marketId);
        require(!resolved, "Market resolved");
        require(outcomeIndex == 0 || outcomeIndex == 1, "Invalid outcome index");

        ExpandedERC20 outcomeToken = outcomeIndex == 0 ? outcome1Token : outcome2Token;
        currency.safeTransferFrom(msg.sender, address(this), amount);
        outcomeToken.mint(msg.sender, amount);

        emit OutcomeBought(marketId, msg.sender, amount, outcomeIndex);
    }

    function sellOutcomeShares(bytes32 marketId, uint8 outcomeIndex, uint256 amount) public {
        (bool resolved, , ExpandedERC20 outcome1Token, ExpandedERC20 outcome2Token, , , , , ) = predictionMarket.getMarket(marketId);
        require(!resolved, "Market resolved");
        require(outcomeIndex == 0 || outcomeIndex == 1, "Invalid outcome index");

        ExpandedERC20 outcomeToken = outcomeIndex == 0 ? outcome1Token : outcome2Token;
        outcomeToken.burnFrom(msg.sender, amount);
        currency.safeTransfer(msg.sender, amount);

        emit OutcomeSold(marketId, msg.sender, amount, outcomeIndex);
    }

    function addLiquidity(bytes32 marketId, uint256 amount) public {
        (bool resolved, , , , , , , , ) = predictionMarket.getMarket(marketId);
        require(!resolved, "Market resolved");

        currency.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityAdded(marketId, msg.sender, amount);
    }

    function removeLiquidity(bytes32 marketId, uint256 amount) public {
        (bool resolved, , , , , , , , ) = predictionMarket.getMarket(marketId);
        require(!resolved, "Market resolved");

        currency.safeTransfer(msg.sender, amount);
        emit LiquidityRemoved(marketId, msg.sender, amount);
    }
}
