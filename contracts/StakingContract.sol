pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./libs/math/Math.sol";
import "./libs/utils/Address.sol";
import "./libs/utils/ReentrancyGuard.sol";
import "./libs/lifecycle/Pausable.sol";
import "./token/ERC20/IERC20.sol";

contract StakingContract is Pausable, ReentrancyGuard {

    using SafeMath for uint256;
    using Math for uint256;
    using Address for address;

    enum Status {StakingLimitSetup, RewardsSetup, Running, RewardsDisabled}

    event StakeDeposited(address indexed account, uint256 amount);
    event WithdrawInitiated(address indexed account, uint256 amount);
    event WithdrawExecuted(address indexed account, uint256 amount);

    struct StakeDeposit {
        uint256 amount;
        uint256 startDate;
        uint256 initiateWithdrawalDate;
        bool exists;
    }

    struct StakingLimitConfig {
        uint256 maxAmount;
        uint256 initialAmount;
        uint256 daysInterval;
        uint256 maxIntervals;
        uint256 unstakingPeriod;
    }

    struct BaseRewardCheckpoint {
        uint256 baseRewardIndex;
        uint256 timestamp;
        uint256 fromBlock;
    }

    struct BaseReward {
        uint256 anualRewardRate;
        uint256 minimumTotalStaked;
    }

    struct RewardConfig {
        BaseReward[] baseRewards;
        uint256 multiplier; // percent of the base reward applicable
    }

    IERC20 public token;
    Status public currentStatus;
    StakingLimitConfig private stakingLimitConfig;
    RewardConfig public rewardConfig;

    address private rewardsAddress;
    uint256 public launchTimestamp;
    uint256 public currentTotalStake;

    mapping(address => StakeDeposit) public accountStakes;
    BaseRewardCheckpoint[] private baseRewardHistory;

    // MODIFIERS
    modifier guardMaxStakingLimit(uint256 amount)
    {
        uint256 resultedStakedAmount = currentTotalStake.add(amount);
        require(resultedStakedAmount <= _computeCurrentStakingLimit(), "[Deposit] Your deposit would exceed the current staking limit");
        _;
    }

    modifier guardForPrematureWithdrawal()
    {
        uint256 intervalsPassed = _getIntervalsPassed();
        require(intervalsPassed >= stakingLimitConfig.maxIntervals, "[Withdraw] Not enough days passed");
        _;
    }

    modifier onlyContract(address account)
    {
        require(account.isContract(), "[Validation] The address does not contain a contract");
        _;
    }

    // PUBLIC FUNCTIONS
    constructor(address _token, address _rewardsAddress)
    onlyContract(_token)
    public
    {
        token = IERC20(_token);
        rewardsAddress = _rewardsAddress;
        launchTimestamp = now;
        currentStatus = Status.StakingLimitSetup;
    }

    function deposit(uint256 amount)
    whenNotPaused
    guardMaxStakingLimit(amount)
    public
    {
        require(token.allowance(msg.sender, address(this)) >= amount, "[Deposit] Not enough allowance in the ERC20 Token");
        require(!accountStakes[msg.sender].exists, "[Deposit] You already have a stake");

        // Transfer the Tokens to this contract
        require(token.transferFrom(msg.sender, address(this), amount), "[Deposit] Something went wrong during the token transfer");

        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];
        stakeDeposit.amount = stakeDeposit.amount.add(amount);
        stakeDeposit.startDate = now;
        stakeDeposit.exists = true;

        currentTotalStake = currentTotalStake.add(amount);

        emit StakeDeposited(msg.sender, amount);
    }

    function initiateWithdrawal()
    whenNotPaused
    guardForPrematureWithdrawal
    external
    {
        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];
        require(stakeDeposit.exists, "[Initiate Withdrawal] There is no stake deposit for this account");
        require(stakeDeposit.initiateWithdrawalDate != 0, "[Initiate Withdrawal] You already initiated the withdrawal");

        stakeDeposit.initiateWithdrawalDate = now;
        emit WithdrawInitiated(msg.sender, stakeDeposit.amount);
    }

    function executeWithdrawal()
    whenNotPaused
    nonReentrant
    external
    {
        // validate enough days have passed from initiating the withdrawal
        uint256 reward = _computeReward(msg.sender);
        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];

        require(token.transfer(msg.sender, stakeDeposit.amount), "[Withdraw] Something went wrong while transferring your initial deposit");
        require(token.transferFrom(rewardsAddress, msg.sender, reward), "[Withdraw] Something went wrong while transferring your reward");
        emit WithdrawExecuted(msg.sender, stakeDeposit.amount.add(reward));

        stakeDeposit.amount = 0;
        stakeDeposit.exists = false;
    }

    function getCurrentStakingLimit()
    public
    view
    returns (uint256)
    {
        return _computeCurrentStakingLimit();
    }

    function getCurrentReward(address staker)
    external
    view
    returns (uint256)
    {
        return rewardConfig.baseRewards[0].anualRewardRate;
    }

    // PUBLIC SETUP
    function setupStakingLimit(uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 unstakingPeriod)
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.StakingLimitSetup, '[Lifecycle] Staking limits are already set');

        uint256 maxIntervals = maxAmount.div(initialAmount);
        // set the staking limits
        stakingLimitConfig = StakingLimitConfig(maxAmount, initialAmount, daysInterval, maxIntervals, unstakingPeriod);

        currentStatus = Status.RewardsSetup;
    }

    function setupRewards()
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.RewardsSetup, '[Lifecycle] Rewards are already set');

        // Setup rewards


        currentStatus = Status.Running;
    }

    function addBaseReward(uint256 anualRewardRate, uint256 minimumTotalStaked)
    public
    onlyOwner
    whenPaused
    {

    }

    function toggleRewards(uint256 fromWhen, bool enabled)
    external
    onlyOwner
    {
        currentStatus = enabled ? Status.Running : Status.RewardsDisabled;
    }

    // INTERNAL
    function _computeCurrentStakingLimit()
    private
    view
    returns (uint256)
    {
        require(currentStatus == Status.Running, '[Lifecycle] Setup not complete');

        uint256 intervalsPassed = _getIntervalsPassed();

        // initialLimit * ((now - launchMoment) / interval)
        return stakingLimitConfig.initialAmount.mul(intervalsPassed.min(stakingLimitConfig.maxIntervals));
    }

    function _computeReward(address)
    private
    view
    returns (uint256)
    {
        // compute the reward
        return 2;
    }

    function _addBaseReward(uint256 anualRewardRate, uint256 minimumTotalStaked)
    private
    {

    }

    function _getIntervalsPassed()
    private
    view
    returns (uint256)
    {
        return ((now - launchTimestamp) * 1 days) / stakingLimitConfig.daysInterval;
    }

    function _getBaseRewardCheckpointsFrom(uint256 )
    private
    view
    returns (BaseRewardCheckpoint[] memory)
    {

        return baseRewardHistory;
    }

    function _updateBaseRewardHistory()
    private
    {
        (uint256 index,) = _findCurrentBaseReward();
        uint256 length = baseRewardHistory.length;

        if ((length == 0) || (baseRewardHistory[length - 1].fromBlock < block.number)) {
            baseRewardHistory.push(BaseRewardCheckpoint(index, now, block.number));
        } else {
            BaseRewardCheckpoint storage oldCheckPoint = baseRewardHistory[length - 1];
            oldCheckPoint.baseRewardIndex = index;
        }
    }

    function _findCurrentBaseReward()
    private
    view
    returns (uint256 index, BaseReward storage baseReward)
    {
        // search for the current base reward from current total staked amount
        return (0, rewardConfig.baseRewards[0]);
    }
}
