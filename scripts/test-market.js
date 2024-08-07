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
    let buyErcAmount = ethers.parseUnits("2.2", 18); // Example trade amount
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
    const fee = ethers.parseUnits("0.0001", 18);
    // const fee = 0;
    const outcomeIndex = 0;

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

    // Check token amounts
    const preLiquidity = await collateralToken.balanceOf(wallet.address);
    console.log("ERC-20 Balance Pre Liquidity:", ethers.formatUnits(preLiquidity, 18));
    const positionIdPre = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const preLiquidityOutcomes = await conditionalTokens.balanceOf(wallet.address, positionIdPre);
    console.log("Balance of ERC1155 outcome tokens before liquidity:", ethers.formatUnits(preLiquidityOutcomes, 18));

    //  // Add liquidity
    const addLiquidityTx = await fixedProductMarketMaker.addFunding(collateralAmount, []);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    // Check token amounts
    const postLiquidity = await collateralToken.balanceOf(wallet.address);
    console.log("ERC-20 Balance After Liquidity but Pre Buy:", ethers.formatUnits(postLiquidity, 18));
    const positionIdPost = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const postLiquidityOutcomes = await conditionalTokens.balanceOf(wallet.address, positionIdPost);
    console.log("Balance of ERC1155 outcome tokens post liquidity:", ethers.formatUnits(postLiquidityOutcomes, 18));
    const liquidityBalance = await fixedProductMarketMaker.balanceOf(wallet.address);
    console.log("User's liquidity token balance post liquidity:", ethers.formatUnits(liquidityBalance, 18));

    // Buy outcome shares
    const buyOutcomeTx = await fixedProductMarketMaker.buy(buyErcAmount, outcomeIndex, 1);
    await buyOutcomeTx.wait();
    console.log(`Outcome shares bought :`, buyOutcomeTx.hash);

    // Check token amounts
    const postBuy = await collateralToken.balanceOf(wallet.address);
    console.log("ERC-20 Balance After Buy:", ethers.formatUnits(postBuy, 18));
    const positionIdPostBuy = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const postBuyOutcomes = await conditionalTokens.balanceOf(wallet.address, positionIdPostBuy);
    console.log("Balance of ERC1155 outcome tokens post buy; pre sell:", ethers.formatUnits(postBuyOutcomes, 18));
    const maxOutcomeTokensToSell = await fixedProductMarketMaker.calcSellAmount(sellErcAmount, outcomeIndex);
    console.log('Max1155ToSell',ethers.formatUnits(maxOutcomeTokensToSell, 18))

    // Fetch and display outcome prices
    const getOutcomePrices = async () => {
      const poolBalances = await fixedProductMarketMaker.getPoolBalances();
      console.log("Pool Balances:", poolBalances);
    
      // Ensure poolBalances is an array of BigInt
      const totalBalance = poolBalances.reduce((acc, balance) => acc + BigInt(balance), 0n);
      console.log("Total Balance:", totalBalance.toString());
    
      // Calculate prices ensuring proper BigInt operations
      const prices = poolBalances.map(balance => (BigInt(balance) * 10n ** 18n) / totalBalance);
      return prices;
    };
    
    // Insert this call after buying outcome tokens
    const outcomePrices = await getOutcomePrices();
    outcomePrices.forEach((price, index) => {
      console.log(`Price of outcome ${index}:`, (Number(price) / 10 ** 18).toFixed(18));
    });


    // Approve the FixedProductMarketMaker to manage the ERC1155 tokens
    const approveERC1155Tx = await conditionalTokens.setApprovalForAll(fixedProductMarketMakerAddress, true);
    await approveERC1155Tx.wait();
    console.log("ERC1155 tokens approved for FixedProductMarketMaker");
    const isApproved = await conditionalTokens.isApprovedForAll(wallet.address, fixedProductMarketMakerAddress);
    console.log("Is user approved for market contract:", isApproved);


    // Sell outcome shares
    const sellOutcomeTx = await fixedProductMarketMaker.sell(sellErcAmount, outcomeIndex, maxOutcomeTokensToSell);
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    // Check token amounts
    const postSell = await collateralToken.balanceOf(wallet.address);
    console.log("ERC-20 Balance After Selling:", ethers.formatUnits(postSell, 18));
    const positionIdPostSell = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const postSellOutcomes = await conditionalTokens.balanceOf(wallet.address, positionIdPostSell);
    console.log("Balance of ERC1155 outcome tokens post sell:", ethers.formatUnits(postSellOutcomes, 18));

    // Fetch and display collected fees
    const collectedFees2 = await fixedProductMarketMaker.collectedFees();
    console.log("Collected Fees:", ethers.formatUnits(collectedFees2, 18));

    // Fetch and display withdrawable fees for the user
    const withdrawableFees = await fixedProductMarketMaker.feesWithdrawableBy(wallet.address);
    console.log("Withdrawable Fees for user:", ethers.formatUnits(withdrawableFees, 18));

    // // Withdraw fees for the user
    // const withdrawFeesTx = await fixedProductMarketMaker.withdrawFees(wallet.address);
    // console.log("Withdraw Tx:", withdrawFeesTx.hash);


    // Oracle (centralised) Resolve the condition
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

    // Check token amounts
    const postWithdrawLiquidity = await collateralToken.balanceOf(wallet.address);
    console.log("ERC-20 Balance After Withdraw Liquidity:", ethers.formatUnits(postWithdrawLiquidity, 18));
    const positionIdPostWithrdaw = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const postDrawOutcomes = await conditionalTokens.balanceOf(wallet.address, positionIdPostWithrdaw);
    console.log("Balance of ERC1155 outcome tokens post Withdraw Liquidity:", ethers.formatUnits(postDrawOutcomes, 18));
    const liquidityBalancePost = await fixedProductMarketMaker.balanceOf(wallet.address);
    console.log("User's liquidity token balance post liquidity:", ethers.formatUnits(liquidityBalancePost, 18));

    // Redeem positions
    const redeemPositionsTx = await conditionalTokens.redeemPositions(
      tokenAddress,
      ethers.ZeroHash,
      conditionId,
      [1 << outcomeIndex]
    );
    await redeemPositionsTx.wait();
    console.log("Positions redeemed:", redeemPositionsTx.hash);

    // Check final balance of token amounts
    const finalBalance = await collateralToken.balanceOf(wallet.address);
    console.log("Final balance ERC-20s:", ethers.formatUnits(finalBalance, 18));
    const positionIdFinal = await fixedProductMarketMaker.positionIds(outcomeIndex);
    const finalOutcomesBalance = await conditionalTokens.balanceOf(wallet.address, positionIdFinal);
    console.log("Final Balance of ERC1155 outcome tokens :", ethers.formatUnits(finalOutcomesBalance, 18));
  

  } catch (error) {
    console.error("Error running tests:", error);
  }
};

runTests();
