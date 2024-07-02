// note I may have to change how I store data with BigInt as I'm using Big numbers

import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from "ethers";
import dotenv from "dotenv";
import mongoose from 'mongoose';
import Submission from './models/Submission'; // Import the Submission model
import UserVote from './models/UserVote'; // IMPORT THE USERVOTE MODEL
import { keccak256, toUtf8Bytes, id as ethersId } from 'ethers';
import { NonceManager, Signer } from 'ethers';
import LiveMarket from './models/LiveMarket'; // Import the LiveMarket model;
 


dotenv.config(); // Ensure this is called to load .env variables

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());


mongoose.connect(process.env.MONGO_URI!, {})
  .then(() => {console.log('Connected to MongoDB');})
  .catch(err => {console.error('Failed to connect to MongoDB', err);});

interface Submission {
  _id: string;
  title: string;
  question: string;
  outcomes: string[];
  source: string;
  endTime: string;
  votes: number;
}

interface LiveMarket extends Submission {
  trading: {
    yes: number;
    no: number;
  };
  marketAddress: string; // Add this line
  questionId: string;
}

// let submissions: Submission[] = [];
let liveMarket: LiveMarket | null = null;

// Track if a wallet has voted per submission period
// let userVotes: { [address: string]: boolean } = {};

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const managedSigner = new NonceManager(wallet);  // Wrap the wallet with NonceManager

// get contract abis
const ERC20Artifact = require('./artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json');
const ConditionalTokensArtifact = require('./artifacts/contracts/ConditionalTokens.sol/ConditionalTokens.json');
const FixedProductMarketMakerFactoryArtifact = require('./artifacts/contracts/FixedProductMarketMakerFactory.sol/FixedProductMarketMakerFactory.json');
const VotePowerArtifact = require('./artifacts/contracts/votepower.sol/VotePower.json'); // Import the JSON file
const FixedProductMarketMakerArtifact = require('./artifacts/contracts/FixedProductMarketMaker.sol/FixedProductMarketMaker.json');


// get contract abis
const collateralToken = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS!, ERC20Artifact.abi, managedSigner);
const factory = new ethers.Contract(
  process.env.FIXED_PRODUCT_MARKET_MAKER_FACTORY_ADDRESS!,
  FixedProductMarketMakerFactoryArtifact.abi,
  managedSigner
);
const conditionalTokens = new ethers.Contract(
  process.env.CONDITIONAL_TOKENS_CONTRACT_ADDRESS!,
  ConditionalTokensArtifact.abi,
  managedSigner
);


const votePowerContract = new ethers.Contract(
  process.env.VOTE_POWER_CONTRACT_ADDRESS!,
  VotePowerArtifact.abi,
  managedSigner
);

// Initialize live market from the database
const initializeLiveMarket = async () => {
  try {
    const savedLiveMarket = await LiveMarket.findOne();
    if (savedLiveMarket) {
      liveMarket = savedLiveMarket.toObject();
    }
  } catch (error) {
    console.error('Error initializing live market:', error);
  }
};


// Simulated function to determine the contest period
const isSubmissionPeriod = (): boolean => {
  //creates a new Date object representing the current date and time.
  const now = new Date();
  //This retrieves the day of the week in UTC time, where 0 is Sunday, 1 is Monday, and so on up to 6 which is Saturday.
  const day = now.getUTCDay();
  //This retrieves the hour of the day in UTC time, from 0 (midnight) to 23 (11 PM).
  const hour = now.getUTCHours();
  // Assuming the submission period is from Monday 00:00 UTC to Sunday 23:59 UTC
  return day >= 0 && day <= 6 && hour >= 0 && hour <= 23;
  // when testing a specific hour, use return day >= 0 && day <= 6 && hour >= 14 && hour < 15;
};

const getVotePower = async (account: string): Promise<number> => {
  try {
    if (!ethers.isAddress(account)) {
      throw new Error("Invalid Ethereum address");
    }
    console.log(`Getting vote power for account: ${account}`);
    const votePower = await votePowerContract.getVotePower(account);
    console.log(`Vote power for account ${account}: ${votePower.toString()}`);
    return votePower.toString();
  } catch (error) {
    console.error("Error in getVotePower:", error);
    throw error;
  }
};

const resetVotes = async () => {
  try {
    await UserVote.updateMany({}, { hasVoted: false }); // RESET VOTE STATUS FOR ALL USERS
    console.log("User votes have been reset.");
  } catch (err) {
    console.error("Error resetting user votes:", err);
  }
};


app.get('/api/submissions', async (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Submission period is closed' });
  }
  try {
    const submissions = await Submission.find(); // FETCH SUBMISSIONS FROM MONGODB
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching submissions', error: err });
  }
});

app.post('/api/submissions', async (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Submission period is closed' });
  }
  const { title, question, outcomes, source, endTime } = req.body;
  const newSubmission = new Submission({
    title,
    question,
    outcomes,
    source,
    endTime,
    votes: 0
  });
  try {
    const savedSubmission = await newSubmission.save(); // SAVE THE NEW SUBMISSION TO MONGODB
    res.status(201).json(savedSubmission);
  } catch (err) {
    res.status(500).json({ message: 'Error saving submission', error: err });
  }
});


app.post('/api/vote', async (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Voting period is closed' });
  }
  const { submissionId, walletAddress } = req.body;
  console.log(`Vote request received for submissionId: ${submissionId}, walletAddress: ${walletAddress}`);
  try {
    const submission = await Submission.findById(submissionId); // FETCH SUBMISSION FROM MONGODB
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Check if the user has already voted
    const userVote = await UserVote.findOne({ walletAddress });
    if (userVote && userVote.hasVoted) {
      return res.status(403).json({ message: 'You have already used your vote power for this period.' });
    }
    const votePower = await getVotePower(walletAddress);
    submission.votes += Number(votePower);
    await submission.save(); // SAVE UPDATED SUBMISSION TO MONGODB
    // Save or update the user's vote status
    if (userVote) {
      userVote.hasVoted = true;
      await userVote.save();
    } else {
      const newUserVote = new UserVote({ walletAddress, hasVoted: true });
      await newUserVote.save();
    }

    res.json({ message: "Vote recorded", submission });
  } catch (error) {
    res.status(500).json({ message: "Error fetching vote power", error });
  }
});


app.get('/api/vote-power/:walletAddress', async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  try {
    const votePower = await getVotePower(walletAddress);
    res.json({ votePower });
  } catch (error) {
    console.error("Error fetching vote power:", error);
    res.status(500).json({ message: "Error fetching vote power", error });
  }
});

app.get('/api/winner', async (req: Request, res: Response) => {
  // if (isSubmissionPeriod()) {
  //   return res.status(403).json({ message: 'Cannot fetch winner during submission period' });
  // }
  try {
    const submissions = await Submission.find(); // FETCH SUBMISSIONS FROM MONGODB
    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions available." });
    }
    const winner = submissions.reduce((a, b) => (a.votes > b.votes ? a : b));
    res.json(winner);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching winner', error: err });
  }
});

app.post('/api/set-live-market', async (req: Request, res: Response) => {
  try {
    const submissions = await Submission.find(); // Fetch submissions from MongoDB
    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions available to set as a live market." });
    }

    const winningSubmission = submissions.reduce((prev, current) => (prev.votes > current.votes ? prev : current));
    // Get the questionId from the submission ID
    const uniqueString = `${(winningSubmission._id as string).toString()}-${Date.now()}`;
    const questionId = ethers.keccak256(ethers.toUtf8Bytes(uniqueString));
    const oracle = wallet.address;
    const outcomeSlotCount = 2; // For yes/no market

    const newLiveMarket: LiveMarket = {
      ...winningSubmission.toObject(),
      trading: {
        yes: 0,
        no: 0
      },
      marketAddress: '',
      questionId: questionId
    };

    try {
      const prepareConditionTx = await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount, {
        gasLimit: 500000 // Adjust this value as needed
      });
      await prepareConditionTx.wait();
    } catch (error) {
      return res.status(500).json({ message: 'Error preparing condition', error });
    }

     // Verify the condition was prepared successfully
     const conditionId = await conditionalTokens.getConditionId(oracle, questionId, outcomeSlotCount);
     const outcomeSlotCountFromCondition = Number(await conditionalTokens.getOutcomeSlotCount(conditionId));
     console.log('Condition ID:', conditionId);
     console.log('Outcome Slot Count:', outcomeSlotCountFromCondition);
     console.log('other outcomeslot', outcomeSlotCount)
    // Debug log addresses
    console.log('Conditional Tokens Address:', conditionalTokens.target);
    console.log('Collateral Token Address:', collateralToken.target);

    // const fee = ethers.parseUnits("0.0001", 18);
    const fee = 0;
    const createMarketTx = await factory.createFixedProductMarketMaker(
      conditionalTokens.target,
      collateralToken.target,
      [conditionId],
      fee
    );
    const createMarketReceipt = await createMarketTx.wait();

    const iface = new ethers.Interface(FixedProductMarketMakerFactoryArtifact.abi);
    const parsedLogs = createMarketReceipt.logs
      .map((log: ethers.Log) => {
        try {
          return iface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter((log: ethers.LogDescription | null): log is ethers.LogDescription => log !== null && log.name === 'FixedProductMarketMakerCreation');

    if (parsedLogs.length === 0) {
      return res.status(500).json({ message: 'FixedProductMarketMakerCreation event not found' });
    }
    const fixedProductMarketMakerAddress = parsedLogs[0].args.fixedProductMarketMaker;
    console.log('FixedProductMarketMaker Address:', fixedProductMarketMakerAddress);
    // Update the liveMarket object with the marketAddress
    newLiveMarket.marketAddress = fixedProductMarketMakerAddress;

    // Clear any existing live markets and save the new one
    await LiveMarket.deleteMany();
    const savedLiveMarket = new LiveMarket(newLiveMarket);
    await savedLiveMarket.save();

    // Update the global liveMarket variable
    liveMarket = savedLiveMarket.toObject();

    await Submission.deleteMany(); // Clear submissions for next cycle
    await resetVotes(); // Reset votes in database

    res.status(201).json(savedLiveMarket);
  } catch (err) {
    res.status(500).json({ message: 'Error setting live market', error: err });
  }
});




// Endpoint to get the current live market
app.get('/api/live-market', async (req: Request, res: Response) => {
  try {
    const liveMarket = await LiveMarket.findOne();
    if (liveMarket) {
      res.json(liveMarket);
    } else {
      res.status(404).json({ message: "No live market set" });
    }
  } catch (error) {
    console.error('Error fetching live market:', error);
    res.status(500).json({ message: 'Error fetching live market', error });
  }
});

app.post('/api/add-liquidity', async (req: Request, res: Response) => {
  const { amount } = req.body;
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const approveTx = await collateralToken.approve(liveMarket.marketAddress, amountParsed);
    await approveTx.wait();
    console.log("Collateral tokens approved for adding liquidity:", approveTx.hash);

    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
    const addLiquidityTx = await fixedProductMarketMaker.addFunding(amountParsed, []);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    res.status(200).json({ message: 'Liquidity added', txHash: addLiquidityTx.hash });
  } catch (error) {
    console.error('Error adding liquidity:', error);
    res.status(500).json({ message: 'Error adding liquidity', error });
  }
});


app.post('/api/remove-liquidity', async (req: Request, res: Response) => {
  const { amount } = req.body;
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
    const removeLiquidityTx = await fixedProductMarketMaker.removeFunding(amountParsed);
    await removeLiquidityTx.wait();
    console.log("Liquidity removed:", removeLiquidityTx.hash);

    res.status(200).json({ message: 'Liquidity removed', txHash: removeLiquidityTx.hash });
  } catch (error) {
    console.error('Error removing liquidity:', error);
    res.status(500).json({ message: 'Error removing liquidity', error });
  }
});


app.post('/api/buy-outcome', async (req: Request, res: Response) => {
  const { outcomeIndex, amount, minOutcomeTokensToBuy } = req.body;
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
    const approveTx = await collateralToken.approve(liveMarket.marketAddress, amountParsed);
    await approveTx.wait();
    console.log("Collateral tokens approved for buying outcome:", approveTx.hash);

    const buyOutcomeTx = await fixedProductMarketMaker.buy(amountParsed, outcomeIndex, minOutcomeTokensToBuy);
    await buyOutcomeTx.wait();
    console.log("Outcome shares bought:", buyOutcomeTx.hash);

    res.status(200).json({ message: 'Outcome shares bought', txHash: buyOutcomeTx.hash });
  } catch (error) {
    console.error('Error buying outcome shares:', error);
    res.status(500).json({ message: 'Error buying outcome shares', error });
  }
});

app.post('/api/calc-sell-amount', async (req: Request, res: Response) => {
  const { outcomeIndex, amount } = req.body;

  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    console.log('Calculating Sell Amount with Parameters:');
    console.log('Outcome Index:', outcomeIndex);
    console.log('Amount:', amount);

    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    console.log('Parsed Amount:', amountParsed.toString());
    console.log('Market Address:', liveMarket.marketAddress);

    const maxOutcomeTokensToSell = await fixedProductMarketMaker.calcSellAmount(amountParsed, outcomeIndex);
    console.log('Max Outcome Tokens to Sell:', maxOutcomeTokensToSell.toString());

    res.status(200).json({ maxOutcomeTokensToSell: maxOutcomeTokensToSell.toString() });
  } catch (error) {
    console.error('Error calculating sell amount:', error);

    if (error instanceof Error) {
      console.error('Error Message:', error.message);

      const errorAny = error as any;  // Explicitly cast to any for dynamic properties

      if (errorAny.code) {
        console.error('Error Code:', errorAny.code);
      }

      if (errorAny.transaction) {
        console.error('Transaction Data:', errorAny.transaction);
      }

      if (errorAny.receipt) {
        console.error('Transaction Receipt:', errorAny.receipt);
      }
    }

    res.status(500).json({ message: 'Error calculating sell amount', error });
  }
});



app.post('/api/sell-outcome', async (req: Request, res: Response) => {
  const { outcomeIndex, amount, maxOutcomeTokensToSell } = req.body;

  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    console.log('Selling Outcome Shares with Parameters:');
    console.log('Outcome Index:', outcomeIndex);
    console.log('Amount:', amount);
    console.log('Max Outcome Tokens to Sell:', maxOutcomeTokensToSell);

    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    console.log('Parsed Amount:', amountParsed.toString());
    console.log('Market Address:', liveMarket.marketAddress);

    // Approve the ERC1155 tokens
    const approveERC1155Tx = await conditionalTokens.setApprovalForAll(liveMarket.marketAddress, true);
    await approveERC1155Tx.wait();
    console.log("ERC1155 tokens approved for FixedProductMarketMaker:", approveERC1155Tx.hash);

    const sellOutcomeTx = await fixedProductMarketMaker.sell(amountParsed, outcomeIndex, maxOutcomeTokensToSell);
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    res.status(200).json({ message: 'Outcome shares sold', txHash: sellOutcomeTx.hash });
  } catch (error) {
    console.error('Error selling outcome shares:', error);

    if (error instanceof Error) {
      console.error('Error Message:', error.message);

      const errorAny = error as any;  // Explicitly cast to any for dynamic properties

      if (errorAny.code) {
        console.error('Error Code:', errorAny.code);
      }

      if (errorAny.transaction) {
        console.error('Transaction Data:', errorAny.transaction);
      }

      if (errorAny.receipt) {
        console.error('Transaction Receipt:', errorAny.receipt);
      }
    }

    res.status(500).json({ message: 'Error selling outcome shares', error });
  }
});

app.post('/api/resolve-condition', async (req: Request, res: Response) => {
  const { payoutNumerators } = req.body;

  if (!liveMarket || !liveMarket.marketAddress || !liveMarket.questionId) {
    return res.status(400).json({ message: 'No live market available or question ID is missing' });
  }

  console.log('address', liveMarket.marketAddress)
  console.log('question', liveMarket.questionId)

  try {
    const resolveTx = await conditionalTokens.reportPayouts(liveMarket.questionId, payoutNumerators);
    await resolveTx.wait();
    console.log("Condition resolved:", resolveTx.hash);

    res.status(200).json({ message: 'Condition resolved', txHash: resolveTx.hash });
  } catch (error) {
    console.error('Error resolving condition:', error);
    res.status(500).json({ message: 'Error resolving condition', error });
  }
});


app.post('/api/redeem-positions', async (req: Request, res: Response) => {
  const { indexSets } = req.body;

  if (!liveMarket || !liveMarket.marketAddress || !liveMarket.questionId) {
    return res.status(400).json({ message: 'No live market available or question ID is missing' });
  }

  try {
    const conditionId = await conditionalTokens.getConditionId(wallet.address, liveMarket.questionId, 2);
    console.log('Condition ID for redemption:', conditionId);

    // Check if the condition has been resolved by checking the payoutDenominator
    const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
    if (payoutDenominator.toString() === '0') {
      return res.status(400).json({ message: 'Condition has not been resolved yet' });
    }

    const redeemTx = await conditionalTokens.redeemPositions(
      collateralToken.target,
      ethers.ZeroHash,
      conditionId,
      indexSets
    );
    await redeemTx.wait();
    console.log("Positions redeemed:", redeemTx.hash);

    res.status(200).json({ message: 'Positions redeemed', txHash: redeemTx.hash });
  } catch (error) {
    console.error('Error redeeming positions:', error);

    if (error instanceof Error) {
      console.error('Error Message:', error.message);

      const errorAny = error as any;  // Explicitly cast to any for dynamic properties

      if (errorAny.code) {
        console.error('Error Code:', errorAny.code);
      }

      if (errorAny.transaction) {
        console.error('Transaction Data:', errorAny.transaction);
      }

      if (errorAny.receipt) {
        console.error('Transaction Receipt:', errorAny.receipt);
      }
    }

    res.status(500).json({ message: 'Error redeeming positions', error });
  }
});


app.get('/api/current-liquidity', async (req: Request, res: Response) => {
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
    
    // Fetch outcome token balances
    const poolBalances = await fixedProductMarketMaker.getPoolBalances();
    console.log("Pool Balances:", poolBalances);

    // Fetch collateral token balance
    const collateralBalance = await collateralToken.balanceOf(liveMarket.marketAddress);
    console.log("Collateral Token Balance:", ethers.formatUnits(collateralBalance, 18));

     // Calculate outcome token prices
     const totalBalance = poolBalances.reduce((acc: bigint, balance: bigint) => acc + balance, BigInt(0));
     const prices = poolBalances.map((balance: bigint) => (balance * 10n ** 18n) / totalBalance);
 
     res.status(200).json({
       poolBalances: poolBalances.map((balance: bigint) => balance.toString()),
       collateralBalance: ethers.formatUnits(collateralBalance, 18), // Format to a readable number
       prices: prices.map((price: bigint) => ethers.formatUnits(price, 18)) // Format prices to readable numbers
     });
  } catch (error) {
    console.error('Error fetching current liquidity:', error);
    res.status(500).json({ message: 'Error fetching current liquidity', error });
  }
});


// app.get('/api/token-prices', async (req: Request, res: Response) => {
//   if (!liveMarket || !liveMarket.marketAddress) {
//     return res.status(400).json({ message: 'No live market available' });
//   }

//   try {
//     const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
//     const poolBalances = await fixedProductMarketMaker.getPoolBalances();

//     const totalBalance = poolBalances.reduce((acc, balance) => acc.add(balance), ethers.BigNumber.from(0));
//     const prices = poolBalances.map(balance => balance.mul(ethers.constants.WeiPerEther).div(totalBalance));
    
//     const formattedPrices = prices.map(price => ethers.formatUnits(price, 18));

//     res.status(200).json({ prices: formattedPrices });
//   } catch (error) {
//     console.error('Error fetching token prices:', error);
//     res.status(500).json({ message: 'Error fetching token prices', error });
//   }
// });

// app.post('/api/withdraw-fees', async (req: Request, res: Response) => {
//   const { account } = req.body;

//   if (!liveMarket || !liveMarket.marketAddress) {
//     return res.status(400).json({ message: 'No live market available' });
//   }

//   try {
//     const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
//     const withdrawFeesTx = await fixedProductMarketMaker.withdrawFees(account);
//     await withdrawFeesTx.wait();
//     console.log("Fees withdrawn:", withdrawFeesTx.hash);

//     res.status(200).json({ message: 'Fees withdrawn', txHash: withdrawFeesTx.hash });
//   } catch (error) {
//     console.error('Error withdrawing fees:', error);
//     res.status(500).json({ message: 'Error withdrawing fees', error });
//   }
// });



app.listen(PORT, async () => {
  await initializeLiveMarket();
  console.log(`Server running on port ${PORT}`);
});
