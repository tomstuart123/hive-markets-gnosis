import React, { useState, useEffect } from 'react';
import axios from 'axios';


// Define the interface for the submission
interface Submission {
  id: string;
  title: string;
  question: string;
  outcomes: string[];
  source: string;
  endTime: string;
  votes: number;
}

interface NextWeekProps {
  ready: boolean;
  authenticated: boolean;
  user: any;  // Specify a more precise type if possible
  login: () => void;
  logout: () => void;
}

const NextWeek: React.FC<NextWeekProps> = ({ ready, authenticated, user, login, logout }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [newSubmission, setNewSubmission] = useState({
    title: '',
    question: '',
    outcomes: [],
    source: '',
    endTime: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const disableLogin = !ready || authenticated;
  const disableLogout = !ready || (ready && !authenticated);


  useEffect(() => {
    fetchSubmissions();
  }, []);

   const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewSubmission({
      ...newSubmission,
      [event.target.name]: event.target.value
    });
  };

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get<Submission[]>('http://localhost:3001/api/submissions');
      setSubmissions(response.data);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to fetch submissions');
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Next Week's Contest Submissions</h1>
      {isLoading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      <div>
        <input type="text" name="title" value={newSubmission.title} onChange={handleInputChange} placeholder="Enter title" />
        <input type="text" name="question" value={newSubmission.question} onChange={handleInputChange} placeholder="Enter question" />
        <input type="text" name="source" value={newSubmission.source} onChange={handleInputChange} placeholder="Enter source link" />
        <input type="text" name="endTime" value={newSubmission.endTime} onChange={handleInputChange} placeholder="Enter end time" />
        <button onClick={handleAddSubmission}>Add Submission</button>
      </div>
      <ul>
        {submissions.map((submission) => (
          <li key={submission.id}>
            {submission.title} - Votes: {submission.votes}
            <button onClick={() => handleVote(submission.id)}>Vote</button>
          </li>
        ))}
      </ul>
      <button disabled={disableLogin} onClick={login}>
      Log in
      </button>
      <button disabled={disableLogout} onClick={logout}>
      Log out
      </button>
    </div>
  );
};

export default NextWeek;
