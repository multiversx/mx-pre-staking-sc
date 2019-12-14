pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./token/ERC20/IERC20.sol";
import "./libs/lifecycle/Pausable.sol";
import "./libs/math/Math.sol";

contract StakingContract is Pausable {

    using SafeMath for uint256;
    using Math for uint256;

    enum Status {Deployed, StakingLimitSetup, RewardsSetup, RewardsDisabled}

    event StakeDeposited(address indexed account, uint256 amount);
    event WithdrawInitiated(address indexed account, uint256 amount);
    event WithdrawExecuted(address indexed account, uint256 amount);

    struct BaseRewardCheckpoint {
        uint256 baseRewardIndex;
        uint256 timestamp;
        uint256 fromBlock;
    }

    struct BaseReward {
        uint256 anualRewardRate;
        uint256 minimumTotalStaked;
    }

    struct Reward {
        BaseReward[] baseRewards;
        uint256 multiplier; // percent of the base reward applicable
    }

    struct StakeDeposit {
        uint256 amount;
        uint256 startDate;
        uint256 initiateWithdrawalDate;
        bool exists;
    }

    struct StakingLimit {
        uint256 maxAmount;
        uint256 initialAmount;
        uint256 daysInterval;
        uint256 maxIntervals;
        uint256 unstakingPeriod;
    }

    IERC20 public token;
    Status public currentStatus;
    StakingLimit private stakingLimit;

    address private rewardsAddress;
    uint256 public launchTimestamp;
    uint256 public currentTotalStake;

    mapping(address => StakeDeposit) public accountStakes;
    BaseRewardCheckpoint[] private baseRewardHistory;

    // MODIFIERS
    modifier guardMaxStakingLimit(uint256 stakedAmount)
    {
        uint256 resultedStakedAmount = currentTotalStake.add(stakeAmount);
        require(resultedStakedAmount <= _computeCurrentStakingLimit(), "[Deposit] Your deposit would exceed the current staking limit");
        _;
    }

    modifier guardForPrematureWithdrawal()
    {
        uint256 intervalsPassed = _getIntervalsPassed();
        require(intervalsPassed >= stakingLimit.maxIntervals, "[Withdraw] Not enough days passed");
        _;
    }

    // PUBLIC
    constructor(address _token, address _fundAddress)
    public
    {
        token = IERC20(_token);
        rewardsAddress = _fundAddress;
        launchTimestamp = now;
        currentStatus = Status.Deployed;
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

        StakeDeposit storage deposit = accountStakes[msg.sender];
        deposit.amount = deposit.amount.add(amount);
        deposit.startDate = now;
        deposit.exists = true;

        currentTotalStake = currentTotalStake.add(amount);

        emit StakeDeposited(msg.sender, amount);
    }

    function initiateWithdrawal()
    whenNotPaused
    guardForPrematureWithdrawal
    external
    {
        StakeDeposit storage deposit = accountStakes[msg.sender];
        require(deposit.exists, "[Initiate Withdrawal] There is no stake deposit for this account");
        require(deposit.initiateWithdrawalDate != 0, "[Initiate Withdrawal] You already initiated the withdrawal");

        deposit.initiateWithdrawalDate = now;
        emit WithdrawInitiated(msg.sender, deposit.amount);
    }

    function executeWithdrawal()
    whenNotPaused
    external
    {
        // validate enough days have passed from initiating the withdrawal
        uint256 reward = _computeReward(msg.sender);
        StakeDeposit storage deposit = accountStakes[msg.sender];

        require(token.transfer(msg.sender, deposit.amount), "[Withdraw] Something went wrong while transferring your initial deposit");
        require(token.transferFrom(rewardsAddress, msg.sender, reward), "[Withdraw] Something went wrong while transferring your reward");
        emit WithdrawExecuted(msg.sender, deposit.amount.add(reward));

        deposit = StakeDeposit(0, 0, 0, 0);
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
        return 2;
    }

    // PUBLIC SETUP
    function setupStakingLimit(uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 unstakingPeriod)
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.Deployed, '[Lifecycle] Staking limits are already set');

        uint256 maxIntervals = maxAmount.div(initialAmount);
        // set the staking limits
        stakingLimit = StakingLimit(maxAmount, initialAmount, daysInterval, maxIntervals, unstakingPeriod);

        currentStatus = Status.StakingLimitSetup;
    }

    function setupRewards()
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.StakingLimitSetup, '[Lifecycle] Rewards are already set');

        // Setup rewards


        currentStatus = Status.RewardsSetup;
    }

    function addBaseReward(uint256 anualRewardRate, uint256 minimumTotalStaked)
    public
    onlyOwner
    whenPaused
    {
        
    }

    function disableRewards(uint256 fromWhen)
    external
    onlyOwner
    {
        currentStatus = Status.RewardsDisabled;
    }

    // INTERNAL
    function _computeReward(address staker)
    private
    view
    returns (uint256)
    {
        // compute the reward
        return 2;
    }

    function _computeCurrentStakingLimit()
    private
    view
    returns (uint256)
    {
        uint256 intervalsPassed = _getIntervalsPassed();

        // initialLimit * ((now - launchMoment) / interval)
        return initialLimit.mul(intervalsPassed.min(stakingLimit.maxIntervals));
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
        return ((now - launchTimestamp) * 1 days) / stakingLimit.daysInterval;
    }

    function _getBaseRewardCheckpointAt(uint256 timestamp)
    private
    view
    returns (BaseRewardCheckpoint memory)
    {
        uint256 length = baseRewardHistory.length;

        if (length == 0)
            return 0;

        // Some heuristics to avoid the binary search
        if (timestamp >= baseRewardHistory[length - 1].timestamp)
            return baseRewardHistory[length - 1];

        if (timestamp < baseRewardHistory[0].fromBlock)
            return 0;

        // Binary search of the value in the array
        uint256 min = 0;
        uint256 max = length - 1;
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (baseRewardHistory[mid].fromBlock <= timestamp) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }

        return baseRewardHistory[min];
    }

    /**
    * @dev Function used to update the balances history and the total supply history.
    * @param checkpoints The history of data being updated
    * @param value The new number of tokens
    */
    function _updateBaseRewardHistory()
    private
    {
        uint256 (index) = _findCurrentBaseReward();
        uint256 length = baseRewardHistory.length;

        if ((length == 0) || (baseRewardHistory[length - 1].fromBlock < block.number)) {
            checkpoints.push(BaseRewardCheckpoint(currentBaseRewardIndex, now, block.number));
        } else {
            BaseRewardCheckpoint storage oldCheckPoint = baseRewardHistory[length - 1];
            oldCheckPoint.baseRewardIndex = index;
        }
    }

    function _findCurrentBaseReward()
    private
    view
    returns (uint256 index, BaseReward baseReward)
    {
        // search for the current base reward from current total staked amount
        return (0, BaseReward(0,0));
    }
}
