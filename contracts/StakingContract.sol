pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./libs/math/Math.sol";
import "./libs/utils/Address.sol";
import "./libs/utils/Arrays.sol";
import "./libs/utils/ReentrancyGuard.sol";
import "./libs/lifecycle/Pausable.sol";
import "./token/ERC20/IERC20.sol";

contract StakingContract is Pausable, ReentrancyGuard {

    using SafeMath for uint256;
    using Math for uint256;
    using Address for address;
    using Arrays for uint256[];

    enum Status {Setup, Running, RewardsDisabled}

    // EVENTS
    event StakeDeposited(address indexed account, uint256 amount);
    event WithdrawInitiated(address indexed account, uint256 amount);
    event WithdrawExecuted(address indexed account, uint256 amount, uint256 reward);

    // STRUCT DECLARATIONS
    struct StakeDeposit {
        uint256 amount;
        uint256 startDate;
        uint256 endDate;
        uint256 startCheckpointIndex;
        uint256 endCheckpointIndex;
        bool exists;
    }

    struct SetupState {
        bool staking;
        bool rewards;
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

    SetupState public setupState;
    StakingLimitConfig public stakingLimitConfig;
    RewardConfig public rewardConfig;

    address public rewardsAddress;
    uint256 public launchTimestamp;
    uint256 public currentTotalStake;

    mapping(address => StakeDeposit) private _stakeDeposits;
    BaseRewardCheckpoint[] private baseRewardHistory;

    // MODIFIERS
    modifier guardMaxStakingLimit(uint256 amount)
    {
        uint256 resultedStakedAmount = currentTotalStake.add(amount);
        uint256 currentStakingLimit = _computeCurrentStakingLimit();
        require(resultedStakedAmount <= currentStakingLimit, "[Deposit] Your deposit would exceed the current staking limit");
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

    modifier onlyDuringSetup()
    {
        require(currentStatus == Status.Setup, '[Lifecycle] Setup is already done');
        _;
    }

    modifier onlyAfterSetup()
    {
        require(currentStatus != Status.Setup, '[Lifecycle] Setup is not done');
        _;
    }

    // PUBLIC FUNCTIONS
    constructor(address _token, address _rewardsAddress)
    onlyContract(_token)
    public
    {
        require(_rewardsAddress != address(0), "[Validation] _rewardsAddress is the zero address");

        token = IERC20(_token);
        rewardsAddress = _rewardsAddress;
        launchTimestamp = now;
        currentStatus = Status.Setup;
    }

    function deposit(uint256 amount)
    nonReentrant
    onlyAfterSetup
    whenNotPaused
    guardMaxStakingLimit(amount)
    public
    {
        require(amount > 0, "[Validation] The stake deposit has to be larger than 0");
        require(!_stakeDeposits[msg.sender].exists, "[Deposit] You already have a stake");

        StakeDeposit storage stakeDeposit = _stakeDeposits[msg.sender];
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
    onlyAfterSetup
    guardForPrematureWithdrawal
    external
    {
        StakeDeposit storage stakeDeposit = _stakeDeposits[msg.sender];
        require(stakeDeposit.exists, "[Initiate Withdrawal] There is no stake deposit for this account");
        require(stakeDeposit.endDate == 0, "[Initiate Withdrawal] You already initiated the withdrawal");

        stakeDeposit.endDate = now;
        stakeDeposit.endCheckpointIndex = baseRewardHistory.length - 1;
        emit WithdrawInitiated(msg.sender, stakeDeposit.amount);
    }

    function executeWithdrawal()
    nonReentrant
    whenNotPaused
    onlyAfterSetup
    external
    {
        StakeDeposit storage stakeDeposit = _stakeDeposits[msg.sender];
        require(stakeDeposit.exists, "[Withdraw] There is no stake deposit for this account");
        require(stakeDeposit.endDate != 0, "[Withdraw] Withdraw is not initialized");
        // validate enough days have passed from initiating the withdrawal
        uint256 daysPassed = (now - stakeDeposit.endDate) / 1 days;
        require(stakingLimitConfig.unstakingPeriod < daysPassed, "[Withdraw] The unstaking period did not pass");

        uint256 amount = stakeDeposit.amount;
        uint256 reward = _computeReward(stakeDeposit);

        stakeDeposit.amount = 0;
        stakeDeposit.exists = false;

        currentTotalStake = currentTotalStake.sub(amount);
        _updateBaseRewardHistory();

        require(token.transfer(msg.sender, amount), "[Withdraw] Something went wrong while transferring your initial deposit");
        require(token.transferFrom(rewardsAddress, msg.sender, reward), "[Withdraw] Something went wrong while transferring your reward");

        emit WithdrawExecuted(msg.sender, amount, reward);
    }

    function currentStakingLimit()
    onlyAfterSetup
    public
    view
    returns (uint256)
    {
        return _computeCurrentStakingLimit();
    }

    function currentReward()
    onlyAfterSetup
    external
    view
    returns (uint256)
    {
        require(_stakeDeposits[msg.sender].exists, "[Validation] This account doesn't have a stake deposit");

        return _computeReward(_stakeDeposits[msg.sender]);
    }

    function getStakeDeposit()
    onlyAfterSetup
    external
    view
    returns (uint256, uint256, uint256, uint256, uint256)
    {
        require(_stakeDeposits[msg.sender].exists, "[Validation] This account doesn't have a stake deposit");
        StakeDeposit memory s = _stakeDeposits[msg.sender];

        return (s.amount, s.startDate, s.endDate, s.startCheckpointIndex, s.endCheckpointIndex);
    }

    function baseRewardsLength()
    onlyAfterSetup
    external
    view
    returns (uint256)
    {
        return rewardConfig.baseRewards.length;
    }

    function baseReward(uint256 index)
    onlyAfterSetup
    external
    view
    returns (uint256, uint256, uint256)
    {
        BaseReward memory br = rewardConfig.baseRewards[index];

        return (br.anualRewardRate, br.lowerBound, br.upperBound);
    }

    function toggleRewards(bool enabled)
    onlyOwner
    onlyAfterSetup
    external
    {
        currentStatus = enabled ? Status.Running : Status.RewardsDisabled;
        // TODO: Update the baseRewardHistory with the 0 BaseReward
    }

    function baseRewardHistoryLength()
    external
    view
    returns (uint256)
    {
        return baseRewardHistory.length;
    }

    function baseRewardCheckpoint(uint256 index)
    onlyAfterSetup
    external
    view
    returns (uint256, uint256, uint256, uint256)
    {
        BaseRewardCheckpoint memory c = baseRewardHistory[index];

        return (c.baseRewardIndex, c.startTimestamp, c.endTimestamp, c.fromBlock);
    }

    // OWNER SETUP
    function setupStakingLimit(uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 unstakingPeriod)
    onlyOwner
    whenPaused
    onlyDuringSetup
    external
    {
        require(maxAmount > 0 && initialAmount > 0 && daysInterval > 0 && unstakingPeriod >= 0, '[Validation] Some parameters are 0');
        require(maxAmount.mod(initialAmount) == 0, '[Validation] maxAmount should be a multiple of initialAmount');

        uint256 maxIntervals = maxAmount.div(initialAmount);
        // set the staking limits
        stakingLimitConfig.maxAmount = maxAmount;
        stakingLimitConfig.initialAmount = initialAmount;
        stakingLimitConfig.daysInterval = daysInterval;
        stakingLimitConfig.unstakingPeriod = unstakingPeriod;
        stakingLimitConfig.maxIntervals = maxIntervals;

        setupState.staking = true;
        _checkSetupComplete();
    }

    function setupRewards(
        uint256 multiplier,
        uint256[] calldata anualRewardRates,
        uint256[] calldata lowerBounds,
        uint256[] calldata upperBounds
    )
    onlyOwner
    whenPaused
    onlyDuringSetup
    external
    {
        _validateSetupRewardsParameters(multiplier, anualRewardRates, lowerBounds, upperBounds);

        // Setup rewards
        rewardConfig.multiplier = multiplier;

        for (uint256 i = 0; i < anualRewardRates.length; i++) {
            _addBaseReward(anualRewardRates[i], lowerBounds[i], upperBounds[i]);
        }

        // initiate baseRewardHistory with the first one which should start from 0
        _initBaseRewardHistory();

        setupState.rewards = true;
        _checkSetupComplete();
    }

    // INTERNAL
    function _checkSetupComplete()
    private
    {
        if (!setupState.rewards || !setupState.staking) {
            return;
        }

        currentStatus = Status.Running;
    }

    function _computeCurrentStakingLimit()
    private
    view
    returns (uint256)
    {
        uint256 intervalsPassed = _getIntervalsPassed();
        intervalsPassed = intervalsPassed == 0 ? 1 : intervalsPassed;

        // initialLimit * ((now - launchMoment) / interval)
        return stakingLimitConfig.initialAmount.mul(intervalsPassed.min(stakingLimitConfig.maxIntervals));
    }

    function _getIntervalsPassed()
    private
    view
    returns (uint256)
    {
        return ((now - launchTimestamp) / stakingLimitConfig.daysInterval) / 1 days;
    }

    function _computeReward(StakeDeposit storage stakeDeposit)
    private
    view
    returns (uint256)
    {
        if (currentStatus == Status.RewardsDisabled) {
            return 0;
        }

        uint256 scale = 10**18;
        uint256 denominator = scale.mul(36500);
        uint256 weightedAverage = (_computeWeightedAverageBaseReward(stakeDeposit)).mul(scale);
        uint256 accumulator = weightedAverage.div(100);

        return stakeDeposit.amount.mul(weightedAverage.add(accumulator)) / denominator;
    }

    function _computeWeightedAverageBaseReward(StakeDeposit memory stakeDeposit)
    private
    view
    returns (uint256)
    {
        uint256 weight;
        uint256 rate;

        // The contract never left the first checkpoint
        if (stakeDeposit.startCheckpointIndex == stakeDeposit.endCheckpointIndex) {
            weight = (stakeDeposit.endDate - stakeDeposit.startDate) / 1 days;
            rate = _baseRewardFromHistoryIndex(stakeDeposit.startCheckpointIndex).anualRewardRate;

            return rate.mul(weight);
        }

        // Computing the first segment base reward
        // User could deposit in the middle of the segment so we need to get the segment from which the user deposited
        // to the moment the base reward changes
        weight = (baseRewardHistory[stakeDeposit.startCheckpointIndex].endTimestamp - stakeDeposit.startDate) / 1 days;
        rate = _baseRewardFromHistoryIndex(stakeDeposit.startCheckpointIndex).anualRewardRate;
        uint256 baseRewardSum = rate.mul(weight);

        // Starting from the second checkpoint because the first one is already computed
        for (uint256 i = stakeDeposit.startCheckpointIndex + 1; i < stakeDeposit.endCheckpointIndex; i++) {
            weight = (baseRewardHistory[i].endTimestamp - baseRewardHistory[i].startTimestamp) / 1 days;
            rate = _baseRewardFromHistoryIndex(i).anualRewardRate;
            baseRewardSum = baseRewardSum.add(rate.mul(weight));
        }

        // Computing the base reward for the last segment
        // days between start timestamp of the last checkpoint to the moment he initialized the withdrawal
        weight = (stakeDeposit.endDate - baseRewardHistory[stakeDeposit.endCheckpointIndex].startTimestamp) / 1 days;
        rate = _baseRewardFromHistoryIndex(stakeDeposit.endCheckpointIndex).anualRewardRate;
        baseRewardSum = baseRewardSum.add(weight.mul(rate));

        return baseRewardSum;
    }

    function _addBaseReward(uint256 anualRewardRate, uint256 lowerBound, uint256 upperBound)
    private
    {
        rewardConfig.baseRewards.push(BaseReward(anualRewardRate, lowerBound, upperBound));
        rewardConfig.upperBounds.push(upperBound);
    }

    function _initBaseRewardHistory()
    private
    {
        require(baseRewardHistory.length == 0, '[Logical] Base reward history has already been initialized');

        baseRewardHistory.push(BaseRewardCheckpoint(0, now, 0, block.number));
    }

    function _updateBaseRewardHistory()
    private
    {
        (, BaseReward memory currentBaseReward) = _currentBaseReward();

        // Do nothing if currentTotalStake is in the current base reward bounds
        if (currentBaseReward.lowerBound <= currentTotalStake && currentTotalStake <= currentBaseReward.upperBound) {
            return;
        }

        // TODO: Insert mechanism for 0 reward periods based on Status.RewardsDisabled and a BaseReward of anual rate 0

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
            '[Validation] All parameters must have at least one element'
        );
        require(anualRewardRates.length == lowerBounds.length && lowerBounds.length == upperBounds.length,
            '[Validation] All parameters must have the same number of elements'
        );
        require(lowerBounds[0] == 0, '[Validation] First lower bound should be 0');
        require((multiplier < 100) && (uint256(100).mod(multiplier) == 0),
            '[Validation] Multiplier should be smaller than 100 and divide it equally'
        );
    }
}
