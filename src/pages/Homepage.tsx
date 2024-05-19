import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
// import CountdownTimer from '../components/Countdown'; // Import the CountdownTimer component


// Define the interface for the market data
interface Market {
  question: string;
  trading: {
    yes: number;
    no: number;
  };
}


interface TimePeriod {
  startTime: Date;
  endTime: Date;
}

const HomePage = () => {
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

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

  return (
    <div>
      <h1>Live Prediction Market</h1>
      {market ? (
        <>
          <h2>{market.question}</h2>
          {/* Render additional market information and charts here */}
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
