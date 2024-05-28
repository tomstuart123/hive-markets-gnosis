async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    const TokenAddress = "0x0a5730C865a1804e773FF5cF864862301f0Cef41"; 
    
    console.log("Deploying VotePower contract...");
    const votePower = await ethers.deployContract("VotePower", [TokenAddress]);
    await votePower.waitForDeployment();
    console.log("VotePower contract deployed to:", votePower.target);

    // Deploy the ConditionalTokens contract
    // console.log("Deploying ConditionalTokens contract...");
    // const ConditionalTokens = await ethers.deployContract("IConditionalTokens");
    // await ConditionalTokens.waitForDeployment();
    // console.log("ConditionalTokens contract deployed to:", ConditionalTokens.target);

    console.log("Deploying ConditionalTokensWrapper contract...");
    const conditionalTokensWrapper = await ethers.deployContract("ConditionalTokensWrapper", [TokenAddress]);
    await conditionalTokensWrapper.waitForDeployment();
    console.log("ConditionalTokensWrapper contract deployed to:", conditionalTokensWrapper.target);

    // Deploy the OutcomeResolution contract
    console.log("Deploying OutcomeResolution contract...");
    const outcomeResolution = await ethers.deployContract("OutcomeResolution");
    await outcomeResolution.waitForDeployment();
    console.log("OutcomeResolution contract deployed to:", outcomeResolution.target);
  

    console.log("Deploying MarketMaker contract...");
    const marketMaker = await ethers.deployContract("MarketMaker", [TokenAddress, conditionalTokensWrapper, outcomeResolution.target]);
    await marketMaker.waitForDeployment();
    console.log("MarketMaker contract deployed to:", marketMaker.target);
  
  }
  
  //execute deploy.js
  main()
    .then(() => process.exit(0)) // Exit the process if successful
    .catch((error) => {
      console.error(error); // Log any errors
      process.exit(1);// Exit the process with an error code
    });
  