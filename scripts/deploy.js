const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Replace with your actual Finder contract and Currency contract addresses
  const finderAddress = process.env.FINDER_CONTRACT_ADDRESS;
  const currencyAddress = process.env.TOKEN_CONTRACT_ADDRESS;

  console.log("Deploying MarketManager contract...");
  const MarketManager = await ethers.deployContract("MarketManager");
  await MarketManager.waitForDeployment();
  console.log("MarketManager contract deployed to:", MarketManager.target);

  console.log("Deploying PredictionMarket contract...");
  const PredictionMarket = await ethers.deployContract("PredictionMarket", [finderAddress, currencyAddress, MarketManager.target]);
  await PredictionMarket.waitForDeployment();
  console.log("PredictionMarket contract deployed to:", PredictionMarket.target);

  console.log("Deploying TradingAndLiquidity contract...");
  const TradingAndLiquidity = await ethers.deployContract("TradingAndLiquidity", [PredictionMarket.target, currencyAddress]);
  await TradingAndLiquidity.waitForDeployment();
  console.log("TradingAndLiquidity contract deployed to:", TradingAndLiquidity.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
