const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get the balance of the deployer
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));

  // Deploy ConditionalTokens without any arguments
  const conditionalTokens = await ethers.deployContract("ConditionalTokens");
  const conditionalTokensAddress = await conditionalTokens.getAddress();
  console.log("ConditionalTokens deployed to:", conditionalTokensAddress);

  // Deploy an ERC20 collateral token for testing (you may replace this with an actual deployed ERC20 token address)
  const erc20Token = await ethers.deployContract("ERC20Mintable");
  const erc20TokenAddress = await erc20Token.getAddress();
  console.log("ERC20Token deployed to:", erc20TokenAddress);

  // mint some tokens to my wallets
   const mintAmount = ethers.parseUnits("10000", 18); // Mint 1000 tokens
   const mintTx = await erc20Token.mint(deployer.address, mintAmount);
   await mintTx.wait();
   console.log(`Minted ${ethers.formatUnits(mintAmount, 18)} tokens to deployer wallet`);
 
   // Check the balance of ERC20 tokens
   const tokenBalance = await erc20Token.balanceOf(deployer.address);
   console.log("ERC20 token balance:", ethers.formatUnits(tokenBalance, 18));
 
  // Fund the trader accounts with ERC20 tokens
  const traders = [process.env.GANACHE_TRADER_1, process.env.GANACHE_TRADER_2];
  for (const trader of traders) {
    const transferAmount = ethers.parseUnits("3000", 18); // Transfer 3000 tokens to each trader
    const transferTx = await erc20Token.transfer(trader, transferAmount); // Transfer 3333 tokens to each trader
    await transferTx.wait();
    const traderBalance = await erc20Token.balanceOf(trader);
    console.log(`Funded trader ${trader} with ERC20 tokens. Balance: ${ethers.formatUnits(traderBalance, 18)}`);
  }

  const tokenBalance2 = await erc20Token.balanceOf(deployer.address);
   console.log("ERC20 token balance:", ethers.formatUnits(tokenBalance2, 18));


  // Deploy FPMMDeterministicFactory
  const FPMMDeterministicFactory = await ethers.deployContract("FPMMDeterministicFactory");
  const fpmmDeterministicFactoryAddress = await FPMMDeterministicFactory.getAddress();
  console.log("FPMMDeterministicFactory deployed to:", fpmmDeterministicFactoryAddress);

  // Save the contract addresses for server integration
  saveContractAddresses({
    ConditionalTokens: conditionalTokensAddress,
    ERC20Token: erc20TokenAddress,
    FPMMDeterministicFactory: fpmmDeterministicFactoryAddress,
  });
}

function saveContractAddresses(contracts) {
  const contractsDir = __dirname + "/../contracts";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const addresses = {};

  for (const [name, address] of Object.entries(contracts)) {
    addresses[name] = address;
  }

  fs.writeFileSync(
    contractsDir + "/contract-addresses.json",
    JSON.stringify(addresses, undefined, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
