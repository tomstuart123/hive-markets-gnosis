// note I may have to change how I store data with BigInt as I'm using Big numbers

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { ethers } from "ethers";
import dotenv from "dotenv";
import VotePowerArtifact from './artifacts/contracts/votepower.sol/VotePower.json'; // Import the JSON file

dotenv.config(); // Ensure this is called to load .env variables

// import cron from 'node-cron';


const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

interface Submission {
  id: string;
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

let submissions: Submission[] = [];
let liveMarket: LiveMarket | null = null;

// Track if a wallet has voted per submission period
let userVotes: { [address: string]: boolean } = {};

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const votePowerContractAddress = "0xd256EBF2Ca9428D8eF43Afe07dF24c9744cAcE3a"; 
const votePowerABI = VotePowerArtifact.abi; // Extract only the ABI part
const votePowerContract = new ethers.Contract(votePowerContractAddress, votePowerABI, provider);

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

const resetVotes = () => {
  userVotes = {};
};

// Define routes
app.get('/api/submissions', (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Submission period is closed' });
  }
  res.json(submissions);
});

app.post('/api/submissions', (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Submission period is closed' });
  }
  const { title, question, outcomes, source, endTime } = req.body;
  const newSubmission: Submission = {
    id: uuidv4(),
    title,
    question,
    outcomes,
    source,
    endTime,
    votes: 0
  };
  submissions.push(newSubmission);
  res.status(201).json(newSubmission);
});


app.post('/api/vote', async (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Voting period is closed' });
  }
  const { submissionId, walletAddress } = req.body;
  console.log(`Vote request received for submissionId: ${submissionId}, walletAddress: ${walletAddress}`);
  const submission = submissions.find(sub => sub.id === submissionId);
  if (submission) {
    // Check if the user has already voted
    if (userVotes[walletAddress]) {
      return res.status(403).json({ message: 'You have already used your vote power for this period.' });
    }
    try {
      const votePowerStr = await getVotePower(walletAddress);
      const votePower = BigInt(votePowerStr);
      submission.votes += Number(votePower);
      userVotes[walletAddress] = true; // Mark the user as having voted
      res.json({ message: "Vote recorded", submission });
    } catch (error) {
      res.status(500).json({ message: "Error fetching vote power", error });
    }
  } else {
    res.status(404).json({ message: "Submission not found" });
  }
});

app.get('/api/vote-power/:walletAddress', async (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  try {
    console.log(`Fetching vote power for wallet address: ${walletAddress}`);
    const votePower = await getVotePower(walletAddress);
    res.json({ votePower });
  } catch (error) {
    console.error("Error fetching vote power:", error);
    res.status(500).json({ message: "Error fetching vote power", error });
  }
});

// Endpoint to determine and fetch the current winner
app.get('/api/winner', (req: Request, res: Response) => {
  // if (isSubmissionPeriod()) {
  //   return res.status(403).json({ message: 'Cannot fetch winner during submission period' });
  // }
  if (submissions.length === 0) {
    return res.status(404).json({ message: "No submissions available." });
  }
  const winner = submissions.reduce((a, b) => (a.votes > b.votes ? a : b));
  res.json(winner);
});

// Endpoint to set the live market from the winning submission
app.post('/api/set-live-market', (req: Request, res: Response) => {
  // if (isSubmissionPeriod()) {
  //   return res.status(403).json({ message: 'Cannot reset during submission period' });
  // }
  if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions available to set as a live market." });
  }
  const winningSubmission = submissions.reduce((prev, current) => (prev.votes > current.votes ? prev : current));
  liveMarket = {
      ...winningSubmission,
      trading: {
          yes: 0.5,  // Example initial trading value
          no: 0.5    // Example initial trading value
      }
  };
  submissions = [];  // Optionally reset submissions for the next contest
  resetVotes();
  res.status(201).json(liveMarket);
});

// Endpoint to get the current live market
app.get('/api/live-market', (req: Request, res: Response) => {
  if (liveMarket) {
      res.json(liveMarket);
  } else {
      res.status(404).json({ message: "No live market set" });
  }
});



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
