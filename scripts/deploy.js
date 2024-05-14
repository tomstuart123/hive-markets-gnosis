async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
  
    const TokenAddress = "YOUR_ERC20_TOKEN_ADDRESS"; // Replace with your ERC20 token contract address
    const VotePower = await ethers.getContractFactory("VotePower");
    const votePower = await VotePower.deploy(TokenAddress);
  
    await votePower.deployed();
  
    console.log("VotePower contract deployed to:", votePower.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  