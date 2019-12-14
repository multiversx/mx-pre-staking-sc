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

    struct Checkpoint {

    }

    struct StakingLimit {
        uint256 initialStakingLimit;
        uint256 daysInterval;
        uint256 increaseAmount;
        uint256 currentAmount;
        uint256 maxAmount;
        bool reachedMaxCap;
    }

    StakingLimit private stakingLimit;
    IERC20 public token;
    uint256 public currentTotalStake;
    uint256 public launchMoment;
    Status public currentStatus;

    // PUBLIC
    constructor(address _token)
    public
    {
        token = IERC20(_token);
        launchMoment = now;
        currentStatus = Status.Deployed;
    }

    function depositStake()
    whenNotPaused
    public
    {

    }

    function withdrawStake()
    whenNotPaused
    external
    {

    }

    function getCurrentStakingLimit()
    public
    view
    returns (uint256)
    {
        // compute current staking limit
        return computeCurrentStakingLimit();
    }

    function getCurrentReward(address staker)
    external
    view
    returns (uint256)
    {
        return 2;
    }

    function setupStakingLimit()
    external
    onlyOwner
    whenPaused
    {
        require(currentStatus == Status.Deployed, '[Lifecycle] Staking limits are already set');
        // set the staking limits
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
        return 2;
    }
}
