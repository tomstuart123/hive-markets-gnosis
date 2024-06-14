

// const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Replace with your actual Finder contract and Currency contract addresses
  const finderAddress = "0xfF4Ec014E3CBE8f64a95bb022F1623C6e456F7dB";
  const currencyAddress = "0x0a5730C865a1804e773FF5cF864862301f0Cef41";

  console.log("Deploying VotePower contract...");
  const votePower = await ethers.deployContract("VotePower", ["0x0a5730C865a1804e773FF5cF864862301f0Cef41"]);
  await votePower.waitForDeployment();
  console.log("VotePower contract deployed to:", votePower.target);

  // Compile and deploy the PredictionMarket contract
  const PredictionMarket = await ethers.deployContract("PredictionMarket", [finderAddress, currencyAddress], { from: deployer.address });
  await PredictionMarket.waitForDeployment();
  console.log("PredictionMarket deployed to:", PredictionMarket.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

