// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { FixedProductMarketMaker } from "./FixedProductMarketMaker.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ConditionalTokens } from "./ConditionalTokens.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";


contract FixedProductMarketMakerFactory {
    event FixedProductMarketMakerCreation(
        address indexed creator,
        FixedProductMarketMaker fixedProductMarketMaker,
        ConditionalTokens indexed conditionalTokens,
        IERC20 indexed collateralToken,
        bytes32[] conditionIds,
        uint fee
    );

    FixedProductMarketMaker public implementationMaster;

    constructor() {
        implementationMaster = new FixedProductMarketMaker();
    }

    function createFixedProductMarketMaker(
        ConditionalTokens conditionalTokens,
        IERC20 collateralToken,
        bytes32[] calldata conditionIds,
        uint fee
    )
        external
        returns (FixedProductMarketMaker)
    {
        FixedProductMarketMaker fixedProductMarketMaker = FixedProductMarketMaker(
            Clones.clone(address(implementationMaster))
        );
        fixedProductMarketMaker.initialize(
            conditionalTokens,
            collateralToken,
            conditionIds,
            fee
        );
        emit FixedProductMarketMakerCreation(
            msg.sender,
            fixedProductMarketMaker,
            conditionalTokens,
            collateralToken,
            conditionIds,
            fee
        );
        return fixedProductMarketMaker;
    }
}
