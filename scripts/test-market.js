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
    const amount2 = ethers.parseUnits("0.5", 18); // Amount of collateral tokens (0.5 token with 18 decimals)
    const amount = ethers.parseUnits("1", 18); // Amount of collateral tokens (1 token with 18 decimals)
    const totalAmount = ethers.parseUnits("3", 18); // Assuming we need 3 times the amount for all operations
  
    const initialBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Initial balance:", ethers.formatUnits(initialBalance, 18));

    // Log initial allowance
    const initialAllowance = await collateralToken.allowance(wallet.address, marketMakerAddress);
    console.log("Initial allowance:", ethers.formatUnits(initialAllowance, 18));

    // Approve collateral tokens for market maker
    const approveTx = await collateralToken.approve(marketMakerAddress, totalAmount);
    await approveTx.wait();
    console.log("Collateral tokens approved:", approveTx.hash);

    // Log post-approval allowance
    const postApprovalAllowance = await collateralToken.allowance(wallet.address, marketMakerAddress);
    console.log("Post-approval allowance:", ethers.formatUnits(postApprovalAllowance, 18));

    // Add liquidity to the market
    const addLiquidityTx = await marketMaker.addLiquidity(marketId, amount);
    await addLiquidityTx.wait();
    console.log("Liquidity added to the market:", addLiquidityTx.hash);

    // Log balance after adding liquidity
    const balanceAfterLiquidity = await collateralToken.balanceOf(wallet.address);
    console.log("Balance after adding liquidity:", ethers.formatUnits(balanceAfterLiquidity, 18));

    // Buy outcome shares
    const outcomeIndex = 0; // 0 for 'yes' outcome
    const buyOutcomeTx = await marketMaker.buyOutcome(marketId, outcomeIndex, amount);
    await buyOutcomeTx.wait();
    console.log("Outcome shares bought:", buyOutcomeTx.hash);

    // Log balance after buying outcome shares
    const balanceAfterBuying = await collateralToken.balanceOf(wallet.address);
    console.log("Balance after buying outcome shares:", ethers.formatUnits(balanceAfterBuying, 18));

    // Sell outcome shares
    const sellOutcomeTx = await marketMaker.sellOutcome(marketId, outcomeIndex, amount2); // Selling half the amount bought
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    // Log balance after selling outcome shares
    const balanceAfterSelling = await collateralToken.balanceOf(wallet.address);
    console.log("Balance after selling outcome shares:", ethers.formatUnits(balanceAfterSelling, 18));

    // Remove liquidity from the market
    const removeLiquidityTx = await marketMaker.removeLiquidity(marketId, amount2); // Removing half the initial liquidity
    await removeLiquidityTx.wait();
    console.log("Liquidity removed from the market:", removeLiquidityTx.hash);

    // Log balance after removing liquidity
    const balanceAfterRemovingLiquidity = await collateralToken.balanceOf(wallet.address);
    console.log("Balance after removing liquidity:", ethers.formatUnits(balanceAfterRemovingLiquidity, 18));

    // Check current price of outcome shares
    const currentPriceYes = await marketMaker.getCurrentPrice(marketId, 0, ethers.parseUnits("1", 18));
    const currentPriceNo = await marketMaker.getCurrentPrice(marketId, 1, ethers.parseUnits("1", 18));
    console.log("Current price of 'Yes' outcome shares:", ethers.formatUnits(currentPriceYes, 18));
    console.log("Current price of 'No' outcome shares:", ethers.formatUnits(currentPriceNo, 18));

    // Check probability of outcomes
    const probabilityYes = await marketMaker.getProbability(marketId, 0);
    const probabilityNo = await marketMaker.getProbability(marketId, 1);
    console.log("Probability of 'Yes' outcome:", ethers.formatUnits(probabilityYes, 18));
    console.log("Probability of 'No' outcome:", ethers.formatUnits(probabilityNo, 18));

    // Check market details
    const marketDetails = await marketMaker.getMarket(marketId);
    console.log("Market details:", marketDetails);

    // Check liquidity
    const liquidity = await marketMaker.getMarketLiquidity(marketId, wallet.address);
    console.log("Liquidity provided by user:", ethers.formatUnits(liquidity, 18));
  } catch (error) {
    console.error("Error running tests:", error);
  }
};

runTests();
