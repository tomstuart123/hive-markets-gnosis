const { ethers } = require("ethers");
require("dotenv").config();

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract addresses and ABIs
const predictionMarketAddress = process.env.PREDICTION_MARKET_CONTRACT_ADDRESS;
const tradingAndLiquidityAddress = process.env.TRADING_AND_LIQUIDITY_CONTRACT_ADDRESS;
const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;

const PredictionMarketArtifact = require('../artifacts/contracts/PredictionMarket.sol/PredictionMarket.json');
const TradingAndLiquidityArtifact = require('../artifacts/contracts/TradingAndLiquidity.sol/TradingAndLiquidity.json');
const ERC20Artifact = require('../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');

const predictionMarket = new ethers.Contract(predictionMarketAddress, PredictionMarketArtifact.abi, wallet);
const tradingAndLiquidity = new ethers.Contract(tradingAndLiquidityAddress, TradingAndLiquidityArtifact.abi, wallet);
const collateralToken = new ethers.Contract(tokenAddress, ERC20Artifact.abi, wallet);

const runTests = async () => {
  try {
    // Example market parameters
    const outcome1 = "Outcome 1";
    const outcome2 = "Outcome 2";
    const description = "Test market description";
    const reward = ethers.parseUnits("1", 18); // Reward amount (1 token with 18 decimals)
    const requiredBond = ethers.parseUnits("4", 18); // Required bond amount (4 tokens with 18 decimals)
    const totalAmount = ethers.parseUnits("20", 18); // Total amount of collateral tokens to be used in tests

    // Log initial balance
    const initialBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Initial balance:", ethers.formatUnits(initialBalance, 18));

    // Approve collateral tokens for Prediction Market
    const approveTx = await collateralToken.approve(predictionMarketAddress, totalAmount);
    await approveTx.wait();
    console.log("Collateral tokens approved:", approveTx.hash);

    // Log post-approval allowance
    const postApprovalAllowance = await collateralToken.allowance(wallet.address, predictionMarketAddress);
    console.log("Post-approval allowance:", ethers.formatUnits(postApprovalAllowance, 18));

    // Initialize market
    const initializeMarketTx = await predictionMarket.initializeMarket(
      outcome1,
      outcome2,
      description,
      reward,
      requiredBond
    );
    await initializeMarketTx.wait();
    console.log("Market initialized:", initializeMarketTx.hash);

    // Retrieve the market ID from the logs
    const receipt = await provider.getTransactionReceipt(initializeMarketTx.hash);
    const event = receipt.logs.map(log => {
      try {
        return predictionMarket.interface.parseLog(log);
      } catch (error) {
        return null;
      }
    }).find(event => event && event.name === 'MarketInitialized');

    if (!event) {
      throw new Error('MarketInitialized event not found in logs');
    }

    const marketId = event.args.marketId;

    // Create tokens
    const amount = ethers.parseUnits("1", 18); // Amount of tokens to create (1 token with 18 decimals)
    const createTokensTx = await predictionMarket.createTokens(marketId, amount);
    await createTokensTx.wait();
    console.log("Tokens created:", createTokensTx.hash);

    // Add liquidity
    const addLiquidityTx = await tradingAndLiquidity.addLiquidity(marketId, amount);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    // Buy outcome shares
    const buyOutcomeTx = await tradingAndLiquidity.buyOutcomeShares(marketId, 0, amount); // Buying 'Outcome 1' shares
    await buyOutcomeTx.wait();
    console.log("Outcome shares bought:", buyOutcomeTx.hash);

    // Sell outcome shares
    const sellOutcomeTx = await tradingAndLiquidity.sellOutcomeShares(marketId, 0, amount); // Selling 'Outcome 1' shares
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    // Remove liquidity
    const removeLiquidityTx = await tradingAndLiquidity.removeLiquidity(marketId, amount);
    await removeLiquidityTx.wait();
    console.log("Liquidity removed:", removeLiquidityTx.hash);

    // Redeem tokens
    const redeemTokensTx = await predictionMarket.redeemTokens(marketId, amount);
    await redeemTokensTx.wait();
    console.log("Tokens redeemed:", redeemTokensTx.hash);

    // Manually resolve the market
    const manualResolveMarketTx = await predictionMarket.manualResolveMarket(marketId, outcome1);
    await manualResolveMarketTx.wait();
    console.log("Market resolved:", manualResolveMarketTx.hash);

    // Settle and get payout
    const settleAndGetPayoutTx = await predictionMarket.settleAndGetPayout(marketId);
    await settleAndGetPayoutTx.wait();
    console.log("Payout settled:", settleAndGetPayoutTx.hash);

    // Check final balance
    const finalBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Final balance:", ethers.formatUnits(finalBalance, 18));

    // Check market details
    const marketDetails = await predictionMarket.markets(marketId);
    console.log("Market details:", marketDetails);

  } catch (error) {
    console.error("Error running tests:", error);
  }
};

runTests();
