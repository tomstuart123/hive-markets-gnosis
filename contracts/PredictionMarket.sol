// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uma/core/contracts/common/implementation/AddressWhitelist.sol";
import "@uma/core/contracts/common/implementation/ExpandedERC20.sol";
import "@uma/core/contracts/data-verification-mechanism/implementation/Constants.sol";
import "@uma/core/contracts/data-verification-mechanism/interfaces/FinderInterface.sol";
import "@uma/core/contracts/optimistic-oracle-v3/implementation/ClaimData.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3CallbackRecipientInterface.sol";

contract PredictionMarket {
    struct Market {
        bool resolved;
        bytes32 assertedOutcomeId;
        ExpandedERC20 outcome1Token;
        ExpandedERC20 outcome2Token;
        uint256 reward;
        uint256 requiredBond;
        bytes outcome1;
        bytes outcome2;
        bytes description;
    }

    struct AssertedMarket {
        address asserter;
        bytes32 marketId;
    }

    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => AssertedMarket) public assertedMarkets;

    FinderInterface public finder;
    IERC20 public currency;
    OptimisticOracleV3Interface public oo;
    bool public oracleEnabled;
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
    event MarketAsserted(bytes32 indexed marketId, string assertedOutcome, bytes32 indexed assertionId);
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

    constructor(
        address _finder,
        address _currency,
        address _optimisticOracleV3
    ) {
        finder = FinderInterface(_finder);
        require(_getCollateralWhitelist().isOnWhitelist(_currency), "Unsupported currency");
        currency = IERC20(_currency);
        oo = OptimisticOracleV3Interface(_optimisticOracleV3);
        oracleEnabled = false; // Initially disable oracle functionality
        owner = msg.sender;
    }

    function setOracleEnabled(bool _enabled) external onlyOwner {
        oracleEnabled = _enabled;
    }

    function initializeMarket(
        string memory outcome1,
        string memory outcome2,
        string memory description,
        uint256 reward,
        uint256 requiredBond
    ) public onlyOwner returns (bytes32 marketId) {
        require(bytes(outcome1).length > 0, "Empty first outcome");
        require(bytes(outcome2).length > 0, "Empty second outcome");
        require(keccak256(bytes(outcome1)) != keccak256(bytes(outcome2)), "Outcomes are the same");
        require(bytes(description).length > 0, "Empty description");
        marketId = keccak256(abi.encode(block.number, description));
        require(markets[marketId].outcome1Token == ExpandedERC20(address(0)), "Market already exists");

        ExpandedERC20 outcome1Token = new ExpandedERC20(string(abi.encodePacked(outcome1, " Token")), "O1T", 18);
        ExpandedERC20 outcome2Token = new ExpandedERC20(string(abi.encodePacked(outcome2, " Token")), "O2T", 18);
        outcome1Token.addMinter(address(this));
        outcome2Token.addMinter(address(this));
        outcome1Token.addBurner(address(this));
        outcome2Token.addBurner(address(this));

        markets[marketId] = Market({
            resolved: false,
            assertedOutcomeId: bytes32(0),
            outcome1Token: outcome1Token,
            outcome2Token: outcome2Token,
            reward: reward,
            requiredBond: requiredBond,
            outcome1: bytes(outcome1),
            outcome2: bytes(outcome2),
            description: bytes(description)
        });
        if (reward > 0) currency.transferFrom(msg.sender, address(this), reward); // Transfer reward.

        emit MarketInitialized(
            marketId,
            outcome1,
            outcome2,
            description,
            address(outcome1Token),
            address(outcome2Token),
            reward,
            requiredBond
        );
    }

    function assertMarket(bytes32 marketId, string memory assertedOutcome) public returns (bytes32 assertionId) {
        require(oracleEnabled, "Oracle functionality not enabled"); // Check if oracle is enabled
        // Logic for assertion using Optimistic Oracle...
    }

    function manualResolveMarket(bytes32 marketId, string memory assertedOutcome) public onlyOwner {
        Market storage market = markets[marketId];
        require(market.outcome1Token != ExpandedERC20(address(0)), "Market does not exist");

        bytes32 assertedOutcomeId = keccak256(bytes(assertedOutcome));
        require(
            assertedOutcomeId == keccak256(market.outcome1) ||
            assertedOutcomeId == keccak256(market.outcome2),
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
        if (market.assertedOutcomeId == keccak256(market.outcome1)) {
            payout = outcome1Balance;
        } else if (market.assertedOutcomeId == keccak256(market.outcome2)) {
            payout = outcome2Balance;
        } else {
            payout = 0;
        }

        market.outcome1Token.burn(msg.sender, outcome1Balance);
        market.outcome2Token.burn(msg.sender, outcome2Balance);

        currency.transfer(msg.sender, payout);
        emit TokensSettled(marketId, msg.sender, payout, outcome1Balance, outcome2Balance);

        return payout;
    }

    function _getCollateralWhitelist() internal view returns (AddressWhitelist) {
        return AddressWhitelist(finder.getImplementationAddress(OracleInterfaces.CollateralWhitelist));
    }
}
