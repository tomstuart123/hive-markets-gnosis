// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { FixedProductMarketMaker } from "./FixedProductMarketMaker.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ConditionalTokens } from "./ConditionalTokens.sol";
import { CTHelpers } from "./dependencies/CTHelpers.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";

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

    constructor(
        string memory name_,
        string memory symbol_,
        ConditionalTokens _conditionalTokens,
        IERC20 _collateralToken,
        bytes32[] memory _conditionIds,
        uint _fee
    ) {
        // Pass the necessary parameters to the FixedProductMarketMaker constructor
        implementationMaster = new FixedProductMarketMaker(
            name_,
            symbol_,
            _conditionalTokens,
            _collateralToken,
            _conditionIds,
            _fee
        );
    }

    function createFixedProductMarketMaker(
        string memory name_,
        string memory symbol_,
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
