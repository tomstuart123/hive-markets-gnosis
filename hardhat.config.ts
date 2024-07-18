import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-contract-sizer";
import * as dotenv from "dotenv";

dotenv.config();


// const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// if (!PRIVATE_KEY) {
//   throw new Error("Please set your PRIVATE_KEY in a .env file");
// }

if (!ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.1",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",  // Specify the contracts directory
  },
  contractSizer: {
    runOnCompile: true,
    disambiguatePaths: false,
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 12345678 // Optional: specify a block number to fork from
      }
    },
    ganache: {
      url: 'http://127.0.0.1:8545', // URL of your Ganache instance
      // accounts: [PRIVATE_KEY],
      accounts: {
        mnemonic: process.env.GANACHE_MNEMONIC, // Use the mnemonic from your Ganache instance
      },
    },
  },
};

export default config;