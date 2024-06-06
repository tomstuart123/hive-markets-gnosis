// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ConditionalTokensWrapper.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./OutcomeResolution.sol";

contract MarketMaker {
    IERC20 public collateralToken;
    ConditionalTokensWrapper public conditionalTokens;
    OutcomeResolution public outcomeResolution;

    struct Market {
        string title;
        string question;
        string source;
        uint256 endTime;
        bool resolved;
        uint256 yesCount;
        uint256 noCount;
        mapping(address => uint256) liquidity;
        uint256 initialLiquidity;
        uint256 overround;
        uint256 constantProduct; // K = yesCount * noCount
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    event MarketCreated(uint256 indexed marketId, string title, string question, uint256 endTime);
    event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount);
    event OutcomeShareBought(uint256 indexed marketId, address indexed buyer, uint256 outcomeIndex, uint256 amount);
    event OutcomeShareSold(uint256 indexed marketId, address indexed seller, uint256 outcomeIndex, uint256 amount);
    event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 amount);

    constructor(address _collateralToken, address _conditionalTokensWrapper, address _outcomeResolution) {
        collateralToken = IERC20(_collateralToken);
        conditionalTokens = ConditionalTokensWrapper(_conditionalTokensWrapper);
        outcomeResolution = OutcomeResolution(_outcomeResolution);
    }

    function createMarket(string memory _title, string memory _question, string memory _source, uint256 _endTime, uint256 _initialLiquidity, uint256 _overround) public {
        marketCount++;
        Market storage market = markets[marketCount];
        market.title = _title;
        market.question = _question;
        market.source = _source;
        market.endTime = _endTime;
        market.initialLiquidity = _initialLiquidity;
        market.overround = _overround;

        // Initialize market with initial liquidity for both outcomes
        market.yesCount = _initialLiquidity / 2;
        market.noCount = _initialLiquidity / 2;
        market.constantProduct = market.yesCount * market.noCount;

        // Add initial liquidity
        require(collateralToken.transferFrom(msg.sender, address(this), _initialLiquidity), "Initial liquidity transfer failed");
        market.liquidity[msg.sender] = _initialLiquidity;

        emit MarketCreated(marketCount, _title, _question, _endTime);
    }

    function addLiquidity(uint256 _marketId, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(collateralToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        uint256 yesAddition = _amount / 2;
        uint256 noAddition = _amount / 2;
        market.yesCount += yesAddition;
        market.noCount += noAddition;
        market.constantProduct = market.yesCount * market.noCount;

        market.liquidity[msg.sender] += _amount;
        emit LiquidityAdded(_marketId, msg.sender, _amount);
    }

    function removeLiquidity(uint256 _marketId, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(market.liquidity[msg.sender] >= _amount, "Insufficient liquidity");

        uint256 yesReduction = _amount / 2;
        uint256 noReduction = _amount / 2;
        market.yesCount -= yesReduction;
        market.noCount -= noReduction;
        market.constantProduct = market.yesCount * market.noCount;

        market.liquidity[msg.sender] -= _amount;
        require(collateralToken.transfer(msg.sender, _amount), "Transfer failed");

        emit LiquidityRemoved(_marketId, msg.sender, _amount);
    }

    function buyOutcome(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market is resolved");
        require(_outcomeIndex < 2, "Invalid outcome index");

        uint256 price = _outcomeIndex == 0 
            ? (market.constantProduct / (market.yesCount + _amount)) - market.noCount 
            : (market.constantProduct / (market.noCount + _amount)) - market.yesCount;

        // Transfer collateral tokens from buyer to contract
        require(collateralToken.transferFrom(msg.sender, address(this), price), "Transfer failed");

        // Update outcome counts
        if (_outcomeIndex == 0) {
            market.yesCount += _amount;
        } else {
            market.noCount += _amount;
        }
        market.constantProduct = market.yesCount * market.noCount;

        emit OutcomeShareBought(_marketId, msg.sender, _outcomeIndex, _amount);
    }

    function sellOutcome(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market is resolved");
        require(_outcomeIndex < 2, "Invalid outcome index");

        uint256 price = _outcomeIndex == 0 
            ? market.noCount - (market.constantProduct / (market.yesCount - _amount)) 
            : market.yesCount - (market.constantProduct / (market.noCount - _amount));

        // Transfer collateral tokens from contract to seller
        require(collateralToken.transfer(msg.sender, price), "Transfer failed");

        // Update outcome counts
        if (_outcomeIndex == 0) {
            market.yesCount -= _amount;
        } else {
            market.noCount -= _amount;
        }
        market.constantProduct = market.yesCount * market.noCount;

        emit OutcomeShareSold(_marketId, msg.sender, _outcomeIndex, _amount);
    }

    function getMarket(uint256 _marketId) public view returns (
        string memory title,
        string memory question,
        string memory source,
        uint256 endTime,
        bool resolved,
        uint256 yesCount,
        uint256 noCount,
        uint256 initialLiquidity,
        uint256 overround
    ) {
        Market storage market = markets[_marketId];
        return (
            market.title,
            market.question,
            market.source,
            market.endTime,
            market.resolved,
            market.yesCount,
            market.noCount,
            market.initialLiquidity,
            market.overround
        );
    }

    function getMarketLiquidity(uint256 _marketId, address _provider) public view returns (uint256) {
        return markets[_marketId].liquidity[_provider];
    }

    function getCurrentPrice(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public view returns (uint256) {
        Market storage market = markets[_marketId];
        require(_outcomeIndex // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ConditionalTokensWrapper.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./OutcomeResolution.sol";

contract MarketMaker {
    IERC20 public collateralToken;
    ConditionalTokensWrapper public conditionalTokens;
    OutcomeResolution public outcomeResolution;

    struct Market {
        string title;
        string question;
        string source;
        uint256 endTime;
        bool resolved;
        uint256 yesCount;
        uint256 noCount;
        mapping(address => uint256) liquidity;
        uint256 initialLiquidity;
        uint256 overround;
        uint256 constantProduct; // K = yesCount * noCount
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    event MarketCreated(uint256 indexed marketId, string title, string question, uint256 endTime);
    event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount);
    event OutcomeShareBought(uint256 indexed marketId, address indexed buyer, uint256 outcomeIndex, uint256 amount);
    event OutcomeShareSold(uint256 indexed marketId, address indexed seller, uint256 outcomeIndex, uint256 amount);
    event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 amount);

    constructor(address _collateralToken, address _conditionalTokensWrapper, address _outcomeResolution) {
        collateralToken = IERC20(_collateralToken);
        conditionalTokens = ConditionalTokensWrapper(_conditionalTokensWrapper);
        outcomeResolution = OutcomeResolution(_outcomeResolution);
    }

    function createMarket(string memory _title, string memory _question, string memory _source, uint256 _endTime, uint256 _initialLiquidity, uint256 _overround) public {
        marketCount++;
        Market storage market = markets[marketCount];
        market.title = _title;
        market.question = _question;
        market.source = _source;
        market.endTime = _endTime;
        market.initialLiquidity = _initialLiquidity;
        market.overround = _overround;

        // Initialize market with initial liquidity for both outcomes
        market.yesCount = _initialLiquidity / 2;
        market.noCount = _initialLiquidity / 2;
        market.constantProduct = market.yesCount * market.noCount;

        // Add initial liquidity
        require(collateralToken.transferFrom(msg.sender, address(this), _initialLiquidity), "Initial liquidity transfer failed");
        market.liquidity[msg.sender] = _initialLiquidity;

        emit MarketCreated(marketCount, _title, _question, _endTime);
    }

    function addLiquidity(uint256 _marketId, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(collateralToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        uint256 yesAddition = _amount / 2;
        uint256 noAddition = _amount / 2;
        market.yesCount += yesAddition;
        market.noCount += noAddition;
        market.constantProduct = market.yesCount * market.noCount;

        market.liquidity[msg.sender] += _amount;
        emit LiquidityAdded(_marketId, msg.sender, _amount);
    }

    function removeLiquidity(uint256 _marketId, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(market.liquidity[msg.sender] >= _amount, "Insufficient liquidity");

        uint256 yesReduction = _amount / 2;
        uint256 noReduction = _amount / 2;
        market.yesCount -= yesReduction;
        market.noCount -= noReduction;
        market.constantProduct = market.yesCount * market.noCount;

        market.liquidity[msg.sender] -= _amount;
        require(collateralToken.transfer(msg.sender, _amount), "Transfer failed");

        emit LiquidityRemoved(_marketId, msg.sender, _amount);
    }

    function buyOutcome(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market is resolved");
        require(_outcomeIndex < 2, "Invalid outcome index");

        uint256 price;
        if (_outcomeIndex == 0) {
            require(market.yesCount + _amount > market.yesCount, "Overflow detected: yesCount + _amount");
            price = (market.constantProduct / (market.yesCount + _amount)) - market.noCount;
        } else {
            require(market.noCount + _amount > market.noCount, "Overflow detected: noCount + _amount");
            price = (market.constantProduct / (market.noCount + _amount)) - market.yesCount;
        }

        // Ensure price calculation does not overflow
        require(price > 0, "Price calculation overflow");

        // Transfer collateral tokens from buyer to contract
        require(collateralToken.transferFrom(msg.sender, address(this), price), "Transfer failed");

        // Update outcome counts
        if (_outcomeIndex == 0) {
            market.yesCount += _amount;
        } else {
            market.noCount += _amount;
        }
        market.constantProduct = market.yesCount * market.noCount;

        emit OutcomeShareBought(_marketId, msg.sender, _outcomeIndex, _amount);
    }

    function sellOutcome(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public {
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market is resolved");
        require(_outcomeIndex < 2, "Invalid outcome index");

        uint256 price;
        if (_outcomeIndex == 0) {
            require(market.yesCount >= _amount, "Underflow detected: yesCount - _amount");
            price = market.noCount - (market.constantProduct / (market.yesCount - _amount));
        } else {
            require(market.noCount >= _amount, "Underflow detected: noCount - _amount");
            price = market.yesCount - (market.constantProduct / (market.noCount - _amount));
        }

        // Ensure price calculation does not overflow
        require(price > 0, "Price calculation overflow");

        // Transfer collateral tokens from contract to seller
        require(collateralToken.transfer(msg.sender, price), "Transfer failed");

        // Update outcome counts
        if (_outcomeIndex == 0) {
            market.yesCount -= _amount;
        } else {
            market.noCount -= _amount;
        }
        market.constantProduct = market.yesCount * market.noCount;

        emit OutcomeShareSold(_marketId, msg.sender, _outcomeIndex, _amount);
    }

    function getMarket(uint256 _marketId) public view returns (
        string memory title,
        string memory question,
        string memory source,
        uint256 endTime,
        bool resolved,
        uint256 yesCount,
        uint256 noCount,
        uint256 initialLiquidity,
        uint256 overround
    ) {
        Market storage market = markets[_marketId];
        return (
            market.title,
            market.question,
            market.source,
            market.endTime,
            market.resolved,
            market.yesCount,
            market.noCount,
            market.initialLiquidity,
            market.overround
        );
    }

    function getMarketLiquidity(uint256 _marketId, address _provider) public view returns (uint256) {
        return markets[_marketId].liquidity[_provider];
    }

    function getCurrentPrice(uint256 _marketId, uint256 _outcomeIndex, uint256 _amount) public view returns (uint256) {
        Market storage market = markets[_marketId];
        require(_outcomeIndex < 2, "Invalid outcome index");

        uint256 yesCount = market.yesCount;
        uint256 noCount = market.noCount;

        uint256 price;
        if (_outcomeIndex == 0) {
            // Price for 'yes' outcome
            price = (yesCount + _amount) * 1e18 / (yesCount + noCount + _amount);
        } else {
            // Price for 'no' outcome
            price = (noCount + _amount) * 1e18 / (yesCount + noCount + _amount);
        }

        return price;
    }
}
< 2, "Invalid outcome index");

        uint256 yesCount = market.yesCount;
        uint256 noCount = market.noCount;

        uint256 price;
        if (_outcomeIndex == 0) {
            // Price for 'yes' outcome
            price = (yesCount + _amount) * 1e18 / (yesCount + noCount + _amount);
        } else {
            // Price for 'no' outcome
            price = (noCount + _amount) * 1e18 / (yesCount + noCount + _amount);
        }

        return price;
    }
}
