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
  const erc20Token = await ethers.deployContract("ERC20", ["Test Token", "TTK"]);
  const erc20TokenAddress = await erc20Token.getAddress();
  console.log("ERC20Token deployed to:", erc20TokenAddress);

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
