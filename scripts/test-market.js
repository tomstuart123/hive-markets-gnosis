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
    let collateralAmount = ethers.parseUnits("2", 18); // Example collateral amount
    let buyErcAmount = ethers.parseUnits("0.1", 18); // Example trade amount
    let sellErcAmount = ethers.parseUnits("0.1", 18); // Example trade amount
    let approvedAmount = ethers.parseUnits("100", 18); // Example approved amount

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
    
    const approveTx2 = await collateralToken.approve(fixedProductMarketMakerAddress, approvedAmount);
    await approveTx2.wait();
    console.log("Collateral tokens approved for FixedProductMarketMaker:", approvedAmount);
    console.log("cost of liquidity", collateralAmount);
    console.log('type', typeof collateralAmount);

    //  // Add liquidity
    const addLiquidityTx = await fixedProductMarketMaker.addFunding(collateralAmount, []);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    // Buy outcome shares
    const outcomeIndex = 0; // Buying shares for 'Outcome 1'
    for (let i = 0; i <22; i++) { // Adjust the loop count as needed
      const buyOutcomeTx = await fixedProductMarketMaker.buy(buyErcAmount, outcomeIndex, 1);
      await buyOutcomeTx.wait();
      console.log(`Outcome shares bought ${i + 1}:`, buyOutcomeTx.hash);
    }

    // Approve the FixedProductMarketMaker to manage the ERC1155 tokens
    const approveERC1155Tx = await conditionalTokens.setApprovalForAll(fixedProductMarketMakerAddress, true);
    await approveERC1155Tx.wait();
    console.log("ERC1155 tokens approved for FixedProductMarketMaker");

    const isApproved = await conditionalTokens.isApprovedForAll(wallet.address, fixedProductMarketMakerAddress);
    console.log("Is user approved for market contract:", isApproved);

    // Check balance and prep before selling
    const positionId = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const balance = await conditionalTokens.balanceOf(wallet.address, positionId);
    const maxOutcomeTokensToSell = await fixedProductMarketMaker.calcSellAmount(sellErcAmount, outcomeIndex);
    console.log("Balance of outcome tokens before selling:", ethers.formatUnits(balance, 18));
    console.log('Max1155ToSell',ethers.formatUnits(maxOutcomeTokensToSell, 18))
    console.log('buyAmount', ethers.formatUnits(buyErcAmount, 18))
    console.log('sellAmount', ethers.formatUnits(sellErcAmount, 18))

    // Sell outcome shares
    const sellOutcomeTx = await fixedProductMarketMaker.sell(sellErcAmount, outcomeIndex, maxOutcomeTokensToSell);
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    // Oracle Resolve the condition
    const payoutNumerators = [1, 0]; // Example payout numerators, adjust as needed
    const reportPayoutsTx = await conditionalTokens.reportPayouts(questionId, payoutNumerators);
    await reportPayoutsTx.wait();
    console.log("Condition resolved:", reportPayoutsTx.hash);

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
