// LIBRARIES
const {expect} = require('chai');
const _ = require('lodash');

const {expectEvent, expectRevert, constants, time, balance} = require('@openzeppelin/test-helpers');
const {BigNumber, expectInvalidArgument, timeTravel} = require('./helper');

// CONTRACTS
const StakingContract = artifacts.require('StakingContract');
const Token = artifacts.require('Token');

// TESTING VALUES
const Status = {
    Setup: 0,
    Running: 1,
    RewardsDisabled: 2,
};

const depositAmount = BigNumber(1e+6);
const rewardsAmount = BigNumber(400e+6);
const stakingConfig = {
    maxAmount: BigNumber(5e+9),
    initialAmount: BigNumber(5e+8),
    daysInterval: BigNumber(3),
    unstakingPeriod: BigNumber(7),
    maxIntervals: BigNumber(10),
};

const rewardsConfig = {
    multiplier: BigNumber(1),
    rewardRates: [
        {
            anualRewardRate: BigNumber(17),
            lowerBound: BigNumber(0),
            upperBound: BigNumber(1.25e+9),
        },
        {
            anualRewardRate: BigNumber(19),
            lowerBound: BigNumber(1.25e+9),
            upperBound: BigNumber(2.5e+9),
        },
        {
            anualRewardRate: BigNumber(21),
            lowerBound: BigNumber(2.5e+9),
            upperBound: BigNumber(3.75e+9),
        },
        {
            anualRewardRate: BigNumber(23),
            lowerBound: BigNumber(3.75e+9),
            upperBound: BigNumber(5e+9),
        },
    ]
};
const anualRewardRates = rewardsConfig.rewardRates.map(rewardRate => rewardRate.anualRewardRate.toString());
const lowerBounds = rewardsConfig.rewardRates.map(rewardRate => rewardRate.lowerBound.toString());
const upperBounds = rewardsConfig.rewardRates.map(rewardRate => rewardRate.upperBound.toString());
const transformRewardToString = element => {
    return {
        anualRewardRate: element.anualRewardRate.toString(),
        lowerBound: element.lowerBound.toString(),
        upperBound: element.upperBound.toString(),
    }
};
const from = (account) => ({from: account});

contract('StakingContract', function ([owner, rewardsAddress, account1, account2, account3]) {
    describe('1. Reward is returned properly', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            await this.token.mint(rewardsAddress, rewardsAmount);
            await this.token.mint(account1, depositAmount);
            await this.token.mint(account2, depositAmount);
            await this.token.mint(account3, depositAmount);
            // allow staking contract
            await this.token.approve(this.stakingContract.address, rewardsAmount, from(rewardsAddress));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account1));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account2));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account3));

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

        it('1.1 should return 10758.9 return', async function () {
            // await time.increase(time.duration.days(9));
            await this.stakingContract.deposit(depositAmount, from(account1));

            await time.increase(time.duration.days(30));
            await this.stakingContract.initiateWithdrawal(from(account1));

            await time.increase(time.duration.days(8));
            const revertMessage = "ERC20: transfer amount exceeds allowance";
            await expectRevert(this.stakingContract.executeWithdrawal(from(account1)), revertMessage);
        });
    });
});
