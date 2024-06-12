

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const TokenAddress = "0x0a5730C865a1804e773FF5cF864862301f0Cef41"; // Use your actual token address
  const finderAddress = "0xfF4Ec014E3CBE8f64a95bb022F1623C6e456F7dB"; // Finder contract address
  const optimisticOracleAddress = "0x0F7fC5E6482f096380db6158f978167b57388deE"; // Optimistic Oracle contract address

  console.log("Deploying VotePower contract...");
  const votePower = await ethers.deployContract("VotePower", [TokenAddress]);
  await votePower.waitForDeployment();
  console.log("VotePower contract deployed to:", votePower.target);

  // Deploy the PredictionMarket contract
  console.log("Deploying PredictionMarket contract...");
  const predictionMarket = await ethers.deployContract("PredictionMarket", [finderAddress, TokenAddress, optimisticOracleAddress]);
  await predictionMarket.waitForDeployment();
  console.log("PredictionMarket contract deployed to:", predictionMarket.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
      console.error(error);
      process.exit(1);
  });
