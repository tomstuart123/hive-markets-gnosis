// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract VotePower {
    IERC20 public token;

    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
    }

    function getVotePower(address account) external view returns (uint256) {
        return token.balanceOf(account);
    }
}