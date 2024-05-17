// checkVotePower.js
const { ethers } = require("hardhat");

async function main() {
  // input contract address where deployed
  const contractAddress = "0xa7DE4cBB768A493EF282f9131A05e90A91D4f984"; // Replace with your deployed contract address

  // Get the contract factory for the VotePower contract
  const VotePower = await ethers.getContractFactory("VotePower");

  // Attach to the deployed contract
  const votePower = await VotePower.attach(contractAddress);

  // Replace with an account address you want to check the vote power for
  const accountAddress = "0xC8375cC2C5fA34eba6aC386fECCaBaE1E51158c8"; // Replace with an actual account address

  // Call the getVotePower function on the deployed contract
  const votePowerValue = await votePower.getVotePower(accountAddress);

  // Log the vote power value
  console.log("Vote Power:", votePowerValue.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
