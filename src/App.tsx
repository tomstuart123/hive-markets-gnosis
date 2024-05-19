import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Homepage from './pages/Homepage';
import NextWeek from './pages/NextWeek';
import './App.css';
import { PrivyProvider } from '@privy-io/react-auth';
import {usePrivy} from '@privy-io/react-auth';
import Navbar from './components/Navbar'; // Import the Navbar component


const AppInner: React.FC = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();

  return (
    <div className="App">
      <Router>
        <Navbar /> {/* Use the Navbar component */}
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route
            path="/next-week"
            element={<NextWeek ready={ready} authenticated={authenticated} user={user} login={login} logout={logout} />}
          />
        </Routes>
      </Router>
    </div>
    
  );
};

function App() {
  return (
    <PrivyProvider appId="clw0h94py05br12ckgvi2r8eq" config={{
        // Add any required configuration options here
        appearance: {
          theme: 'dark', accentColor: '#676FFF', logo: 'https://assets-global.website-files.com/644a3d469d569d0a4b4c96db/64fae42925906a32c072afb4_oV45VUOGfNWS68fgdyLZzFjen5ixB4h1L0GAnvGBcOk.png'
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets'
        }
      }}>
      <div className="App">
        
      <AppInner />
      </div>
    </PrivyProvider>
  );
}

export default App;
