const { ethers } = require("ethers");
require("dotenv").config();

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract addresses and ABIs
const factoryAddress = process.env.FIXED_PRODUCT_MARKET_MAKER_FACTORY_ADDRESS;
const conditionalTokensAddress = process.env.CONDITIONAL_TOKENS_CONTRACT_ADDRESS;
const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;

const FixedProductMarketMakerFactoryArtifact = require('../artifacts/contracts/FixedProductMarketMakerFactory.sol/FixedProductMarketMakerFactory.json');
const FixedProductMarketMakerArtifact = require('../artifacts/contracts/FixedProductMarketMaker.sol/FixedProductMarketMaker.json');
const ConditionalTokensArtifact = require('../artifacts/contracts/ConditionalTokens.sol/ConditionalTokens.json');
const { abi: ERC20Abi } = require('@openzeppelin/contracts/build/contracts/IERC20.json');

const factory = new ethers.Contract(factoryAddress, FixedProductMarketMakerFactoryArtifact.abi, wallet);
const conditionalTokens = new ethers.Contract(conditionalTokensAddress, ConditionalTokensArtifact.abi, wallet);
const collateralToken = new ethers.Contract(tokenAddress, ERC20Abi, wallet);

const runTests = async () => {
  try {
    const description = "Test market description " + Date.now(); // Append timestamp for uniqueness
    const outcomeSlotCount = 2; // Example outcome slot count
    let collateralAmount = ethers.parseUnits("1", 18); // Example collateral amount
    let approvedAmount = ethers.parseUnits("10", 18); // Example collateral amount


    // Log initial balance
    const initialBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Initial balance:", ethers.formatUnits(initialBalance, 18));

    // Approve collateral tokens for Factory
    const approveTx = await collateralToken.approve(factoryAddress, approvedAmount);
    await approveTx.wait();
    console.log("Collateral tokens approved:", approveTx.hash);

    // Set variables
    const oracle = wallet.address;
    const fee = 0;

    // Prepare condition
    const questionId = ethers.keccak256(ethers.toUtf8Bytes(description));
    const prepareConditionTx = await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
    await prepareConditionTx.wait();
    console.log("Condition prepared:", prepareConditionTx.hash);

    // Get condition ID
    const conditionId = await conditionalTokens.getConditionId(oracle, questionId, outcomeSlotCount);
    console.log("Condition ID:", conditionId);

    // Create Fixed Product Market Maker
    const createMarketTx = await factory.createFixedProductMarketMaker(
      conditionalTokensAddress,
      tokenAddress,
      [conditionId],
      fee
    );
    const createMarketReceipt = await createMarketTx.wait();
    console.log("Transaction receipt:", createMarketReceipt);

    // Parse the logs to find the FixedProductMarketMakerCreation event
    const iface = new ethers.Interface(FixedProductMarketMakerFactoryArtifact.abi);
    const parsedLogs = createMarketReceipt.logs
      .map(log => {
        try {
          return iface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter(log => log && log.name === 'FixedProductMarketMakerCreation');

    if (parsedLogs.length === 0) {
      throw new Error('FixedProductMarketMakerCreation event not found');
    }

    const fixedProductMarketMakerAddress = parsedLogs[0].args.fixedProductMarketMaker;
    console.log("FixedProductMarketMaker created at:", fixedProductMarketMakerAddress);

    // create contract instance at this event
    const fixedProductMarketMaker = new ethers.Contract(fixedProductMarketMakerAddress, FixedProductMarketMakerArtifact.abi, wallet);
    // Ensure sufficient allowance for FixedProductMarketMaker to spend tokens
    const approveTx2 = await collateralToken.approve(fixedProductMarketMakerAddress, approvedAmount);
    await approveTx2.wait();
    console.log("Collateral tokens approved for FixedProductMarketMaker:", approvedAmount);
    console.log("cost of liquidity", collateralAmount);
    console.log('type', typeof collateralAmount);

     // Add liquidity
    const addLiquidityTx = await fixedProductMarketMaker.addFunding(collateralAmount, []);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    // Buy outcome shares
    const outcomeIndex = 0; // Buying shares for 'Outcome 1'
    const buyOutcomeTx = await fixedProductMarketMaker.buy(collateralAmount, outcomeIndex, {
      gasLimit: 5000000
    });
    await buyOutcomeTx.wait();
    console.log("Outcome shares bought:", buyOutcomeTx.hash);

    // Sell outcome shares
    const sellOutcomeTx = await fixedProductMarketMaker.sell(collateralAmount, outcomeIndex, {
      gasLimit: 5000000
    });
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    // Remove liquidity
    const removeLiquidityTx = await fixedProductMarketMaker.removeFunding(collateralAmount, {
      gasLimit: 5000000
    });
    await removeLiquidityTx.wait();
    console.log("Liquidity removed:", removeLiquidityTx.hash);

    // Redeem positions
    const redeemPositionsTx = await conditionalTokens.redeemPositions(
      tokenAddress,
      ethers.ZeroHash,
      conditionId,
      [1 << outcomeIndex]
    );
    await redeemPositionsTx.wait();
    console.log("Positions redeemed:", redeemPositionsTx.hash);

    // Check final balance
    const finalBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Final balance:", ethers.formatUnits(finalBalance, 18));

  } catch (error) {
    console.error("Error running tests:", error);
  }
};

runTests();
