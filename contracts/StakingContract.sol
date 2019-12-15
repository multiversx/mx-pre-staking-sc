pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./libs/math/Math.sol";
import "./libs/utils/Address.sol";
import "./libs/utils/ReentrancyGuard.sol";
import "./libs/lifecycle/Pausable.sol";
import "./token/ERC20/IERC20.sol";
import "./libs/utils/Arrays.sol";

contract StakingContract is Pausable, ReentrancyGuard {

    using SafeMath for uint256;
    using Math for uint256;
    using Address for address;
    using Arrays for uint256[];

    enum Status {StakingLimitSetup, RewardsSetup, Running, RewardsDisabled}

    // EVENTS
    event StakeDeposited(address indexed account, uint256 amount);
    event WithdrawInitiated(address indexed account, uint256 amount);
    event WithdrawExecuted(address indexed account, uint256 amount);

    // STRUCT DECLARATIONS
    struct StakeDeposit {
        uint256 amount;
        uint256 startDate;
        uint256 endDate;
        uint256 startCheckpointIndex;
        uint256 endCheckpointIndex;
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
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 fromBlock;
    }

    struct BaseReward {
        uint256 anualRewardRate;
        uint256 lowerBound;
        uint256 upperBound;
    }

    struct RewardConfig {
        BaseReward[] baseRewards;
        uint256[] upperBounds;
        uint256 multiplier; // percent of the base reward applicable
    }

    // CONTRACT STATE VARIABLES
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
    nonReentrant
    public
    {
        require(!accountStakes[msg.sender].exists, "[Deposit] You already have a stake");

        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];
        stakeDeposit.amount = stakeDeposit.amount.add(amount);
        stakeDeposit.startDate = now;
        stakeDeposit.startCheckpointIndex = baseRewardHistory.length - 1;
        stakeDeposit.exists = true;

        currentTotalStake = currentTotalStake.add(amount);
        _updateBaseRewardHistory();

        // Transfer the Tokens to this contract
        require(token.transferFrom(msg.sender, address(this), amount), "[Deposit] Something went wrong during the token transfer");
        emit StakeDeposited(msg.sender, amount);
    }

    function initiateWithdrawal()
    whenNotPaused
    guardForPrematureWithdrawal
    external
    {
        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];
        require(stakeDeposit.exists, "[Initiate Withdrawal] There is no stake deposit for this account");
        require(stakeDeposit.endDate != 0, "[Initiate Withdrawal] You already initiated the withdrawal");

        stakeDeposit.endDate = now;
        stakeDeposit.endCheckpointIndex = baseRewardHistory.length - 1;
        emit WithdrawInitiated(msg.sender, stakeDeposit.amount);
    }

    function executeWithdrawal()
    whenNotPaused
    nonReentrant
    external
    {
        StakeDeposit storage stakeDeposit = accountStakes[msg.sender];

        // validate enough days have passed from initiating the withdrawal
        uint256 daysPassed = stakeDeposit.endDate.sub(stakeDeposit.startDate) * 1 days;
        require(daysPassed >= stakingLimitConfig.unstakingPeriod, '[Withdraw] The unstaking period did not pass');

        uint256 reward = _computeReward(stakeDeposit);
        uint256 amount = stakeDeposit.amount;

        stakeDeposit.amount = 0;
        stakeDeposit.exists = false;

        currentTotalStake = currentTotalStake.sub(amount);
        _updateBaseRewardHistory();

        require(token.transfer(msg.sender, amount), "[Withdraw] Something went wrong while transferring your initial deposit");
        require(token.transferFrom(rewardsAddress, msg.sender, reward), "[Withdraw] Something went wrong while transferring your reward");
        emit WithdrawExecuted(msg.sender, amount.add(reward));
    }

    function getCurrentStakingLimit()
    public
    view
    returns (uint256)
    {
        return _computeCurrentStakingLimit();
    }

    function getCurrentReward()
    external
    view
    returns (uint256)
    {
        return _computeReward(accountStakes[msg.sender]);
    }

    // PUBLIC SETUP
    function setupStakingLimit(uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 unstakingPeriod)
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.StakingLimitSetup, '[Lifecycle] Staking limits are already set');
        require(maxAmount.mod(initialAmount) == 0, '[Validation] maxAmount should be a multiple of initialAmount');

        uint256 maxIntervals = maxAmount.div(initialAmount);
        // set the staking limits
        stakingLimitConfig.maxAmount = stakingLimitConfig.maxAmount.add(maxAmount);
        stakingLimitConfig.initialAmount = stakingLimitConfig.initialAmount.add(initialAmount);
        stakingLimitConfig.daysInterval = stakingLimitConfig.daysInterval.add(daysInterval) * 1 days;
        stakingLimitConfig.unstakingPeriod = stakingLimitConfig.unstakingPeriod.add(unstakingPeriod) * 1 days;
        stakingLimitConfig.maxIntervals = maxIntervals;

        currentStatus = Status.RewardsSetup;
    }

    function setupRewards(
        uint256 multiplier,
        uint256[] calldata anualRewardRates,
        uint256[] calldata lowerBounds,
        uint256[] calldata upperBounds
    )
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.RewardsSetup, '[Lifecycle] Rewards are already set');
        _validateSetupRewardsParameters(multiplier, anualRewardRates, lowerBounds, upperBounds);

        // Setup rewards
        rewardConfig.multiplier = multiplier;

        for (uint256 i = 0; i < anualRewardRates.length; i++) {
            _addBaseReward(anualRewardRates[i], lowerBounds[i], upperBounds[i]);
        }

        currentStatus = Status.Running;
    }

    function toggleRewards(bool enabled)
    external
    onlyOwner
    {
        require(
            currentStatus == Status.Running || currentStatus == Status.RewardsDisabled,
            "[Lifecycle] Contract does not have the setup complete"
        );

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

    function _getIntervalsPassed()
    private
    view
    returns (uint256)
    {
        return ((now - launchTimestamp) * 1 days) / stakingLimitConfig.daysInterval;
    }

    function _computeReward(StakeDeposit storage stakeDeposit)
    private
    view
    returns (uint256)
    {
        if (currentStatus == Status.RewardsDisabled) {
            return 0;
        }

        uint256 stakingPeriod = (stakeDeposit.endDate - stakeDeposit.startDate) * 1 days;
        uint256 weightedAverageBaseReward = _computeWeightedAverageBaseReward(stakeDeposit, stakingPeriod);
        uint256 multiplier = stakingPeriod.mul(rewardConfig.multiplier).div(100);
        uint256 baseReward = weightedAverageBaseReward.add(multiplier);

        return stakeDeposit.amount.mul(baseReward).div(100);
    }

    function _computeWeightedAverageBaseReward(StakeDeposit memory stakeDeposit, uint256 stakingPeriod)
    private
    view
    returns (uint256)
    {
        // Computing the first segment base reward
        // User could deposit in the middle of the segment so we need to get the segment from which the user deposited
        // to the moment the base reward changes
        uint256 segmentStakingPeriod = (baseRewardHistory[stakeDeposit.startCheckpointIndex].endTimestamp - stakeDeposit.startDate) * 1 days;
        uint256 dailyRewardRate = _baseRewardFromHistoryIndex(stakeDeposit.startCheckpointIndex).anualRewardRate.div(365);
        uint256 segmentBaseReward = segmentStakingPeriod.mul(dailyRewardRate);
        uint256 baseRewardSum = segmentBaseReward;

        if (stakeDeposit.startCheckpointIndex == stakeDeposit.endCheckpointIndex) {
            return baseRewardSum.div(stakingPeriod);
        }

        // Starting from the second checkpoint because the first one is already computed
        for (uint256 i = stakeDeposit.startCheckpointIndex + 1; i < stakeDeposit.endCheckpointIndex; i++) {
            segmentStakingPeriod = (baseRewardHistory[i].endTimestamp - baseRewardHistory[i].startTimestamp) * 1 days;
            dailyRewardRate = _baseRewardFromHistoryIndex(i).anualRewardRate.div(365);
            segmentBaseReward = dailyRewardRate.mul(segmentStakingPeriod);
            baseRewardSum = baseRewardSum.add(segmentBaseReward);
        }

        // Computing the base reward for the last segment
        // days between start timestamp of the last checkpoint to the moment he initialized the withdrawal
        segmentStakingPeriod = (stakeDeposit.endDate - baseRewardHistory[stakeDeposit.endCheckpointIndex].startTimestamp) * 1 days;
        dailyRewardRate = _baseRewardFromHistoryIndex(stakeDeposit.endCheckpointIndex).anualRewardRate.div(365);
        segmentBaseReward = segmentStakingPeriod.mul(dailyRewardRate);
        baseRewardSum = baseRewardSum.add(segmentBaseReward);

        return baseRewardSum.div(stakingPeriod);
    }

    function _addBaseReward(uint256 anualRewardRate, uint256 lowerBound, uint256 upperBound)
    private
    {
        rewardConfig.baseRewards.push(BaseReward(anualRewardRate, lowerBound, upperBound));
        rewardConfig.upperBounds.push(upperBound);
    }

    function _updateBaseRewardHistory()
    private
    {
        (, BaseReward memory currentBaseReward) = _currentBaseReward();

        // Do nothing if currentTotalStake is in the current base reward bounds
        if (currentBaseReward.lowerBound <= currentTotalStake && currentTotalStake <= currentBaseReward.upperBound) {
            return;
        }

        BaseRewardCheckpoint storage oldCheckPoint = _lastBaseRewardCheckpoint();
        (uint256 index,) = _computeCurrentBaseReward();

        if (oldCheckPoint.fromBlock < block.number) {
            oldCheckPoint.endTimestamp = now;
            BaseRewardCheckpoint storage newCheckpoint = baseRewardHistory[baseRewardHistory.length];
            newCheckpoint.baseRewardIndex = index;
            newCheckpoint.startTimestamp = now;
            newCheckpoint.fromBlock = block.number;
        } else {
            oldCheckPoint.baseRewardIndex = index;
        }
    }

    function _currentBaseReward()
    private
    view
    returns (uint256, BaseReward memory)
    {
        // search for the current base reward from current total staked amount
        uint256 currentBaseRewardIndex = (_lastBaseRewardCheckpoint()).baseRewardIndex;

        return (currentBaseRewardIndex, rewardConfig.baseRewards[currentBaseRewardIndex]);
    }

    function _baseRewardFromHistoryIndex(uint256 index)
    private
    view
    returns (BaseReward memory)
    {
        return rewardConfig.baseRewards[baseRewardHistory[index].baseRewardIndex];
    }

    function _lastBaseRewardCheckpoint()
    private
    view
    returns (BaseRewardCheckpoint storage)
    {
        return baseRewardHistory[baseRewardHistory.length - 1];
    }

    function _computeCurrentBaseReward()
    private
    view
    returns (uint256, BaseReward memory)
    {
        uint256 index = rewardConfig.upperBounds.findUpperBound(currentTotalStake);

        return (index, rewardConfig.baseRewards[index]);
    }

    function _validateSetupRewardsParameters
    (
        uint256 multiplier,
        uint256[] memory anualRewardRates,
        uint256[] memory lowerBounds,
        uint256[] memory upperBounds
    )
    private
    pure
    {
        require(anualRewardRates.length > 0 && lowerBounds.length > 0 && upperBounds.length > 0,
            '[Validation] All parameters'
        );
        require(anualRewardRates.length == lowerBounds.length && lowerBounds.length == upperBounds.length,
            '[Validation] All parameters must have the same number of elements'
        );
        require((multiplier < 100) && (uint256(100).mod(multiplier) == 0),
            '[Validation] Multiplier should be smaller than 100 and divide it equally'
        );
    }
}
