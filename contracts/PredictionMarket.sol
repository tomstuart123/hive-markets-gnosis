// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uma/core/contracts/common/implementation/ExpandedERC20.sol";
import "@uma/core/contracts/data-verification-mechanism/interfaces/FinderInterface.sol";

contract PredictionMarket {
    using SafeERC20 for IERC20;

    struct Market {
        bytes32 outcome1;
        bytes32 outcome2;
        bytes description;
        bytes32 assertedOutcomeId;
        ExpandedERC20 outcome1Token;
        ExpandedERC20 outcome2Token;
        uint256 reward;
        uint256 requiredBond;
        bool resolved;
    }



    mapping(bytes32 => Market) public markets;

    FinderInterface public finder;
    IERC20 public currency;
    address public owner;

    event MarketInitialized(
        bytes32 indexed marketId,
        string outcome1,
        string outcome2,
        string description,
        address outcome1Token,
        address outcome2Token,
        uint256 reward,
        uint256 requiredBond
    );
    event MarketResolved(bytes32 indexed marketId);
    event TokensCreated(bytes32 indexed marketId, address indexed account, uint256 tokensCreated);
    event TokensRedeemed(bytes32 indexed marketId, address indexed account, uint256 tokensRedeemed);
    event TokensSettled(
        bytes32 indexed marketId,
        address indexed account,
        uint256 payout,
        uint256 outcome1Tokens,
        uint256 outcome2Tokens
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _finder, address _currency) {
        finder = FinderInterface(_finder);
        currency = IERC20(_currency);
        owner = msg.sender;
    }

    function _createToken(bytes32 name, bytes32 symbol) internal returns (ExpandedERC20) {
        ExpandedERC20 token = new ExpandedERC20(string(abi.encodePacked(name)), string(abi.encodePacked(symbol)), 18);
        token.addMinter(address(this));
        token.addBurner(address(this));
        return token;
    }

    function initializeMarket(
        bytes32 outcome1,
        bytes32 outcome2,
        bytes memory description,
        uint256 reward,
        uint256 requiredBond
    ) public onlyOwner returns (bytes32 marketId) {
        require(outcome1 != bytes32(0), "Empty first outcome");
        require(outcome2 != bytes32(0), "Empty second outcome");
        require(outcome1 != outcome2, "Outcomes are the same");
        require(description.length > 0, "Empty description");
        
        marketId = keccak256(abi.encode(block.number, description));
        require(address(markets[marketId].outcome1Token) == address(0), "Market already exists");

        ExpandedERC20 outcome1Token = _createToken(outcome1, "O1T");
        ExpandedERC20 outcome2Token = _createToken(outcome2, "O2T");

        markets[marketId] = Market({
            resolved: false,
            assertedOutcomeId: bytes32(0),
            outcome1Token: outcome1Token,
            outcome2Token: outcome2Token,
            reward: reward,
            requiredBond: requiredBond,
            outcome1: outcome1,
            outcome2: outcome2,
            description: description
        });

        if (reward > 0) {
            currency.safeTransferFrom(msg.sender, address(this), reward); // Pull reward.
        }

        emit MarketInitialized(
            marketId,
            string(abi.encodePacked(outcome1)),
            string(abi.encodePacked(outcome2)),
            string(description),
            address(outcome1Token),
            address(outcome2Token),
            reward,
            requiredBond
        );
    }



    function manualResolveMarket(bytes32 marketId, bytes32 assertedOutcome) public onlyOwner {
        Market storage market = markets[marketId];
        require(address(market.outcome1Token) != address(0), "Market does not exist");

        bytes32 assertedOutcomeId = keccak256(abi.encodePacked(assertedOutcome));
        require(
            assertedOutcomeId == keccak256(abi.encodePacked(market.outcome1)) ||
            assertedOutcomeId == keccak256(abi.encodePacked(market.outcome2)),
            "Invalid asserted outcome"
        );

        market.assertedOutcomeId = assertedOutcomeId;
        market.resolved = true;

        emit MarketResolved(marketId);
    }


    function createTokens(bytes32 marketId, uint256 amount) public {
        Market storage market = markets[marketId];
        require(!market.resolved, "Market resolved");
        require(amount > 0, "Amount must be greater than 0");

        market.outcome1Token.mint(msg.sender, amount);
        market.outcome2Token.mint(msg.sender, amount);

        emit TokensCreated(marketId, msg.sender, amount);
    }

    function redeemTokens(bytes32 marketId, uint256 amount) public {
        Market storage market = markets[marketId];
        require(amount > 0, "Amount must be greater than 0");

        market.outcome1Token.burnFrom(msg.sender, amount);
        market.outcome2Token.burnFrom(msg.sender, amount);

        emit TokensRedeemed(marketId, msg.sender, amount);
    }

    function settleAndGetPayout(bytes32 marketId) public returns (uint256) {
        Market storage market = markets[marketId];
        require(market.resolved, "Market not resolved");

        uint256 outcome1Balance = market.outcome1Token.balanceOf(msg.sender);
        uint256 outcome2Balance = market.outcome2Token.balanceOf(msg.sender);

        uint256 payout;
        if (market.assertedOutcomeId == market.outcome1) {
            payout = outcome1Balance;
        } else if (market.assertedOutcomeId == market.outcome2) {
            payout = outcome2Balance;
        } else {
            payout = 0;
        }

        market.outcome1Token.burnFrom(msg.sender, outcome1Balance);
        market.outcome2Token.burnFrom(msg.sender, outcome2Balance);

        currency.safeTransfer(msg.sender, payout);
        emit TokensSettled(marketId, msg.sender, payout, outcome1Balance, outcome2Balance);

        return payout;
    }
}
