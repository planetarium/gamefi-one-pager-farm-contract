// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Farm is Ownable2Step {
    using SafeERC20 for IERC20;
    IERC20 public DEPOSIT_TOKEN;
    address public REWARDS_VAULT; // Reward Vault
    uint256 public APR = 10;
    uint256 public constant SECONDS_IN_YEAR = 365 * 24 * 60 * 60;

    uint256 public DEPOSIT_START_TIMESTAMP;
    uint256 public DEPOSIT_END_TIMESTAMP;
    uint256 public REWARD_START_TIMESTAMP;
    uint256 public REWARD_END_TIMESTAMP;

    uint256 public MAX_USER_DEPOSIT = 1000 ether;
    uint256 public MAX_TOTAL_DEPOSIT = 50000 ether;
    uint256 public TotalDepositAmount;

    bool public PAUSE_DEPOSIT;

    struct AssetData {
        uint256 amount; // Amount deposited
        uint256 startTime; // Timestamp when deposit started
    }

    mapping(address => AssetData) public userAssets;

    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed user, uint256 depositAmount, uint256 rewardAmount, uint256 timestamp);
    event AssetTransferred(address indexed recipient, uint256 amount, uint256 reward);

    modifier validateDeposit(uint256 _amount) {
        require(!PAUSE_DEPOSIT, "Deposits are currently paused");
        require(block.timestamp >= DEPOSIT_START_TIMESTAMP && block.timestamp <= DEPOSIT_END_TIMESTAMP, "Deposit not allowed at this time");
        require(_amount > 0, "Amount must be greater than 0 (in wei)");
        require(userAssets[msg.sender].amount + _amount <= MAX_USER_DEPOSIT, "Exceeds maximum deposit per user");
        require(TotalDepositAmount + _amount <= MAX_TOTAL_DEPOSIT, "Exceeds maximum total deposit");
        _;
    }

    constructor(IERC20 _depositToken, address _rewardVault) {
        DEPOSIT_TOKEN = _depositToken;
        REWARDS_VAULT = _rewardVault;
        PAUSE_DEPOSIT = false;
    }

    function setMaxUserDeposit(uint256 _maxUserDeposit) external onlyOwner {
        MAX_USER_DEPOSIT = _maxUserDeposit;
    }

    function setMaxTotalDeposit(uint256 _maxTotalDeposit) external onlyOwner {
        MAX_TOTAL_DEPOSIT = _maxTotalDeposit;
    }

    function setPauseDeposit(bool _pause) external onlyOwner {
        PAUSE_DEPOSIT = _pause;
    }

    function setDepositPeriod(uint256 _startTimestamp, uint256 _endTimestamp) external onlyOwner {
        require(_startTimestamp < _endTimestamp, "Start timestamp must be before end timestamp");
        DEPOSIT_START_TIMESTAMP = _startTimestamp;
        DEPOSIT_END_TIMESTAMP = _endTimestamp;
    }

    function setRewardPeriod(uint256 _startTimestamp, uint256 _endTimestamp) external onlyOwner {
        require(_startTimestamp < _endTimestamp, "Start timestamp must be before end timestamp");
        REWARD_START_TIMESTAMP = _startTimestamp;
        REWARD_END_TIMESTAMP = _endTimestamp;
    }

    function deposit(uint256 _amount) external validateDeposit(_amount) {
        require(userAssets[msg.sender].amount == 0, "Already deposited. Withdraw first.");

        userAssets[msg.sender] = AssetData({
            amount: _amount,
            startTime: block.timestamp
        });

        TotalDepositAmount += _amount;
        DEPOSIT_TOKEN.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount, block.timestamp);
    }

    function withdraw() external {
        AssetData memory userDeposit = userAssets[msg.sender];
        require(userDeposit.amount > 0, "No active deposit");

        uint256 reward = _calculateReward(msg.sender);

        TotalDepositAmount -= userDeposit.amount;
        delete userAssets[msg.sender]; // Reset the deposit

        // Transfer deposit amount
        DEPOSIT_TOKEN.safeTransfer(msg.sender, userDeposit.amount);

        // Transfer reward from reward vault
        DEPOSIT_TOKEN.safeTransferFrom(REWARDS_VAULT, msg.sender, reward);

        emit Withdraw(msg.sender, userDeposit.amount, reward, block.timestamp);
    }

    function currentReward(address _user) external view returns (uint256) {
        return _calculateReward(_user);
    }

    function _calculateReward(address _user) internal view returns (uint256) {
        AssetData memory userDeposit = userAssets[_user];
        if (userDeposit.amount == 0) {
            return 0;
        }

        uint256 rewardStartTime = userDeposit.startTime < REWARD_START_TIMESTAMP ? REWARD_START_TIMESTAMP : userDeposit.startTime;
        uint256 rewardEndTime = block.timestamp > REWARD_END_TIMESTAMP ? REWARD_END_TIMESTAMP : block.timestamp;

        uint256 stakingDuration = rewardEndTime - rewardStartTime;
        uint256 reward = (userDeposit.amount * APR * stakingDuration) / (100 * SECONDS_IN_YEAR);

        return reward;
    }

    function transferRewardVault(address _newVault) external onlyOwner {
        require(_newVault != address(0), "New reward vault cannot be zero address");

        REWARDS_VAULT = _newVault;
    }

    function transferAssetByOwner(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Recipient address cannot be zero");

        uint256 userAmount = userAssets[_recipient].amount;

        require(userAmount > 0, "Recipient has no deposit");
        require(DEPOSIT_TOKEN.balanceOf(address(this)) >= userAmount, "Insufficient balance in contract");

        uint256 reward = _calculateReward(_recipient);

        TotalDepositAmount -= userAmount;
        delete userAssets[_recipient]; // Reset the deposit

        DEPOSIT_TOKEN.safeTransfer(_recipient, userAmount);
        DEPOSIT_TOKEN.safeTransferFrom(REWARDS_VAULT, _recipient, reward);

        emit AssetTransferred(_recipient, userAmount, reward);
    }
}
