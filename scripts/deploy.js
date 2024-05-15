async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    // Replace with your ERC20 token contract address
    const TokenAddress = "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed"; 
    const VotePower = await ethers.getContractFactory("VotePower");
    // deploy it onchain with token address as input
    const votePower = await VotePower.deploy(TokenAddress);
  
    // Wait for the deployment onchain
    await votePower.deployed();
  
    console.log("VotePower contract deployed to:", votePower.address);
  }
  
  //execute deploy.js
  main()
    .then(() => process.exit(0)) // Exit the process if successful
    .catch((error) => {
      console.error(error); // Log any errors
      process.exit(1);// Exit the process with an error code
    });
  