pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./token/ERC20/IERC20.sol";
import "./libs/lifecycle/Pausable.sol";
import "./libs/math/Math.sol";

contract StakingContract is Pausable {

    using SafeMath for uint256;
    using Math for uint256;

    enum Status {Deployed, StakingLimitSetup, RewardsSetup, RewardsDisabled}

    event StakeDeposited(address indexed staker, uint256 amount);

    event StakeWithdrawn(address indexed beneficiary, uint256 amount);

    struct BaseRewardCheckpoint {

    }

    struct StakeDeposit {
        uint256 amount;
        uint256 startDate;
    }

    struct StakingLimit {
        uint256 maxAmount;
        uint256 initialAmount;
        uint256 daysInterval;
        uint256 maxIntervals;
    }

    IERC20 public token;
    Status public currentStatus;
    StakingLimit private stakingLimit;

    uint256 public launchMoment;
    uint256 public currentTotalStake;
    mapping (address => StakeDeposit) public accountStakes;

    modifier guardMaxStakingLimit(uint256 stakedAmount)
    {
        uint256 resultedStakedAmount = currentTotalStake.add(stakeAmount);
        require(resultedStakedAmount <= computeCurrentStakingLimit(), "[Stake Limit] Your deposit would exceed the current staking limit");
        _;
    }

    // PUBLIC
    constructor(address _token)
    public
    {
        token = IERC20(_token);
        launchMoment = now;
        currentStatus = Status.Deployed;
    }

    function deposit(uint256 amount)
    whenNotPaused
    guardMaxStakingLimit(amount)
    public
    {
        require(token.allowance(msg.sender, address(this)) >= amount, "[ERC20] Not enough allowance");

        require(token.transferFrom(msg.sender, address(this), amount), "[Transfer] Something went wrong during the token transfer");

        accountStakes[msg.sender] = StakeDeposit(amount, now);
        emit StakeDeposited(msg.sender, amount);
    }

    function initiateWithdrawal()
    whenNotPaused
    external
    {

    }

    function executeWithdrawal()
    whenNotPaused
    external
    {

    }

    function getCurrentStakingLimit()
    public
    view
    returns (uint256)
    {
        return computeCurrentStakingLimit();
    }

    function getCurrentReward(address staker)
    external
    view
    returns (uint256)
    {
        return 2;
    }

    function setupStakingLimit(uint256 maxAmount, uint256 initialAmount, uint256 daysInterval)
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.Deployed, '[Lifecycle] Staking limits are already set');

        uint256 maxIntervals = maxAmount.div(initialAmount);
        // set the staking limits
        stakingLimit = StakingLimit(maxAmount, initialAmount, daysInterval, maxIntervals);

        currentStatus = Status.StakingLimitSetup;
    }


    function setupRewards()
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.StakingLimitSetup, '[Lifecycle] Rewards are already set');
        currentStatus = Status.RewardsSetup;
    }

    function disableRewards(uint256 fromWhen)
    external
    onlyOwner
    {
        currentStatus = Status.RewardsDisabled;
    }

    // INTERNAL
    function computeReward(address staker)
    private
    view
    returns (uint256)
    {
        // compute the reward
        return 2;
    }

    function computeCurrentStakingLimit()
    private
    view
    returns (uint256)
    {
        // initialStakingLimit * ((now - launchMoment) / interval)
        uint256 intervalsPassed = ((now - launchMoment) * 1 days) / stakingLimit.daysInterval;

        return initialLimit.mul(intervalsPassed.min(stakingLimit.maxIntervals));
    }
}
