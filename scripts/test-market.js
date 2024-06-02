const { ethers } = require("ethers");
require("dotenv").config();

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract addresses and ABIs
const conditionalTokensWrapperAddress = process.env.CONDITIONAL_TOKENS_WRAPPER_CONTRACT_ADDRESS;
const marketMakerAddress = process.env.MARKET_MAKER_CONTRACT_ADDRESS;
const collateralTokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;

const ConditionalTokensWrapperArtifact = require('../artifacts/contracts/ConditionalTokensWrapper.sol/ConditionalTokensWrapper.json');
const MarketMakerArtifact = require('../artifacts/contracts/MarketMaker.sol/MarketMaker.json');
const ERC20Artifact = require('../artifacts/contracts/IERC20.sol/IERC20.json');

const conditionalTokensWrapper = new ethers.Contract(conditionalTokensWrapperAddress, ConditionalTokensWrapperArtifact.abi, wallet);
const marketMaker = new ethers.Contract(marketMakerAddress, MarketMakerArtifact.abi, wallet);
const collateralToken = new ethers.Contract(collateralTokenAddress, ERC20Artifact.abi, wallet);

const runTests = async () => {
  try {
    // Example market ID and parameters
    const marketId = 1; // Assuming this is the first market
    const amount = ethers.parseEther("1"); // Amount of collateral tokens

    // Approve collateral tokens for market maker
    const approveTx = await collateralToken.approve(marketMakerAddress, amount);
    await approveTx.wait();
    console.log("Collateral tokens approved:", approveTx.hash);

    // Add liquidity to the market
    const addLiquidityTx = await marketMaker.addLiquidity(marketId, amount);
    await addLiquidityTx.wait();
    console.log("Liquidity added to the market:", addLiquidityTx.hash);

    // Buy outcome shares
    // const outcomeIndex = 0; // 0 for 'yes' outcome
    // const buyOutcomeTx = await conditionalTokensWrapper.buyOutcome(marketId, outcomeIndex, amount);
    // await buyOutcomeTx.wait();
    // console.log("Outcome shares bought:", buyOutcomeTx.hash);

    // Check market details
    const marketDetails = await marketMaker.getMarket(marketId);
    console.log("Market details:", marketDetails);

    // Check liquidity
    const liquidity = await marketMaker.getMarketLiquidity(marketId, wallet.address);
    console.log("Liquidity provided by user:", ethers.formatEther(liquidity));
  } catch (error) {
    console.error("Error running tests:", error);
  }
};

runTests();
