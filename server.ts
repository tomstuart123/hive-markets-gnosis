import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
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

// Simulated function to determine the contest period
const isSubmissionPeriod = (): boolean => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  // Assuming the submission period is from Monday 00:00 UTC to Sunday 23:59 UTC
  return day >= 1 && day <= 7 && hour >= 0 && hour <= 23;
  // when testing this only keeps the period open from 2-3 every day
  // return day >= 1 && day <= 7 && hour >= 14 && hour < 15;

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


app.post('/api/vote', (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Voting period is closed' });
  }
  const { submissionId } = req.body;
  const submission = submissions.find(sub => sub.id === submissionId);
  if (submission) {
    submission.votes++;
    res.json({ message: "Vote recorded", submission });
  } else {
    res.status(404).json({ message: "Submission not found" });
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
  // note currently if two submissions have the same votes, the winner will be the most recent one in the array
  const winner = submissions.reduce((a, b) => (a.votes > b.votes ? a : b));
  submissions = []; // Clear submissions for a new contest cycle
  res.json({ message: "Submissions have been reset.", winner });
});

// NOT REQUIRED UNLESS I WANT TO SET MARKET MANUALLY WITHOUT RESET
// Endpoint to set the live market from the winning submission
// app.post('/api/set-live-market', (req: Request, res: Response) => {
//   if (submissions.length === 0) {
//       return res.status(404).json({ message: "No submissions available to set as a live market." });
//   }
//   const winningSubmission = submissions.reduce((prev, current) => (prev.votes > current.votes ? prev : current));
//   liveMarket = {
//       ...winningSubmission,
//       trading: {
//           yes: 0.5,  // Example initial trading value
//           no: 0.5    // Example initial trading value
//       }
//   };
//   submissions = [];  // Optionally reset submissions for the next contest
//   res.status(201).json(liveMarket);
// });

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
