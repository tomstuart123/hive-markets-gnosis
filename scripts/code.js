 // Generate condition ID
 const questionId = ethers.keccak256(ethers.toUtf8Bytes(description));
 const abiCoder = new ethers.AbiCoder();
 const conditionId = ethers.keccak256(abiCoder.encode(
   ["address", "bytes32", "uint256"],
   [oracle, questionId, outcomeSlotCount]
 ));
 console.log("Condition ID generated:", conditionId);

 // Prepare condition
 const prepareConditionTx = await conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
 const prepareConditionReceipt = await prepareConditionTx.wait();
 console.log("Condition prepared:", prepareConditionReceipt.transactionHash);


 /////

 // Check for FixedProductMarketMakerCreation event in raw logs
      const iface = new ethers.Interface(FixedProductMarketMakerFactoryArtifact.abi);
      console.log("Interface:", iface);
      // Get the event fragment for the 'FixedProductMarketMakerCreation' event
      const eventFragment = iface.getEvent('FixedProductMarketMakerCreation');

      // Format the event signature
      const eventSignature = eventFragment.format(ethers.FormatTypes.full);

      // Calculate the event topic
      const eventTopic = ethers.keccak256(ethers.toUtf8Bytes(eventSignature));

      const log = createMarketReceipt.logs.find(log => log.topics[0] === eventTopic);

      if (!log) {
        throw new Error('FixedProductMarketMakerCreation event not found in logs');
      }

      const decodedLog = iface.decodeEventLog('FixedProductMarketMakerCreation', log.data, log.topics);
      const fixedProductMarketMakerAddress = decodedLog[1]; // Adjust based on the indexed and non-indexed fields
      console.log("FixedProductMarketMaker created at:", fixedProductMarketMakerAddress);


     // const eventSignature = "FixedProductMarketMakerCreation(address,address,address,address,bytes32[],uint256)";
    // const eventTopic = ethers.keccak256(ethers.toUtf8Bytes(eventSignature));
    // console.log("Event Topic:", eventTopic);

    // const log = createMarketReceipt.logs.find(log => log.topics[0] === eventTopic);
    // console.log("Log:", log);

    //   if (!log) {
    //     throw new Error('FixedProductMarketMakerCreation event not found in logs');
    //   }

    // const iface = new ethers.Interface(FixedProductMarketMakerFactoryArtifact.abi);
    // const decodedLog = iface.decodeEventLog('FixedProductMarketMakerCreation', log.data, log.topics);
    // const fixedProductMarketMakerAddress = decodedLog.fixedProductMarketMaker;

    //   console.log("FixedProductMarketMaker created at:", fixedProductMarketMakerAddress);