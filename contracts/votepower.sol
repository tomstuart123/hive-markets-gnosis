// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// interface defines methods for ERC20 token contract 
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract VotePower {
    IERC20 public token;
// called once on deploy

    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
    }
// can be called repeatedly with any address as input

    function getVotePower(address account) external view returns (uint256) {
        return token.balanceOf(account);
    }
}
