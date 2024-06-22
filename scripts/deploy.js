// const { ethers } = require("hardhat");

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   console.log("Deploying contracts with the account:", deployer.address);

//   // Replace with your actual Finder contract and Currency contract addresses
//   const finderAddress = process.env.FINDER_CONTRACT_ADDRESS;
//   const currencyAddress = process.env.TOKEN_CONTRACT_ADDRESS;

//   console.log("Deploying MarketManager contract...");
//   const MarketManager = await ethers.deployContract("MarketManager");
//   await MarketManager.waitForDeployment();
//   console.log("MarketManager contract deployed to:", MarketManager.target);

//   console.log("Deploying PredictionMarket contract...");
//   const PredictionMarket = await ethers.deployContract("PredictionMarket", [finderAddress, currencyAddress, MarketManager.target]);
//   await PredictionMarket.waitForDeployment();
//   console.log("PredictionMarket contract deployed to:", PredictionMarket.target);

//   console.log("Deploying TradingAndLiquidity contract...");
//   const TradingAndLiquidity = await ethers.deployContract("TradingAndLiquidity", [PredictionMarket.target, currencyAddress]);
//   await TradingAndLiquidity.waitForDeployment();
//   console.log("TradingAndLiquidity contract deployed to:", TradingAndLiquidity.target);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });



const { ethers } = require("hardhat");
require("dotenv").config();
d
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the acscount:", deployer.address);

  // Deploy ERC20 Collateral Token
  const CollateralToken = await ethers.getContractFactory("ERC20");
  const collateralToken = await CollateralToken.deploy("CollateralToken", "CTK");
  await collateralToken.deployed();
  console.log("CollateralToken deployed to:", collateralToken.address);

  // Deploy ConditionalTokens
  const ConditionalTokens = await ethers.getContractFactory("@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol:ConditionalTokens");
  const conditionalTokens = await ConditionalTokens.deploy();
  await conditionalTokens.deployed();
  console.log("ConditionalTokens deployed to:", conditionalTokens.address);

  // Deploy FixedProductMarketMakerFactory
  const FixedProductMarketMakerFactory = await ethers.getContractFactory("@gnosis.pm/conditional-tokens-market-makers/contracts/FixedProductMarketMakerFactory.sol:FixedProductMarketMakerFactory");
  const factory = await FixedProductMarketMakerFactory.deploy();
  await factory.deployed();
  console.log("FixedProductMarketMakerFactory deployed to:", factory.address);

  // Create a FixedProductMarketMaker instance via the factory
  const tx = await factory.createFixedProductMarketMaker(conditionalTokens.address, collateralToken.address);
  const receipt = await tx.wait();
  const event = receipt.events.find(event => event.event === 'FixedProductMarketMakerCreated');
  const marketMakerAddress = event.args.marketMaker;
  console.log("FixedProductMarketMaker deployed to:", marketMakerAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
