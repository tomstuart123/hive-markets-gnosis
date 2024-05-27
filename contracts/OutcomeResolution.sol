// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OutcomeResolution {
    address public owner;
    mapping(uint256 => bool) public resolvedMarkets;
    mapping(uint256 => bool) public marketOutcomes;

    event MarketResolved(uint256 indexed marketId, bool outcome);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function resolveMarket(uint256 _marketId, bool _outcome) public onlyOwner {
        require(!resolvedMarkets[_marketId], "Market already resolved");
        resolvedMarkets[_marketId] = true;
        marketOutcomes[_marketId] = _outcome;

        emit MarketResolved(_marketId, _outcome);
    }
}
