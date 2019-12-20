// LIBRARIES
const {expect} = require('chai');
const {expectEvent, time, ether} = require('@openzeppelin/test-helpers');
const {BigNumber, getEventProperty} = require('./helper');
const { fromWei } = require('web3-utils');

// CONTRACTS
const StakingContract = artifacts.require('StakingContract');
const Token = artifacts.require('Token');

// TESTING VALUES
const Status = {
    Setup: 0,
    Running: 1,
    RewardsDisabled: 2,
};

const depositAmount = ether(BigNumber(1e+6));
const depositThreshold = ether(BigNumber(1.25e+9));
const rewardsAmount = ether(BigNumber(400e+6));
const stakingConfig = {
    maxAmount: ether(BigNumber(5e+9)),
    initialAmount: ether(BigNumber(5e+8)),
    daysInterval: BigNumber(3),
    unstakingPeriod: BigNumber(7),
    maxIntervals: BigNumber(10),
};

const rewardsConfig = {
    multiplier: BigNumber(5),
    rewardRates: [
        {
            anualRewardRate: BigNumber(17),
            lowerBound: BigNumber(0),
            upperBound: ether(BigNumber(1.25e+9)),
        },
        {
            anualRewardRate: BigNumber(19),
            lowerBound: ether(BigNumber(1.25e+9)),
            upperBound: ether(BigNumber(2.5e+9)),
        },
        {
            anualRewardRate: BigNumber(21),
            lowerBound: ether(BigNumber(2.5e+9)),
            upperBound: ether(BigNumber(3.75e+9)),
        },
        {
            anualRewardRate: BigNumber(23),
            lowerBound: ether(BigNumber(3.75e+9)),
            upperBound: ether(BigNumber(5e+9)),
        },
    ]
};

const anualRewardRates = rewardsConfig.rewardRates.map(rewardRate => rewardRate.anualRewardRate.toString());
const lowerBounds = rewardsConfig.rewardRates.map(rewardRate => rewardRate.lowerBound.toString());
const upperBounds = rewardsConfig.rewardRates.map(rewardRate => rewardRate.upperBound.toString());

const from = (account) => ({from: account});

contract('StakingContract', function ([owner, rewardsAddress, account1, account2, account3, account4]) {
    describe('1. Reward is returned properly', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            await this.token.mint(rewardsAddress, rewardsAmount);
            await this.token.mint(account1, depositAmount);
            await this.token.mint(account2, stakingConfig.maxAmount);
            await this.token.mint(account3, stakingConfig.maxAmount);
            await this.token.mint(account4, stakingConfig.maxAmount);
            // allow staking contract
            await this.token.approve(this.stakingContract.address, rewardsAmount, from(rewardsAddress));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account1));
            await this.token.approve(this.stakingContract.address, stakingConfig.maxAmount, from(account2));
            await this.token.approve(this.stakingContract.address, stakingConfig.maxAmount, from(account3));
            await this.token.approve(this.stakingContract.address, stakingConfig.maxAmount, from(account4));

            // setup staking contract
            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                anualRewardRates,
                lowerBounds,
                upperBounds
            );
            await this.stakingContract.unpause();
        });

        it('1.1 (Contract returns the right amount but the test needs rewritten) should return 79134 reward', async function () {
            const stakingPeriod = BigNumber(90);
            const weightedSum = BigNumber(1992);
            const weightedAverage = weightedSum.div(stakingPeriod);
            const accumulator = weightedSum.mul(rewardsConfig.multiplier).div(BigNumber(1000));
            const effectiveRewardRate = weightedAverage.add(accumulator);

            const expectedReward = depositAmount.mul(effectiveRewardRate).mul(stakingPeriod).div(BigNumber(36500));

            // TODO: The contract computes the right reward but not in this test

            await time.increase(time.duration.days(30));
            await this.stakingContract.deposit(depositAmount, from(account1));

            await time.increase(time.duration.days(6));
            await this.stakingContract.deposit(depositThreshold, from(account2));

            await time.increase(time.duration.days(6));
            await this.stakingContract.deposit(depositThreshold, from(account3));

            await time.increase(time.duration.days(9));
            await this.stakingContract.deposit(depositThreshold, from(account4));

            await time.increase(time.duration.days(69));

            await this.stakingContract.initiateWithdrawal(from(account1));
            await time.increase(time.duration.days(7));

            const {logs} = await this.stakingContract.executeWithdrawal(from(account1));
            const actualReward = getEventProperty(logs, 'WithdrawExecuted', 'reward');

            console.log('======= ACTUAL REWARD =======');
            console.log(actualReward.toString());

            const eventData = {
                account: account1,
                amount: depositAmount,
                reward: expectedReward,
            };

            expectEvent.inLogs(logs, 'WithdrawExecuted', eventData);
        });
    });
});
