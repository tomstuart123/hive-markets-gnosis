import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { ethers } from "ethers";
import dotenv from 'dotenv';

dotenv.config();

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

// Ethers.js setup
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_API_URL);
const votePowerContractAddress = "0xd256EBF2Ca9428D8eF43Afe07dF24c9744cAcE3a"; // Replace with your deployed contract address
const votePowerABI = [
  // ABI for the getVotePower function
  "function getVotePower(address account) view returns (uint256)"
];
const votePowerContract = new ethers.Contract(votePowerContractAddress, votePowerABI, provider);

// Simulated function to determine the contest period
const isSubmissionPeriod = (): boolean => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return day >= 0 && day <= 6 && hour >= 0 && hour <= 23;
};

// Function to get vote power from the contract
const getVotePower = async (account: string): Promise<number> => {
  if (!ethers.isAddress(account)) {
    throw new Error("Invalid Ethereum address");
  }
  const votePower = await votePowerContract.getVotePower(account);
  return votePower.toNumber();
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
    try {
      const votePower = await getVotePower(walletAddress);
      submission.votes += votePower;
      res.json({ message: "Vote recorded", submission });
    } catch (error) {
      console.error("Error fetching vote power:", error);
      res.status(500).json({ message: "Error fetching vote power", error });
    }
  } else {
    res.status(404).json({ message: "Submission not found" });
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

// Endpoint to determine and fetch the current winner
app.get('/api/winner', (req: Request, res: Response) => {
  if (isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Cannot fetch winner during submission period' });
  }
  if (submissions.length === 0) {
    return res.status(404).json({ message: "No submissions available." });
  }
  const winner = submissions.reduce((a, b) => (a.votes > b.votes ? a : b));
  res.json(winner);
});

// Endpoint to reset the contest state and set the live market
app.post('/api/reset', (req: Request, res: Response) => {
  if (isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Cannot reset during submission period' });
  }
  if (submissions.length === 0) {
    return res.status(404).json({ message: "No submissions to reset." });
  }
  const winner = submissions.reduce((a, b) => (a.votes > b.votes ? a : b));
  submissions = []; // Clear submissions for a new contest cycle
  res.json({ message: "Submissions have been reset.", winner });
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
