import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  startTime: Date;
  endTime: Date;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ startTime, endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const start = new Date(startTime);
      const end = new Date(endTime);
      let targetTime = now < start ? start : end;

      const difference = targetTime.getTime() - now.getTime();
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (now >= end) {
        setTimeLeft('Time is up!');
        clearInterval(intervalId);
      } else {
        setTimeLeft('Waiting for next period...');
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [startTime, endTime]);

  return (
    <div>
      <p>Countdown: {timeLeft}</p>
    </div>
  );
};

export default CountdownTimer;
