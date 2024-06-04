// note I may have to change how I store data with BigInt as I'm using Big numbers

import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from "ethers";
import dotenv from "dotenv";
import VotePowerArtifact from './artifacts/contracts/votepower.sol/VotePower.json'; // Import the JSON file
import ConditionalTokensWrapperArtifact from './artifacts/contracts/ConditionalTokensWrapper.sol/ConditionalTokensWrapper.json';
import MarketMakerArtifact from './artifacts/contracts/MarketMaker.sol/MarketMaker.json'; // Import MarketMaker artifact
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
}

// let submissions: Submission[] = [];
let liveMarket: LiveMarket | null = null;

// Track if a wallet has voted per submission period
// let userVotes: { [address: string]: boolean } = {};

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const ERC20Artifact = require('./artifacts/contracts/IERC20.sol/IERC20.json');
const managedSigner = new NonceManager(wallet);  // Wrap the wallet with NonceManager


const votePowerContract = new ethers.Contract(
  process.env.VOTE_POWER_CONTRACT_ADDRESS!,
  VotePowerArtifact.abi,
  managedSigner
);


// const collateralToken = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS!, CollateralTokenArtifact.abi, wallet);
const collateralToken = new ethers.Contract(
  process.env.TOKEN_CONTRACT_ADDRESS!, 
  ERC20Artifact.abi, 
  managedSigner
);


const conditionalTokensWrapperContract = new ethers.Contract(
  process.env.CONDITIONAL_TOKENS_WRAPPER_CONTRACT_ADDRESS!,
  ConditionalTokensWrapperArtifact.abi,
  managedSigner
);

const marketMakerContract = new ethers.Contract(
  process.env.MARKET_MAKER_CONTRACT_ADDRESS!,
  MarketMakerArtifact.abi,
  managedSigner
);

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

// Call this function when the server starts
initializeLiveMarket();

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
  // if (isSubmissionPeriod()) {
  //   return res.status(403).json({ message: 'Cannot set live market during submission period' });
  // }
  try {
    const submissions = await Submission.find(); // FETCH SUBMISSIONS FROM MONGODB
    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions available to set as a live market." });
    }
    
    const winningSubmission = submissions.reduce((prev, current) => (prev.votes > current.votes ? prev : current));
    liveMarket = {
      ...winningSubmission.toObject(),
      trading: {
        yes: 0.5, // Example initial trading value
        no: 0.5  // Example initial trading value
      }
    };

    await LiveMarket.deleteMany(); // Clear any existing live markets
    const savedLiveMarket = new LiveMarket(liveMarket);
    await savedLiveMarket.save();

    // Get the questionId from the submission ID
    let questionId;
    try {
      const uniqueString = `${(winningSubmission._id as string).toString()}-${Date.now()}`;
      questionId = ethers.keccak256(ethers.toUtf8Bytes(uniqueString));
      console.log(`Generated questionId: ${questionId}`);
    } catch (error) {
      console.error('Error generating questionId:', error);
      return res.status(500).json({ message: 'Error generating questionId', error });
    }

    // Set endTime to 9 days in the future for now. UPDATE THIS LATER
    const currentTime = new Date();
    const futureTime = new Date(currentTime);
    futureTime.setDate(currentTime.getDate() + 9);
    const endTimeTimestamp = Math.floor(futureTime.getTime() / 1000); // Convert endTime to a Unix timestamp
    console.log(`EndTime Timestamp: ${endTimeTimestamp}`);    
    
    const oracle = wallet.address;
    const outcomeSlotCount = 2; // For yes/no market
    console.log(`Oracle address: ${oracle}, Outcome slot count: ${outcomeSlotCount}`);
    console.log(`ID=${questionId},Oracle=${oracle},Counter=${outcomeSlotCount},`)

    let nonce = await provider.getTransactionCount(wallet.address);
    console.log("Current nonce:", nonce);

    try {
      const prepareConditionTx = await conditionalTokensWrapperContract.prepareCondition(oracle, questionId, outcomeSlotCount, {
        gasLimit: 500000 // Adjust this value as needed
      });      
      await prepareConditionTx.wait();
      console.log("Condition prepared:", prepareConditionTx.hash);
    } catch (error) {
      console.error('Error preparing condition:', error);
      return res.status(500).json({ message: 'Error preparing condition', error });
    }

    console.log("Current nonce:", nonce);

    const amountToApprove = ethers.parseEther("1");
    console.log("Amount to approve (in wei):", amountToApprove.toString());
    
    const currentAllowance = await collateralToken.allowance(wallet.address, marketMakerContract.target);
    console.log("Current allowance:", currentAllowance.toString());
    
    try {
      console.log("Attempting to approve collateral tokens...");
      const approveTx = await collateralToken.approve(marketMakerContract.target, amountToApprove, {
        // nonce: nonce++ // Use the current nonce and increment
      });
      await approveTx.wait();
      console.log("Collateral tokens approved for creating market:", approveTx.hash);
    } catch (error) {
      console.error('Error approving collateral tokens:', error);
      return res.status(500).json({ message: 'Error approving collateral tokens', error });
    }
    

    console.log("Current nonce:", nonce);

    
    try {
      console.log("Creating market in MarketMaker contract...");
      console.log(liveMarket.title, liveMarket.question, liveMarket.source, endTimeTimestamp);
      const createMarketTx = await marketMakerContract.createMarket(liveMarket.title, liveMarket.question, liveMarket.source, endTimeTimestamp, ethers.parseEther("1"), 0);
      await createMarketTx.wait();
      console.log("Market created in MarketMaker contract:", createMarketTx.hash);
    } catch (error) {
      console.error('Error creating market in MarketMaker contract:', error);
      return res.status(500).json({ message: 'Error creating market in MarketMaker contract', error });
    }
    
    await Submission.deleteMany(); // CLEAR SUBMISSIONS FOR NEXT CYCLE
    await resetVotes(); // RESET VOTES IN DATABASE
    res.status(201).json(liveMarket);
  } catch (err) {
    console.error('Unexpected error:', err);
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
  const { marketId, amount } = req.body;
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const approveTx = await collateralToken.approve(marketMakerContract.target, amountParsed);
    await approveTx.wait();
    console.log("Collateral tokens approved for adding liquidity:", approveTx.hash);

    const addLiquidityTx = await marketMakerContract.addLiquidity(marketId, amountParsed);
    await addLiquidityTx.wait();
    console.log("Liquidity added:", addLiquidityTx.hash);

    res.status(200).json({ message: 'Liquidity added', txHash: addLiquidityTx.hash });
  } catch (error) {
    console.error('Error adding liquidity:', error);
    res.status(500).json({ message: 'Error adding liquidity', error });
  }
});

app.post('/api/remove-liquidity', async (req: Request, res: Response) => {
  const { marketId, amount } = req.body;
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const removeLiquidityTx = await marketMakerContract.removeLiquidity(marketId, amountParsed);
    await removeLiquidityTx.wait();
    console.log("Liquidity removed:", removeLiquidityTx.hash);

    res.status(200).json({ message: 'Liquidity removed', txHash: removeLiquidityTx.hash });
  } catch (error) {
    console.error('Error removing liquidity:', error);
    res.status(500).json({ message: 'Error removing liquidity', error });
  }
});

app.post('/api/buy-outcome', async (req: Request, res: Response) => {
  const { marketId, outcomeIndex, amount } = req.body;
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const approveTx = await collateralToken.approve(marketMakerContract.target, amountParsed);
    await approveTx.wait();
    console.log("Collateral tokens approved for adding liquidity:", approveTx.hash);
    const buyOutcomeTx = await marketMakerContract.buyOutcome(marketId, outcomeIndex, amountParsed);
    await buyOutcomeTx.wait();
    console.log("Outcome shares bought:", buyOutcomeTx.hash);

    res.status(200).json({ message: 'Outcome shares bought', txHash: buyOutcomeTx.hash });
  } catch (error) {
    console.error('Error buying outcome shares:', error);
    res.status(500).json({ message: 'Error buying outcome shares', error });
  }
});

app.post('/api/sell-outcome', async (req: Request, res: Response) => {
  const { marketId, outcomeIndex, amount } = req.body;
  try {
    const amountParsed = ethers.parseUnits(amount, 18);
    const sellOutcomeTx = await marketMakerContract.sellOutcome(marketId, outcomeIndex, amountParsed);
    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    res.status(200).json({ message: 'Outcome shares sold', txHash: sellOutcomeTx.hash });
  } catch (error) {
    console.error('Error selling outcome shares:', error);
    res.status(500).json({ message: 'Error selling outcome shares', error });
  }
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
