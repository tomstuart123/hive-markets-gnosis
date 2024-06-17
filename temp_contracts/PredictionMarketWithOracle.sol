// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "../contracts/PredictionMarket.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol";
import "./MarketManager.sol";

contract PredictionMarketWithOracle is PredictionMarket {
    using SafeERC20 for IERC20;

    OptimisticOracleV3Interface public oo;
    bool public oracleEnabled;

    event MarketAsserted(bytes32 indexed marketId, string assertedOutcome, bytes32 indexed assertionId);

    constructor(
        address _finder,
        address _currency,
        address _optimisticOracleV3,
        address _marketManager
    ) PredictionMarket(_finder, _currency, _marketManager) {
        oo = OptimisticOracleV3Interface(_optimisticOracleV3);
        oracleEnabled = false; // Initially disable oracle functionality
    }

    function setOracleEnabled(bool _enabled) external onlyOwner {
        oracleEnabled = _enabled;
    }

    function assertMarket(bytes32 marketId, string memory assertedOutcome) public returns (bytes32 assertionId) {
        require(oracleEnabled, "Oracle functionality not enabled"); // Check if oracle is enabled
        Market storage market = markets[marketId];
        require(address(market.outcome1Token) != address(0), "Market does not exist");

        bytes32 assertedOutcomeId = keccak256(abi.encodePacked(assertedOutcome));
        require(
            assertedOutcomeId == keccak256(abi.encodePacked(market.outcome1)) ||
            assertedOutcomeId == keccak256(abi.encodePacked(market.outcome2)),
            "Invalid asserted outcome"
        );

        // Interact with the Optimistic Oracle to assert the outcome.
        // Add the required logic for assertion using the Optimistic Oracle...

        // Assume we get an assertionId from the Oracle
        assertionId = keccak256(abi.encodePacked(marketId, assertedOutcomeId, block.timestamp));

        market.assertedOutcomeId = assertedOutcomeId;
        market.resolved = true;

        emit MarketAsserted(marketId, assertedOutcome, assertionId);
        emit MarketResolved(marketId);
    }
}
