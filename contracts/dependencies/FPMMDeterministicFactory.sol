// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./CTHelpers.sol";
import "../ConditionalTokens.sol";
import "../FixedProductMarketMaker.sol";

contract FPMMDeterministicFactory is ERC1155Receiver {
    using Clones for address;

    ConditionalTokens public conditionalTokens;
    IERC20 public collateralToken;
    bytes32[] public conditionIds;
    uint public fee;
    uint[] public outcomeSlotCounts;
    bytes32[][] public collectionIds;
    uint[] public positionIds;

    constructor(
        ConditionalTokens _conditionalTokens,
        IERC20 _collateralToken,
        bytes32[] memory _conditionIds,
        uint _fee
    ) {
        conditionalTokens = _conditionalTokens;
        collateralToken = _collateralToken;
        conditionIds = _conditionIds;
        fee = _fee;

        outcomeSlotCounts = new uint[](conditionIds.length);
        for (uint i = 0; i < conditionIds.length; i++) {
            uint outcomeSlotCount = conditionalTokens.getOutcomeSlotCount(conditionIds[i]);
            outcomeSlotCounts[i] = outcomeSlotCount;
        }

        collectionIds = new bytes32[][](conditionIds.length);
        _recordCollectionIDsForAllConditions(conditionIds.length, bytes32(0));
        require(positionIds.length == _calculateAtomicOutcomeSlotCount(), "position IDs construction failed!?");
    }

    function _recordCollectionIDsForAllConditions(uint conditionsLeft, bytes32 parentCollectionId) internal {
        if (conditionsLeft == 0) {
            positionIds.push(CTHelpers.getPositionId(collateralToken, parentCollectionId));
            return;
        }

        uint outcomeSlotCount = outcomeSlotCounts[conditionsLeft - 1];
        for (uint i = 0; i < outcomeSlotCount; i++) {
            uint indexSet = 1 << i;
            _recordCollectionIDsForAllConditions(
                conditionsLeft - 1,
                CTHelpers.getCollectionId(parentCollectionId, conditionIds[conditionsLeft - 1], indexSet)
            );
        }
    }

    function createFPMM(
        address implementationMaster,
        uint saltNonce
    ) external returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, saltNonce));
        address clone = implementationMaster.cloneDeterministic(salt);
        FixedProductMarketMaker(clone).initialize(
            conditionalTokens,
            collateralToken,
            conditionIds,
            fee
        );
        return clone;
    }

    function _calculateAtomicOutcomeSlotCount() internal view returns (uint) {
        uint atomicOutcomeSlotCount = 1;
        for (uint i = 0; i < outcomeSlotCounts.length; i++) {
            atomicOutcomeSlotCount *= outcomeSlotCounts[i];
        }
        return atomicOutcomeSlotCount;
    }

    // Override the ERC1155Receiver functions
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
