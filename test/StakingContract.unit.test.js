// LIBRARIES
const {expect} = require('chai');
const helper = require('./helper');
const {expectEvent, expectRevert, constants} = require('@openzeppelin/test-helpers');

// CONTRACTS
const StakingContract = artifacts.require('StakingContract');

contract('StakingContract | Unit Tests', function ([owner, account1, account2]) {
    describe('Before deployment', async function () {
        it('should fail when trying to deploy with wrong argument types', async function () {

        });

        it('should revert when the token address is not a contract', async function () {

        });

        it('should revert when _rewardsAddress is the zero address', async function () {
            const revertMessage = "[Validation] _rewardsAddress is the zero address";
        });
    });

    describe('constructor', async function () {
        it('should set the right owner', async function () {

        });

        it('should set the token correctly', async function () {

        });

        it('should set the right _rewardsAddress', async function () {

        });

        it('should set the right launchTimestamp', async function () {

        });

        it('should set the currentStatus to Setup', async function () {

        });
    });

    describe('Function: deposit', async function () {
        it('should revert when contract is paused', async function () {

        });

        it('should revert when contract is not setup', async function () {

        });

        it('should revert if current max staking limit has been reached', async function () {

        });

        it('should revert if the account already has a stake deposit', async function () {
            const message = "[Deposit] You already have a stake";
        });

        it('should revert if the transfer fails from the depositing account to the contract with no state changes', async function () {
            const message = "[Deposit] Something went wrong during the token transfer";
        });

        it('should create a new deposit for the depositing account and emit StakeDeposited(msg.sender, amount)', async function () {
            // stakeDeposit.amount = stakeDeposit.amount.add(amount);
            //         stakeDeposit.startDate = now;
            //         stakeDeposit.startCheckpointIndex = baseRewardHistory.length - 1;
            //         stakeDeposit.exists = true;
        });

        it('should transfer the tokens from the depositing account to the contract', async function () {

        });
    });

    describe('Function: initiateWithdrawal', async function () {
        it('should revert when contract is paused', async function () {

        });

        it('should revert when contract is not setup', async function () {

        });

        it('should revert if minimum staking period did not pass', async function () {

        });

        it('should revert if the account has no stake deposit', async function () {

        });

        it('should should revert if account has already initiated the withdrawal', async function () {

        });

        it('should emit the WithdrawInitiated(msg.sender, stakeDeposit.amount) event', async function () {

        });

        it('should modify the stake deposit to include the endDate and current base reward history checkpoint', async function () {

        });
    });

    describe('Function: executeWithdrawal', async function () {
        it('should revert when contract is paused', async function () {

        });

        it('should revert when contract is not setup', async function () {

        });

        it('should revert if unstaking period did not pass', async function () {
            const revertMessage = '[Withdraw] The unstaking period did not pass';
        });

        it('should revert if transfer fails on initial deposit amount', async function () {
            const message = "[Withdraw] Something went wrong while transferring your initial deposit";
        });

        it('should revert if transfer fails on reward', async function () {
            const message = "[Withdraw] Something went wrong while transferring your reward";
        });

        it('should transfer the initial staking deposit and the correct reward and emit WithdrawExecuted(msg.sender, amount, reward)', async function () {

        });

        it('should update the current total stake', async function () {

        });

        it('should update the base reward history according to the new currentTotalStake', async function () {

        });
    });

    describe('Function: getCurrentStakingLimit', async function () {
        it('should revert if contract is not setup', async function () {
            
        });

        it('should return the correct current staking limit', async function () {

        });
    });

    describe('Function: getCurrentReward', async function () {
        it('should revert if contract is not setup', async function () {

        });

        it('should revert if account does not have a stake deposit', async function () {
            const message = "[Validation] This account doesn't have a stake deposit";
        });

        it('should return the correct current reward for the calling account', async function () {

        });
    });

    describe('Function: toggleRewards', async function () {
        it('should revert if not called by the contract owner', async function () {

        });

        it('should revert if contract is not setup', async function () {

        });

        it('should change the contract status to Running or RewardsDisabled based on the enabled parameter', async function () {

        });

        it('should update the baseRewardsHistory with the 0 reward', async function () {

        });
    });

    describe('Function: setupStakingLimit', async function () {
        it('should revert if not called by the contract owner', async function () {

        });

        it('should revert when contract is not paused', async function () {

        });

        it('should revert when contract is already setup', async function () {

        });

        it('should throw if called with wrong argument types', async function () {

        });

        it('should revert if maxAmount is not a multiple of initialAmount', async function () {
            const message = '[Validation] maxAmount should be a multiple of initialAmount';
        });

        it('should revert if one of the params overflow or underflow', async function () {
            
        });

        it('should setup the staking limit correctly', async function () {
            // stakingLimitConfig.maxAmount
            // stakingLimitConfig.initialAmount
            // stakingLimitConfig.daysInterval
            // stakingLimitConfig.unstakingPeriod
            // stakingLimitConfig.maxIntervals
        });

        it('should complete the setup when the baseRewards are already set', async function () {
            
        });
    });

    describe('Function: setupRewards', async function () {
        it('should revert if not called by the contract owner', async function () {

        });

        it('should revert when contract is not paused', async function () {

        });

        it('should revert when contract is already setup', async function () {

        });

        it('should complete the setup when the baseRewards are already set', async function () {

        });

        it('should throw if called with wrong argument types', async function () {

        });

        it('should revert if validations fail', async function () {
            const message1 = '[Validation] All parameters must have at least one element';
            const message2 = '[Validation] All parameters must have the same number of elements';
            const message3 = '[Validation] First lower bound should be 0';
            const message4 = '[Validation] Multiplier should be smaller than 100 and divide it equally';
        });

        it('should setup the rewards with correct param values and number', async function () {
            
        });

        it('should initialize the base rewards history with the first BaseReward which is also the smallest', async function () {

        });

        it('should complete the setup when the baseRewards are already set', async function () {

        });
    });
});
