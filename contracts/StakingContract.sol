pragma solidity ^0.5.14;

import "./libs/math/SafeMath.sol";
import "./token/ERC20/IERC20.sol";
import "./libs/lifecycle/Pausable.sol";
import "./libs/math/Math.sol";

contract StakingContract is Pausable {

    using Math, SafeMath for uint256;

    event StakeDeposited();

    event StakeWithdrawn();

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

    // PUBLIC
    constructor(address _token)
    public
    {
        token = IERC20(_token);
        launchMoment = now;
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

    function getCurrentReward

    // INTERNAL
    function computeReward(address staker)
    private
    view
    returns(uint256)
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
