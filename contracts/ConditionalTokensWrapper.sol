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
        conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
    }

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
