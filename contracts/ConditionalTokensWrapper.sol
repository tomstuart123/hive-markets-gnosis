// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IConditionalTokens.sol"; // Adjust the path if necessary

contract ConditionalTokensWrapper {
    IConditionalTokens public conditionalTokens;

    constructor(address _conditionalTokensAddress) {
        conditionalTokens = IConditionalTokens(_conditionalTokensAddress);
    }

    function prepareCondition(
        address oracle,
        bytes32 questionId,
        uint outcomeSlotCount
    ) external {
        require(oracle != address(0), "Invalid oracle address");
        require(questionId != bytes32(0), "Invalid questionId");
        require(outcomeSlotCount > 0, "Invalid outcomeSlotCount");

        // Debugging event
        emit DebugPrepareCondition(oracle, questionId, outcomeSlotCount);

        conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
    }

    // Add a debug event to help trace issues
    event DebugPrepareCondition(address oracle, bytes32 questionId, uint outcomeSlotCount);

    function reportPayouts(
        bytes32 questionId,
        uint[] calldata payouts
    ) external {
        conditionalTokens.reportPayouts(questionId, payouts);
    }

    function splitPosition(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint[] calldata partition,
        uint amount
    ) external {
        conditionalTokens.splitPosition(collateralToken, parentCollectionId, conditionId, partition, amount);
    }

    function mergePositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint[] calldata partition,
        uint amount
    ) external {
        conditionalTokens.mergePositions(collateralToken, parentCollectionId, conditionId, partition, amount);
    }

    function redeemPositions(
        address collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint[] calldata indexSets
    ) external {
        conditionalTokens.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets);
    }
}
