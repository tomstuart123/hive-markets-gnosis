import React from 'react';
import './App.css';
import { PrivyProvider } from '@privy-io/react-auth';
import {usePrivy} from '@privy-io/react-auth';
import NextWeek from './pages/NextWeek';

const AppInner: React.FC = () => {
  const { ready, authenticated, user, login, logout } = usePrivy();

  return (
    <div className="App">
      <NextWeek ready={ready} authenticated={authenticated} user={user} login={login} logout={logout} />
    </div>
  );
};

function App() {
  const {ready, authenticated, user, login, logout} = usePrivy();


  return (
    <PrivyProvider appId="clw0h94py05br12ckgvi2r8eq" config={{
        // Add any required configuration options here
        appearance: {
          theme: 'dark', 
          accentColor: '#676FFF',
          logo: 'https://assets-global.website-files.com/644a3d469d569d0a4b4c96db/64fae42925906a32c072afb4_oV45VUOGfNWS68fgdyLZzFjen5ixB4h1L0GAnvGBcOk.png'
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
