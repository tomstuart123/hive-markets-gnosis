async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    // Replace with your ERC20 token contract address
    const TokenAddress = "0x0a5730C865a1804e773FF5cF864862301f0Cef41"; 
    // const VotePower = await ethers.getContractFactory("VotePower");
    // deploy it onchain with token address as input. not this is updated from getcontractfactory due to ethersv6+
    console.log("Deploying VotePower contract...");

    const votePower = await ethers.deployContract("VotePower", [TokenAddress]);
  

    // Wait for the deployment onchain
    // await votePower.deployed();
    // ethers6 updated way
    await votePower.waitForDeployment();
    console.log("VotePower contract deployed to:", votePower.target);
  }
  
  //execute deploy.js
  main()
    .then(() => process.exit(0)) // Exit the process if successful
    .catch((error) => {
      console.error(error); // Log any errors
      process.exit(1);// Exit the process with an error code
    });
  