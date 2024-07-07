import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

// Define the interface for the market data
interface Market {
  title: string;
  question: string;
  source: string;
  endTime: string;
  trading: {
    yes: number;
    no: number;
  };
}

const HomePage = () => {
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [amount, setAmount] = useState<string>(''); // Amount input for buy/sell and liquidity
  const [maxOutcomeTokensToSell, setMaxOutcomeTokensToSell] = useState<string>(''); // Max outcome tokens to sell input for sell

  useEffect(() => {
    const fetchMarket = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get<Market>('http://localhost:3001/api/live-market');
        setMarket(response.data);
        setError('');  // Clear any previous errors
      } catch (err: any) {
        if (err.response && err.response.status === 404) {
          setError('No live market set yet. Go to the Next Week page to vote for what we should predict next time.');
        } else {
          setError('Failed to fetch market data');
        }
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarket();
  }, []);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  const handleBuyOutcome = async (outcomeIndex: number) => {
    try {
      const response = await axios.post('http://localhost:3001/api/buy-outcome', {
        outcomeIndex,
        amount,
        minOutcomeTokensToBuy: 1 // Assuming minimum outcome tokens to buy is 0
      });
      console.log('Outcome shares bought:', response.data);
    } catch (error) {
      console.error('Error buying outcome shares:', error);
    }
  };

  const handleSellOutcome = async (outcomeIndex: number) => {
    try {
      const response = await axios.post('http://localhost:3001/api/sell-outcome', {
        outcomeIndex,
        amount,
        maxOutcomeTokensToSell
      });
      console.log('Outcome shares sold:', response.data);
    } catch (error) {
      console.error('Error selling outcome shares:', error);
    }
  };

  const handleAddLiquidity = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/add-liquidity', {
        amount,
      });
      console.log('Liquidity added:', response.data);
    } catch (error) {
      console.error('Error adding liquidity:', error);
    }
  };

  const handleRemoveLiquidity = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/remove-liquidity', {
        amount,
      });
      console.log('Liquidity removed:', response.data);
    } catch (error) {
      console.error('Error removing liquidity:', error);
    }
  };

  return (
    <div>
      <h1>Live Prediction Market</h1>
      {market ? (
        <>
          <h2>{market.question}</h2>
          <div>
            <p><strong>Source:</strong> <a href={market.source} target="_blank" rel="noopener noreferrer">{market.source}</a></p>
            <p><strong>End Time:</strong> {new Date(market.endTime).toLocaleString()}</p>
            <p><strong>Trading:</strong> Yes: {market.trading.yes}, No: {market.trading.no}</p>
          </div>
          <div>
            <h3>Buy Outcome Shares</h3>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <button onClick={() => handleBuyOutcome(0)}>Buy Yes</button>
            <button onClick={() => handleBuyOutcome(1)}>Buy No</button>
          </div>
          <div>
            <h3>Sell Outcome Shares</h3>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <button onClick={() => handleSellOutcome(0)}>Sell Yes</button>
            <button onClick={() => handleSellOutcome(1)}>Sell No</button>
          </div>

          <div>
            <h3>Add Liquidity</h3>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <button onClick={handleAddLiquidity}>Add Liquidity</button>
          </div>

          <div>
            <h3>Remove Liquidity</h3>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
            />
            <button onClick={handleRemoveLiquidity}>Remove Liquidity</button>
          </div>

        </>
      ) : error ? (
        <>
          <h2>{error}</h2>
          {error.includes('No live market set yet') && (
            <p>
              Go to the <Link to="/next-week">Next Week page</Link> to vote for what we should predict next time.
            </p>
          )}
        </>
      ) : (
        <p>No market data available.</p>
      )}
    </div>
  );
};

export default HomePage;
