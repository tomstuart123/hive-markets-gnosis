import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Define the interface for the submission
interface Submission {
  id: string;
  title: string;
  question: string;
  outcomes: string[];
  source: string;
  votes: number;
}

interface TimePeriod {
    startTime: Date;
    endTime: Date;
}
  function getNextPeriodStartEnd(
    dayStart: number,  // Expected to be Monday (1 in JavaScript Date getDay)
    dayEnd: number,    // Expected to be Sunday (0 in JavaScript Date getDay)
    hourStart: number, // Hour on Monday when the period starts
    minuteStart: number, // Minute on Monday when the period starts
    hourEnd: number, // Hour on Sunday when the period ends
    minuteEnd: number // Minute on Sunday when the period ends
): TimePeriod {
    const now = new Date();
    const currentDay = now.getUTCDay();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    const start = new Date(now);
    const end = new Date(now);

    // Start time setup
    if (currentDay < dayStart || (currentDay === dayStart && (currentHour < hourStart || (currentHour === hourStart && currentMinute < minuteStart)))) {
        // If today is before the start day, or before the start time on the start day
        start.setUTCDate(start.getUTCDate() + ((dayStart - currentDay + 7) % 7));
    } else if (currentDay > dayEnd || (currentDay === dayEnd && (currentHour > hourEnd || (currentHour === hourEnd && currentMinute > minuteEnd)))) {
        // If today is after the end day, or after the end time on the end day
        start.setUTCDate(start.getUTCDate() + ((7 - currentDay + dayStart) % 7));
    }
    start.setUTCHours(hourStart, minuteStart, 0, 0);

    // End time setup
    if (currentDay > dayEnd || (currentDay === dayEnd && (currentHour > hourEnd || (currentHour === hourEnd && currentMinute > minuteEnd)))) {
        // If today is after the end day or after the end time on the end day
        end.setUTCDate(end.getUTCDate() + ((7 - currentDay + dayEnd) % 7));
    } else {
        end.setUTCDate(end.getUTCDate() + ((dayEnd - currentDay + 7) % 7));
    }
    end.setUTCHours(hourEnd, minuteEnd, 0, 0);

    return { startTime: start, endTime: end };
}


const NextWeek2 = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
//   const [winner, setWinner] = useState<Submission | null>(null); // State to hold the current winner
  const { startTime, endTime } = getNextPeriodStartEnd(1, 0, 0, 0, 23, 59); // Adjusted for Monday start
  const [newSubmission, setNewSubmission] = useState({
    title: '',
    question: '',
    outcomes: [],
    source: '',
    endTime: ''
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewSubmission({
      ...newSubmission,
      [event.target.name]: event.target.value
    });
  };

  const handleAddSubmission = async () => {
    if (!newSubmission.title || !newSubmission.question) {
      setError('Please enter required fields.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post<Submission>('http://localhost:3001/api/submissions', newSubmission);
      setSubmissions([...submissions, response.data]);
      setNewSubmission({ title: '', question: '', outcomes: [], source: '', endTime: '' }); // Reset form
    } catch (err) {
      setError('Failed to add submission');
    } finally {
      setIsLoading(false);
    }
  };


  const fetchSubmissions = async () => {
    setIsLoading(true);
    console.log(endTime);
    try {
      const response = await axios.get<Submission[]>('http://localhost:3001/api/submissions');
      setSubmissions(response.data);  // Set the fetched submissions
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        // Handle the error more specifically based on the response
        setError(`Failed to fetch submissions: ${err.response.data.message || err.response.statusText}`);
      } else {
        setError('Failed to fetch submissions: An unexpected error occurred');
      }
    }finally {
        setIsLoading(false);
      }
  };

  const handleVote = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/api/vote', { submissionId: id });
      fetchSubmissions(); // Re-fetch submissions to update the vote count
    } catch (err) {
      setError(`Failed to vote on submission ${id}`);
    } finally {
      setIsLoading(false);
    }
  };
  

  const handleResetAndFetchWinner = async () => {
    console.log('Reset done')
    // setIsLoading(true);
    // try {
    //     // Fetch the winner before resetting
    //     const winnerResponse = await axios.get<Submission>('http://localhost:3001/api/winner');
    //     setWinner(winnerResponse.data);

    //     // Reset the contest state
    //     await axios.post('http://localhost:3001/api/reset');
    //     setSubmissions([]); // Clear local state after reset
    // } catch (err) {
    //     console.error('Failed to reset contest or fetch winner:', err);
    //     setError('Failed to reset contest or fetch winner');
    // } finally {
    //     setIsLoading(false);
    // }
};

//   useEffect(() => {
//     // const timer = setInterval(() => {
//     //     console.log("Checking end time:", new Date(), endTime);
//     //     if (new Date() >= endTime) {
//     //         console.log("Ending contest and fetching winner");
//     //         handleResetAndFetchWinner();
//     //         clearInterval(timer);
//     //     }
//     // }, 20000); // Checking interval changed to every 20 seconds
    
//     fetchSubmissions();
// //     return () => clearInterval(timer);
// // }, [endTime]);
// }, [endTime]);


  return (
    <div>
      <h1>Next Week's Contest Submissions</h1>
      <input type="text" name="title" value={newSubmission.title} onChange={handleInputChange} placeholder="Enter title"/>
      <input type="text" name="question" value={newSubmission.question} onChange={handleInputChange} placeholder="Enter question"
      />
      <input type="text" name="source" value={newSubmission.source} onChange={handleInputChange} placeholder="Enter source link"
      />
      <input type="text" name="endTime" value={newSubmission.endTime} onChange={handleInputChange} placeholder="Enter end time"
      />
      <button onClick={handleAddSubmission}>Add Submission</button>
      {error && <p>{error}</p>}
      <ul>
        {submissions.map((submission) => (
          <li key={submission.id}>
          {submission.title} - Votes: {submission.votes}
          <button onClick={() => handleVote(submission.id)}>Vote</button>
        </li>
        ))}
      </ul>
    </div>
  );
};

export default NextWeek2;
