import express, { Request, Response } from 'express';
import cors from 'cors';
import { ethers } from "ethers";
import dotenv from "dotenv";
import mongoose from 'mongoose';
import Submission from './models/Submission'; // Import the Submission model
import UserVote from './models/UserVote'; // Import the UserVote model
import { keccak256, toUtf8Bytes } from 'ethers';
import { NonceManager } from 'ethers';
import LiveMarket from './models/LiveMarket'; // Import the LiveMarket model;

dotenv.config(); // Ensure this is called to load .env variables

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI!, {})
  .then(() => { console.log('Connected to MongoDB'); })
  .catch(err => { console.error('Failed to connect to MongoDB', err); });

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
  isResolved: boolean; // Add this line
  isRedeemed: boolean; // Add this line
}

let liveMarket: LiveMarket | null = null;

// Ethers.js setup
// const provider = new ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
// const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545'); // Local Ganache provider
const wallet = new ethers.Wallet(process.env.GANACHE_OPERATOR_ADDRESS_KEY!, provider);
const managedSigner = new NonceManager(wallet);  // Wrap the wallet with NonceManager

// get contract abis
const ERC20Artifact = require('@gnosis.pm/conditional-tokens-contracts/build/contracts/IERC20.json');
const ConditionalTokensArtifact = require('@gnosis.pm/conditional-tokens-contracts/build/contracts/ConditionalTokens.json');
const FPMMDeterministicFactoryArtifact = require('@gnosis.pm/conditional-tokens-market-makers/build/contracts/FPMMDeterministicFactory.json');
const FixedProductMarketMakerArtifact = require('@gnosis.pm/conditional-tokens-market-makers/build/contracts/FixedProductMarketMaker.json');
const VotePowerArtifact = require('./artifacts/contracts/votepower.sol/VotePower.json'); // Import the JSON file


const collateralToken = new ethers.Contract(process.env.TOKEN_CONTRACT_ADDRESS!, ERC20Artifact.abi, managedSigner);
const factory = new ethers.Contract(
  process.env.FPMM_DETERMINISTIC_FACTORY_ADDRESS!,
  FPMMDeterministicFactoryArtifact.abi,
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
      console.log('Live market initialized:', liveMarket);
    } else {
      console.log('No live market found in database.');
    }
  } catch (error) {
    console.error('Error initializing live market:', error);
  }
};


const isSubmissionPeriod = (): boolean => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return day >= 0 && day <= 6 && hour >= 0 && hour <= 23;
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
    await UserVote.updateMany({}, { hasVoted: false });
    console.log("User votes have been reset.");
  } catch (err) {
    console.error("Error resetting user votes:", err);
  }
};


// const findReturnAmount = async (fixedProductMarketMaker: any, outcomeIndex: number, outcomeTokensToSell: string): Promise<string> => {
//   let lowerBound = 0n;
//   let upperBound = BigInt("1000000000000000000"); // Start with a high upper bound in units of ether (1 ether)
//   let mid: bigint;
//   let calculatedOutcomeTokens: bigint;

//   while (lowerBound < upperBound) {
//     mid = (lowerBound + upperBound) / 2n;
//     console.log('current mid:', mid);

//     try {
//       calculatedOutcomeTokens = BigInt((await fixedProductMarketMaker.calcSellAmount(mid, outcomeIndex)).toString());
//     } catch (error) {
//       console.error('Error in calcSellAmount:', error);
//       upperBound = mid; // Reduce upper bound if error occurs
//       continue;
//     }

//     const outcomeTokensParsedBigInt = ethers.parseUnits(outcomeTokensToSell, 18);
//     // console.log(calculatedOutcomeTokens,outcomeTokensParsedBigInt)

//     if (calculatedOutcomeTokens === outcomeTokensParsedBigInt) {
//       return ethers.formatUnits(mid, 18);
//     }

//     if (calculatedOutcomeTokens < outcomeTokensParsedBigInt) {
//       lowerBound = mid + 1n;
//     } else {
//       upperBound = mid;
//     }
//   }

//   return ethers.formatUnits(lowerBound, 18);
// };




app.get('/api/submissions', async (req: Request, res: Response) => {
  if (!isSubmissionPeriod()) {
    return res.status(403).json({ message: 'Submission period is closed' });
  }
  try {
    const submissions = await Submission.find();
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
    const savedSubmission = await newSubmission.save();
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
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    const userVote = await UserVote.findOne({ walletAddress });
    if (userVote && userVote.hasVoted) {
      return res.status(403).json({ message: 'You have already used your vote power for this period.' });
    }
    const votePower = await getVotePower(walletAddress);
    submission.votes += Number(votePower);
    await submission.save();

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
  try {
    const submissions = await Submission.find();
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
    const submissions = await Submission.find();
    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions available to set as a live market." });
    }



    const winningSubmission = submissions.reduce((prev, current) => (prev.votes > current.votes ? prev : current));
    const uniqueString = `${(winningSubmission._id as string).toString()}-${Date.now()}`;
    const questionId = ethers.keccak256(ethers.toUtf8Bytes(uniqueString));
    console.log('wallet',wallet)
    const oracle = wallet.address;
    console.log('oracle',oracle)
    const outcomeSlotCount = 2;


    const newLiveMarket: LiveMarket = {
      ...winningSubmission.toObject(),
      trading: {
        yes: 0,
        no: 0
      },
      marketAddress: '',
      questionId: questionId,
      isResolved: false, // Initialize as false
      isRedeemed: false  // Initialize as false
    };
    console.log('preparing condition')
    
    const currentNonce = await managedSigner.getNonce();
    console.log('Current nonce:', currentNonce);

    try {
      const prepareConditionTx = await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
      await prepareConditionTx.wait();
    } catch (error) {
      return res.status(500).json({ message: 'Error preparing condition', error });
    }
    console.log('finished condition')


    const conditionId = await conditionalTokens.getConditionId(oracle, questionId, outcomeSlotCount);
    const outcomeSlotCountFromCondition = Number(await conditionalTokens.getOutcomeSlotCount(conditionId));
    console.log('Outcome Slot Count:', outcomeSlotCountFromCondition);
    console.log('other outcomeslot', outcomeSlotCount);

    console.log('Conditional Tokens Address:', conditionalTokens.target);
    console.log('Collateral Token Address:', collateralToken.target);

    // Generate the salt
    const saltNonce = Math.floor(Math.random() * 10000);

    const fee = ethers.parseUnits("0.0001", 18); // Example fee update
// const fee = ethers.parseUnits("0", 18); // Example fee update

    console.log('pre find address');
    const fixedProductMarketMakerAddress = ethers.getCreate2Address(
      process.env.FPMM_DETERMINISTIC_FACTORY_ADDRESS!,
      ethers.solidityPackedKeccak256(["uint256"], [saltNonce]),
      ethers.keccak256(FPMMDeterministicFactoryArtifact.bytecode)
    );

    console.log('approving collateral');
    // Approve the factory contract to use the collateral
    const approveAmount = ethers.parseUnits("2", 18); // Example amount to approve
    const approveTx = await collateralToken.approve(factory, approveAmount);
    await approveTx.wait();
    console.log("Collateral tokens approved for factory contract");


    console.log('creating live market');
    const collateralAmount = ethers.parseUnits("2", 18)

    const createMarketTx = await factory.create2FixedProductMarketMaker(
      saltNonce,
      conditionalTokens.target,
      collateralToken.target,
      [conditionId],
      fee,
      // hard code this for now
      collateralAmount,
      []
    );
    console.log(createMarketTx.hash)
  
    console.log('FixedProductMarketMaker Address:', fixedProductMarketMakerAddress);
    newLiveMarket.marketAddress = fixedProductMarketMakerAddress;

    await LiveMarket.deleteMany();
    const savedLiveMarket = new LiveMarket(newLiveMarket);
    await savedLiveMarket.save();

    liveMarket = savedLiveMarket.toObject();

    await Submission.deleteMany();
    await resetVotes();

    res.status(201).json(savedLiveMarket);
  } catch (err) {
    console.error('Error setting live market:', err);
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
  
  const liveMarket = await LiveMarket.findOne();
  if (!liveMarket || liveMarket.isResolved) {
    return res.status(400).json({ message: 'Market is resolved. Cannot add liquidity.' });
  }

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
  const liveMarket = await LiveMarket.findOne();
  
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
  const liveMarket = await LiveMarket.findOne();
  if (!liveMarket || liveMarket.isResolved) {
    return res.status(400).json({ message: 'Market is resolved. Cannot buy outcome shares.' });
  }
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

  const liveMarket = await LiveMarket.findOne();
  if (!liveMarket || liveMarket.isRedeemed) {
    return res.status(400).json({ message: 'Market is either not live or already redeemed. Cannot sell outcome shares.' });
  }
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {

    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

     // Fetch user's balance for the specific outcome token
     const positionId = await fixedProductMarketMaker.positionIds(0);
     const userBalance = await conditionalTokens.balanceOf(wallet.address, positionId);
     console.log('userOutcometokens to sell', userBalance)
     if (BigInt(userBalance) === BigInt(0)) {
       return res.status(400).json({ message: 'You do not have any tokens to sell.',   });
     }
     console.log('outcome',outcomeIndex)
     console.log('final lowerbound proper', amountParsed)
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

// app.post('/api/sell-outcome-true', async (req: Request, res: Response) => {
//   const { outcomeIndex, outcomeTokensToSell } = req.body;
//   const amount = '0.1'; // Hardcoded amount for now
//   const liveMarket = await LiveMarket.findOne();
//   if (!liveMarket || liveMarket.isRedeemed) {
//     return res.status(400).json({ message: 'Market is either not live or already redeemed. Cannot sell outcome shares.' });
//   }
//   if (!liveMarket || !liveMarket.marketAddress) {
//     return res.status(400).json({ message: 'No live market available' });
//   }

//   try {
//     const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

//     // Fetch user's balance for the specific outcome token
//     const positionId = await fixedProductMarketMaker.positionIds(0);
//     const userBalance = await conditionalTokens.balanceOf(wallet.address, positionId);
//     const outcomeTokensParsedBigInt = ethers.parseUnits(outcomeTokensToSell, 18);

//     // console.log('userOutcometokens to sell', userBalance.toString());
//     // console.log('outcomeTokensParsedBigInt', outcomeTokensParsedBigInt.toString());
//     if (userBalance < outcomeTokensToSell) {
//       return res.status(400).json({ message: 'You do not have enough tokens to sell.' });
//     }

//     // Calculate return amount using binary search
//     const returnAmountString = await findReturnAmount(fixedProductMarketMaker, outcomeIndex, outcomeTokensToSell);
//     const returnAmountParsed = ethers.parseUnits(returnAmountString, 18); // Convert back to BigInt for the contract call
//     const amountParsed = ethers.parseUnits(amount, 18);
//     // console.log('return amount to be returned:', returnAmountParsed.toString());
//     // console.log('amount to be returned:', returnAmountParsed.toString());

//     const approveERC1155Tx = await conditionalTokens.setApprovalForAll(liveMarket.marketAddress, true);
//     await approveERC1155Tx.wait();
//     console.log("ERC1155 tokens approved for FixedProductMçarketMaker:", approveERC1155Tx.hash);

//     console.log('true',returnAmountParsed, outcomeIndex, outcomeTokensToSell)
//     console.log('nottrue',amountParsed, outcomeIndex, outcomeTokensToSell)

//     const sellOutcomeTx = await fixedProductMarketMaker.sell(returnAmountParsed, outcomeIndex, outcomeTokensToSell);

//     await sellOutcomeTx.wait();
//     console.log("Outcome shares sold:", sellOutcomeTx.hash);

//     res.status(200).json({ message: 'Outcome shares sold', txHash: sellOutcomeTx.hash });
//   } catch (error) {
//     console.error('Error selling outcome shares:', error);

//     if (error instanceof Error) {
//       console.error('Error Message:', error.message);

//       const errorAny = error as any; // Explicitly cast to any for dynamic properties

//       if (errorAny.code) {
//         console.error('Error Code:', errorAny.code);
//       }

//       if (errorAny.transaction) {
//         console.error('Transaction Data:', errorAny.transaction);
//       }

//       if (errorAny.receipt) {
//         console.error('Transaction Receipt:', errorAny.receipt);
//       }
//     }

//     res.status(500).json({ message: 'Error selling outcome shares', error });
//   }
// });


app.post('/api/sell-outcome', async (req: Request, res: Response) => {
  const { outcomeIndex, amount, maxOutcomeTokensToSell } = req.body;

  const liveMarket = await LiveMarket.findOne();
  if (!liveMarket || liveMarket.isRedeemed) {
    return res.status(400).json({ message: 'Market is either not live or already redeemed. Cannot sell outcome shares.'});
  }
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {

    const amountParsed = ethers.parseUnits(amount, 18);
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    // // Fetch user's balance for the specific outcome token
    // const positionId = await fixedProductMarketMaker.positionIds(0);
    // const userBalance = await conditionalTokens.balanceOf(wallet.address, positionId);
    // // console.log('userOutcometokens to sell', userBalance)
    // if (BigInt(userBalance) === BigInt(0)) {
    //   return res.status(400).json({ message: 'You do not have any tokens to sell.' });
    // }

    // Calculate the collectionId
    const conditionId = await conditionalTokens.getConditionId(wallet.address, liveMarket.questionId, 2);
    const indexSet = 1 << outcomeIndex; // Calculate the index set for the outcome index
    const collectionId = await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, indexSet);
    // Calculate the positionId
    const positionId = await conditionalTokens.getPositionId(collateralToken.target, collectionId);

    const userBalance = await conditionalTokens.balanceOf(wallet.address, positionId);
    // if (BigInt(userBalance) === BigInt(0)) {
    //   return res.status(400).json({ message: 'You do not have any tokens to sell.' });
    // }

    console.log('my balance', userBalance.toString());

    const approveERC1155Tx = await conditionalTokens.setApprovalForAll(liveMarket.marketAddress, true);
    await approveERC1155Tx.wait();
    console.log("ERC1155 tokens approved for FixedProductMarketMaker:", approveERC1155Tx.hash);

    console.log('true',amountParsed, outcomeIndex, maxOutcomeTokensToSell)
    const sellOutcomeTx = await fixedProductMarketMaker.sell(amountParsed, outcomeIndex, maxOutcomeTokensToSell);

    await sellOutcomeTx.wait();
    console.log("Outcome shares sold:", sellOutcomeTx.hash);

    res.status(200).json({ message: 'Outcome shares sold', sellOutcomeTx });
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

  const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);


  try {
    // Check if the condition has already been resolved
    const conditionId = await conditionalTokens.getConditionId(wallet.address, liveMarket.questionId, 2);
    const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
    if (payoutDenominator.toString() !== '0') {
      return res.status(400).json({ message: 'Condition has already been resolved' });
    }

    // Check tokens

    // const poolBalancesBefore = await fixedProductMarketMaker.getPoolBalances();
    // console.log('Market Pool Balances Before resolution:', poolBalancesBefore);
    const collateralBalanceBefore = await collateralToken.balanceOf(liveMarket.marketAddress);
    console.log('Market Collateral Balance Before resolution:', ethers.formatUnits(collateralBalanceBefore, 18));
    const userCollateral = await collateralToken.balanceOf(wallet.address);
     console.log("User ERC-20 Balance Before resolution:", ethers.formatUnits(userCollateral, 18));
    //  const positionId = await fixedProductMarketMaker.positionIds(0);
    //  const userOutcomeTokens = await conditionalTokens.balanceOf(wallet.address, positionId);
    //  console.log("User Balance of ERC1155 outcome tokens Before resolution:", ethers.formatUnits(userOutcomeTokens, 18));
    // const preLiquidityInMarket = await fixedProductMarketMaker.balanceOf(liveMarket.marketAddress);
    // console.log("Market's liquidity token balance pre resolution:", ethers.formatUnits(preLiquidityInMarket, 18)); 
    // const preLiquidityBalance = await fixedProductMarketMaker.balanceOf(wallet.address);
    //  console.log("User's liquidity token balance post resolution:", ethers.formatUnits(preLiquidityBalance, 18));


    const resolveTx = await conditionalTokens.reportPayouts(liveMarket.questionId, payoutNumerators);
    await resolveTx.wait();
    console.log("Condition resolved:", resolveTx.hash);

    // Update the live market to set isResolved to true
    const updatedLiveMarket = await LiveMarket.findOneAndUpdate(
      { _id: liveMarket._id },
      { $set: { isResolved: true } },
      { new: true }
    );

    liveMarket = updatedLiveMarket?.toObject() ?? null;

    //remove
    if (!liveMarket || !liveMarket.marketAddress || !liveMarket.questionId) {
      return res.status(400).json({ message: 'No live market available or question ID is missing' });
    }

    // Check tokens
    // const poolBalancesAfter = await fixedProductMarketMaker.getPoolBalances();
    // console.log('Market Pool Balances after resolution:', poolBalancesAfter);
    const collateralBalanceAfter = await collateralToken.balanceOf(liveMarket.marketAddress);
    console.log('Market Collateral Balance after resolution::', ethers.formatUnits(collateralBalanceAfter, 18));
     const userCollateralAfter = await collateralToken.balanceOf(wallet.address);
     console.log("User ERC-20 Balance after resolution::", ethers.formatUnits(userCollateralAfter, 18));
    //  const positionIdAfter = await fixedProductMarketMaker.positionIds(0);
    //  const userOutcomeTokensAfter = await conditionalTokens.balanceOf(wallet.address, positionIdAfter);
    //  console.log("User Balance of ERC1155 outcome tokens after resolution::", ethers.formatUnits(userOutcomeTokensAfter, 18));
    //  const postLiquidityBalance = await fixedProductMarketMaker.balanceOf(wallet.address);
    //  console.log("User's liquidity token balance post resolution:", ethers.formatUnits(postLiquidityBalance, 18));
    //  const postLiquidityInMarket = await fixedProductMarketMaker.balanceOf(wallet.address);
    //  console.log("Market's liquidity token balance post resolution:", ethers.formatUnits(postLiquidityInMarket, 18));
   

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

    const payoutDenominator = await conditionalTokens.payoutDenominator(conditionId);
    if (payoutDenominator.toString() === '0') {
      return res.status(400).json({ message: 'Condition has not been resolved yet' });
    }

    console.log('Payout Denominator:', payoutDenominator.toString());

    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    // Check tokens

    // const poolBalancesBefore = await fixedProductMarketMaker.getPoolBalances();
    // console.log('Market Pool Balances Before Redemption:', poolBalancesBefore);
    const collateralBalanceBefore = await collateralToken.balanceOf(liveMarket.marketAddress);
    console.log('Market Collateral Balance Before Redemption:', ethers.formatUnits(collateralBalanceBefore, 18));
     const userCollateral = await collateralToken.balanceOf(wallet.address);
     console.log("User ERC-20 Balance Before Redemption:", ethers.formatUnits(userCollateral, 18));
    //  const positionId = await fixedProductMarketMaker.positionIds(0);
    //  const userOutcomeTokens = await conditionalTokens.balanceOf(wallet.address, positionId);
    //  console.log("User Balance of ERC1155 outcome tokens Before Redemption:", ethers.formatUnits(userOutcomeTokens, 18));
    //  const preLiquidityBalance = await fixedProductMarketMaker.balanceOf(wallet.address);
    //  console.log("User's liquidity token balance post resolution:", ethers.formatUnits(preLiquidityBalance, 18));
    //  const preLiquidityInMarket = await fixedProductMarketMaker.balanceOf(wallet.address);
    //  console.log("Market's liquidity token balance pre resolution:", ethers.formatUnits(preLiquidityInMarket, 18));


    const redeemTx = await conditionalTokens.redeemPositions(
      collateralToken.target,
      ethers.ZeroHash,
      conditionId,
      indexSets
    );
    await redeemTx.wait();
    console.log("Positions redeemed:", redeemTx.hash);

    // Update the live market to set isRedeemed to true
    const updatedLiveMarket = await LiveMarket.findOneAndUpdate(
      { _id: liveMarket._id },
      { $set: { isRedeemed: true } },
      { new: true }
    );

    liveMarket = updatedLiveMarket?.toObject() ?? null;

    console.log('Updated live market after redemption:', liveMarket);

      //remove
    if (!liveMarket || !liveMarket.marketAddress || !liveMarket.questionId) {
      return res.status(400).json({ message: 'No live market available or question ID is missing' });
    }

     // Check tokens

    //  const poolBalancesAfter = await fixedProductMarketMaker.getPoolBalances();
    //  console.log('Market Pool Balances after Redemption:', poolBalancesAfter);
     const collateralBalanceAfter = await collateralToken.balanceOf(liveMarket.marketAddress);
     console.log('Market Collateral Balance after Redemption:', ethers.formatUnits(collateralBalanceAfter, 18));
      const userCollateralAfter = await collateralToken.balanceOf(wallet.address);
      console.log("User ERC-20 Balance after Redemption:", ethers.formatUnits(userCollateralAfter, 18));
      // const positionIdAfter = await fixedProductMarketMaker.positionIds(0);
      // const userOutcomeTokensAfter = await conditionalTokens.balanceOf(wallet.address, positionIdAfter);
      // console.log("User Balance of ERC1155 outcome tokens after Redemption:", ethers.formatUnits(userOutcomeTokensAfter, 18));
      // const postLiquidityBalance = await fixedProductMarketMaker.balanceOf(wallet.address);
      // console.log("User's liquidity token balance post resolution:", ethers.formatUnits(postLiquidityBalance, 18));
      // const postLiquidityInMarket = await fixedProductMarketMaker.balanceOf(wallet.address);
      // console.log("Market's liquidity token balance post resolution:", ethers.formatUnits(postLiquidityInMarket, 18));

    res.status(200).json({ message: 'Positions redeemed', txHash: redeemTx.hash });
  } catch (error) {
    console.error('Error redeeming positions:', error);

    if (error instanceof Error) {
      console.error('Error Message:', error.message);

      const errorAny = error as any;

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

app.get('/api/get-liquidity-and-prices', async (req: Request, res: Response) => {
  
  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);
    
    // Fetch outcome token balances
    const poolBalances: ethers.BigNumberish[] = await fixedProductMarketMaker.getPoolBalances();
    console.log("Pool Balances:", poolBalances);

    // Convert balances to BigInt
    const poolBalancesBigInt = poolBalances.map((balance: ethers.BigNumberish) => BigInt(balance.toString()));
    
    // Fetch collateral token balance
    const collateralBalance = await collateralToken.balanceOf(liveMarket.marketAddress);
    console.log("Collateral Token Balance:", ethers.formatUnits(collateralBalance, 18));

    // Check for zero liquidity
    const totalBalanceBigInt = poolBalancesBigInt.reduce((acc: bigint, balance: bigint) => acc + balance, BigInt(0));
    
    if (totalBalanceBigInt === BigInt(0)) {
      return res.status(200).json({
        poolBalances: poolBalances.map((balance: ethers.BigNumberish) => balance.toString()),
        collateralBalance: ethers.formatUnits(collateralBalance, 18), // Format to a readable number
        prices: [], // No prices available due to zero liquidity
        message: "No liquidity in the market."
      });
    }

    // Calculate outcome token prices
    const prices = poolBalancesBigInt.map((balance: bigint) => (balance * 10n ** 18n) / totalBalanceBigInt);

    res.status(200).json({
      poolBalances: poolBalances.map((balance: any) => balance.toString()),
      collateralBalance: ethers.formatUnits(collateralBalance, 18), // Format to a readable number
      prices: prices.map((price) => ethers.formatUnits(price.toString(), 18)) // Format prices to readable numbers
    });
  } catch (error) {
    console.error('Error fetching current liquidity:', error);
    res.status(500).json({ message: 'Error fetching current liquidity', error });
  }
});


app.get('/api/fees', async (req: Request, res: Response) => {
  const { account } = req.query;

  if (!account || typeof account !== 'string') {
    return res.status(400).json({ message: 'Account address is required and must be a string' });
  }

  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    const collectedFees = await fixedProductMarketMaker.collectedFees();
    console.log("Collected Fees:", ethers.formatUnits(collectedFees, 18));

    if (BigInt(collectedFees) === BigInt(0)) {
      return res.status(200).json({ message: 'No collected fees', collectedFees: '0', withdrawableFees: '0' });
    }

    const withdrawableFees = await fixedProductMarketMaker.feesWithdrawableBy(account);
    console.log("Withdrawable Fees for user:", ethers.formatUnits(withdrawableFees, 18));

    if (BigInt(withdrawableFees) === BigInt(0)) {
      return res.status(200).json({ message: 'No fees available for withdrawal', collectedFees: '0', withdrawableFees: '0' });
    }

    res.status(200).json({
      collectedFees: ethers.formatUnits(collectedFees, 18),
      withdrawableFees: ethers.formatUnits(withdrawableFees, 18),
    });
  } catch (error) {
    console.error('Error reading fees:', error);
    res.status(500).json({ message: 'Error reading fees', error });
  }
});


app.post('/api/withdraw-fees', async (req: Request, res: Response) => {
  const { account } = req.body;
  
  if (!account || typeof account !== 'string') {
    return res.status(400).json({ message: 'Account address is required and must be a string' });
  }

  if (!liveMarket || !liveMarket.marketAddress) {
    return res.status(400).json({ message: 'No live market available' });
  }

  try {
    const fixedProductMarketMaker = new ethers.Contract(liveMarket.marketAddress, FixedProductMarketMakerArtifact.abi, managedSigner);

    // check fees available for collection
    const collectedFees = await fixedProductMarketMaker.collectedFees();
    console.log("Collected Fees:", ethers.formatUnits(collectedFees, 18));

    if (BigInt(collectedFees) === BigInt(0)) {
      return res.status(200).json({ message: 'No collected fees or fees withdrawn', collectedFees: '0', withdrawableFees: '0' });
    }

    const withdrawableFees = await fixedProductMarketMaker.feesWithdrawableBy(account);
    console.log("Withdrawable Fees for user:", ethers.formatUnits(withdrawableFees, 18));

    if (BigInt(withdrawableFees) === BigInt(0)) {
      return res.status(200).json({ message: 'No fees available for withdrawal', collectedFees: '0', withdrawableFees: '0' });
    }

    const withdrawFeesTx = await fixedProductMarketMaker.withdrawFees(account);
    await withdrawFeesTx.wait();
    console.log("Fees withdrawn:", withdrawFeesTx.hash);

    res.status(200).json({ message: 'Fees withdrawn', txHash: withdrawFeesTx.hash });
  } catch (error) {
    console.error('Error withdrawing fees:', error);
    res.status(500).json({ message: 'Error withdrawing fees', error });
  }
});


app.listen(PORT, async () => {
  await initializeLiveMarket();
  console.log(`Server running on port ${PORT}`);
});
