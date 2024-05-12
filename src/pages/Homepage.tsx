import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CountdownTimer from '../components/Countdown'; // Import the CountdownTimer component


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

function getNextPeriodStartEnd(
  dayStart: number, 
  dayEnd: number, 
  hourStart: number, 
  minuteStart: number, 
  hourEnd: number, 
  minuteEnd: number
): TimePeriod {
  const now = new Date();
  const currentDay = now.getUTCDay();
  const start = new Date(now);
  const end = new Date(now);

  // Adjust start date
  start.setUTCDate(start.getUTCDate() + ((dayStart - currentDay + 7) % 7));
  start.setUTCHours(hourStart, minuteStart, 0, 0);

  // Adjust end date
  end.setUTCDate(end.getUTCDate() + ((dayEnd - currentDay + 7) % 7));
  if (dayEnd < dayStart || (dayEnd === dayStart && (hourEnd < hourStart || (hourEnd === hourStart && minuteEnd < minuteStart)))) {
      end.setUTCDate(end.getUTCDate() + 7); // ensure end is after start
  }
  end.setUTCHours(hourEnd, minuteEnd, 0, 0);

  return { startTime: start, endTime: end };
}

const HomePage = () => {
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { startTime, endTime } = getNextPeriodStartEnd(1, 0, 0, 1, 23, 59); // Monday 00:01 GMT to Sunday 23:59 GMT


  useEffect(() => {
    const fetchMarket = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get<Market>('http://localhost:3001/api/live-market');
        setMarket(response.data);
        setError('');  // Clear any previous errors
      } catch (err) {
        setError('Failed to fetch market data');
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
      <CountdownTimer startTime={startTime} endTime={endTime} />
z      {/* Other component elements */}
      {market ? (
        <>
          <h2>{market.question}</h2>
          {/* Render Chart or other components with appropriate props */}
        </>
      ) : (
        <p>No market data available.</p>
      )}
    </div>
  );
};

export default HomePage;
