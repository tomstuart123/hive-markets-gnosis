// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "@uma/core/contracts/common/implementation/ExpandedERC20.sol";

contract MarketManager {
    function createToken(string memory name, string memory symbol) external returns (ExpandedERC20) {
        ExpandedERC20 token = new ExpandedERC20(name, symbol, 18);
        token.addMinter(msg.sender);
        token.addBurner(msg.sender);
        return token;
    }
}
