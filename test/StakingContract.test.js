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
            anualRewardRate: BigNumber(16),
            lowerBound: BigNumber(0),
            upperBound: BigNumber(1.25e+9),
        },
        {
            anualRewardRate: BigNumber(18),
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

contract('StakingContract', function ([owner, rewardsAddress, unauthorized, account1, account2, account3]) {
    describe('1. Before deployment', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
        });

        it('1.1. should fail when trying to deploy with wrong argument types', async function () {
            await expectInvalidArgument.address(StakingContract.new(this.token.address, 'not_rewards_address'), '_rewardsAddress');
            await expectInvalidArgument.address(StakingContract.new(this.token.address, rewardsAmount), '_rewardsAddress');
            await expectInvalidArgument.address(StakingContract.new('this.token.address', rewardsAddress), '_token');
            await expectInvalidArgument.address(StakingContract.new(0, rewardsAddress), '_token');
        });

        it('1.2. should revert when the token address is not a contract', async function () {
            const revertMessage = "[Validation] The address does not contain a contract";
            await expectRevert(StakingContract.new(account1, rewardsAddress), revertMessage);
        });

        it('1.3. should revert when _rewardsAddress is the zero address', async function () {
            const revertMessage = "[Validation] _rewardsAddress is the zero address";
            await expectRevert(StakingContract.new(this.token.address, constants.ZERO_ADDRESS), revertMessage);
        });
    });

    describe('2. On deployment', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            this.deployTimestamp = await time.latest();
        });

        it('2.1. should set the right owner', async function () {
            expect(await this.stakingContract.owner()).to.be.equal(owner);
        });

        it('2.2. should set the token correctly', async function () {
            expect(await this.stakingContract.token()).to.equal(this.token.address);
        });

        it('2.3. should set the right rewardsAddress', async function () {
            expect(await this.stakingContract.rewardsAddress()).to.equal(rewardsAddress);
        });

        it('2.4. should set the right launchTimestamp', async function () {
            expect(await this.stakingContract.launchTimestamp()).to.be.bignumber.equal(this.deployTimestamp);
        });

        it('2.5. should set the currentStatus to Setup', async function () {
            expect((await this.stakingContract.currentStatus()).toNumber()).to.equal(Status.Setup);
        });
    });

    describe('3. Setup', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            expect(await this.stakingContract.paused()).to.be.true;
        });

        it('3.1. setupStakingLimit: should throw if called with wrong argument types', async function () {
            // uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 unstakingPeriod
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    null, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
                ),
                'maxAmount'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, null, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
                ),
                'initialAmount'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, null, stakingConfig.unstakingPeriod
                ),
                'daysInterval'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, null
                ),
                'unstakingPeriod'
            );
        });

        it('3.2. setupStakingLimit: should revert if not called by the contract owner', async function () {
            const revertMessage = "Ownable: caller is not the owner";
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod,
                    from(unauthorized)
                ),
                revertMessage
            );
        });

        it('3.3. setupStakingLimit: should revert when contract is not paused', async function () {
            await this.stakingContract.unpause();
            const revertMessage = "Pausable: not paused";
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
                ),
                revertMessage
            );
            await this.stakingContract.pause();
        });

        it('3.4. setupStakingLimit: should revert if maxAmount is not a multiple of initialAmount', async function () {
            const revertMessage = '[Validation] maxAmount should be a multiple of initialAmount';
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    BigNumber(231e+3), stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
                ),
                revertMessage
            );
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    BigNumber(7e+8), stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
                ),
                revertMessage
            );
        });

        it('3.5. setupStakingLimit: should revert if one of the params overflow or underflow', async function () {
            const revertMessage = '[Validation] Some parameters are 0';
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, BigNumber(0), stakingConfig.unstakingPeriod
                ),
                revertMessage
            );
        });

        it('3.6. setupStakingLimit: should setup the staking limit correctly', async function () {
            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
            );
            let actualStakingConfig = await this.stakingContract.stakingLimitConfig();

            actualStakingConfig = _.pick(actualStakingConfig, _.keys(stakingConfig));
            actualStakingConfig = _.mapValues(actualStakingConfig, value => value.toString());
            const expectedStakingConfig = _.mapValues(stakingConfig, value => value.toString());

            expect(expectedStakingConfig).to.deep.equal(actualStakingConfig);
        });

        it('3.7. setupStakingLimit: should allow to setup staking periods until the setup is finalized (rewards are setup)', async function () {
            const newConfig = {
                maxAmount: BigNumber(1e+10),
                initialAmount: BigNumber(1e+9),
                daysInterval: BigNumber(3),
                unstakingPeriod: BigNumber(4),
                maxIntervals: BigNumber(10),
            };
            await this.stakingContract.setupStakingLimit(
                newConfig.maxAmount, newConfig.initialAmount, newConfig.daysInterval, newConfig.unstakingPeriod
            );
            let actualStakingConfig = await this.stakingContract.stakingLimitConfig();

            actualStakingConfig = _.pick(actualStakingConfig, _.keys(newConfig));
            actualStakingConfig = _.mapValues(actualStakingConfig, value => value.toString());
            const expectedStakingConfig = _.mapValues(newConfig, value => value.toString());

            expect(expectedStakingConfig).to.deep.equal(actualStakingConfig);
        });

        it('3.8. setupRewards: should revert if not called by the contract owner', async function () {
            const revertMessage = "Ownable: caller is not the owner";
            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, anualRewardRates, lowerBounds, upperBounds,
                    from(unauthorized)
                ),
                revertMessage
            );
        });

        it('3.9. setupRewards: should revert when contract is not paused', async function () {
            await this.stakingContract.unpause();
            const revertMessage = "Pausable: not paused";
            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, anualRewardRates, lowerBounds, upperBounds
                ),
                revertMessage
            );
            await this.stakingContract.pause();
        });

        it('3.10. setupRewards: should throw if called with wrong argument types', async function () {
            await expectInvalidArgument.uint256(
                this.stakingContract.setupRewards(
                    'not a number', anualRewardRates, lowerBounds, upperBounds
                ),
                'multiplier'
            );
            await expectInvalidArgument.array(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, 'not an array', lowerBounds, upperBounds
                ),
                'anualRewardRates'
            );
        });

        it('3.11. setupRewards: should revert if validations fail', async function () {
            const message1 = '[Validation] All parameters must have at least one element';
            const message2 = '[Validation] All parameters must have the same number of elements';
            const message3 = '[Validation] First lower bound should be 0';
            const message4 = '[Validation] Multiplier should be smaller than 100 and divide it equally';
            let wrongLowerBounds = _.clone(lowerBounds);
            wrongLowerBounds[0] = '123';

            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, [], lowerBounds, upperBounds
                ),
                message1
            );
            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, anualRewardRates, _.slice(lowerBounds, 1), upperBounds
                ),
                message2
            );
            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, anualRewardRates, wrongLowerBounds, upperBounds
                ),
                message3
            );
            await expectRevert(
                this.stakingContract.setupRewards(
                    BigNumber(123), anualRewardRates, lowerBounds, upperBounds
                ),
                message4
            );
        });

        it('3.12. setupRewards: should setup the rewards with correct param values and number', async function () {
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                anualRewardRates,
                lowerBounds,
                upperBounds
            );

            const actualMultiplier = await this.stakingContract.rewardConfig();
            const actualRewardsLength = await this.stakingContract.baseRewardsLength();

            let actualRewardsConfig = [];
            let baseReward;

            for (let i = 0; i < anualRewardRates.length; i++) {
                baseReward = await this.stakingContract.baseReward(i.toString());
                actualRewardsConfig.push({
                    anualRewardRate: baseReward['0'],
                    lowerBound: baseReward['1'],
                    upperBound: baseReward['2'],
                });
            }
            actualRewardsConfig = actualRewardsConfig.map(transformRewardToString);
            let expectedRewardsConfig = rewardsConfig.rewardRates.map(transformRewardToString);

            // Adding the 0 annual reward rate
            expectedRewardsConfig.push(        {
                    anualRewardRate: '0',
                    lowerBound: BigNumber(5e+9).toString(),
                    upperBound: BigNumber(5e+9).add(BigNumber(10)).toString(),
                }
            );

            expect(actualRewardsConfig).to.deep.equal(expectedRewardsConfig);
            expect(actualMultiplier.toString()).to.equal(rewardsConfig.multiplier.toString());
            expect(actualRewardsLength.toNumber()).to.equal(expectedRewardsConfig.length);
        });

        it('3.13. setupRewards: should initialize the base rewards history with the first BaseReward which is also the smallest', async function () {
            expect((await this.stakingContract.baseRewardHistoryLength()).toString()).to.equal('1');
        });

        it('3.14. setupRewards: should set the status to Running when the staking is configured', async function () {
            expect((await this.stakingContract.currentStatus()).toNumber()).to.equal(Status.Running);
        });

        it('3.15. setupRewards: should revert when contract is already setup', async function () {
            const revertMessage = '[Lifecycle] Setup is already done';
            await expectRevert(this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                anualRewardRates,
                lowerBounds,
                upperBounds
            ), revertMessage)
        });
    });

    describe('4. Deposit and withdraw', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            await this.token.mint(rewardsAddress, rewardsAmount);
            await this.token.mint(account1, depositAmount);
            await this.token.approve(this.stakingContract.address, rewardsAmount, from(rewardsAddress));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account1));
        });

        it('4.1. deposit: should revert when contract is not setup', async function () {
            const revertMessage = '[Lifecycle] Setup is not done';
            await expectRevert(this.stakingContract.deposit(depositAmount), revertMessage);
        });

        it('4.2. deposit: should throw if called with wrong argument types', async function () {
            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                anualRewardRates,
                lowerBounds,
                upperBounds
            );

            await expectInvalidArgument.uint256(this.stakingContract.deposit('none'), 'amount');
        });

        it('4.3. deposit: should revert when contract is paused', async function () {
            const revertMessage = 'Pausable: paused';
            await expectRevert(this.stakingContract.deposit(depositAmount), revertMessage);
            await this.stakingContract.unpause();
        });

        it('4.4. deposit: should revert if deposit is called with an amount of 0', async function () {
            const message = "[Validation] The stake deposit has to be larger than 0";
            await expectRevert(this.stakingContract.deposit('0'), message);
        });

        it('4.5. deposit: should revert if the account already has a stake deposit', async function () {
            const message = "[Deposit] You already have a stake";
            this.stakingContract.deposit(depositAmount, from(account1));
            await expectRevert(this.stakingContract.deposit(depositAmount, from(account1)), message);
        });

        it('4.6. deposit: should revert if the transfer fails because of insufficient funds', async function () {
            const exceedsBalanceMessage = "ERC20: transfer amount exceeds balance.";
            await expectRevert(this.stakingContract.deposit(depositAmount, from(account2)), exceedsBalanceMessage);
            await this.token.mint(account2, depositAmount);
            const exceedsAllowanceMessage = "ERC20: transfer amount exceeds allowance.";
            await expectRevert(this.stakingContract.deposit(depositAmount, from(account2)), exceedsAllowanceMessage);
        });

        it('4.7. deposit: should create a new deposit for the depositing account and emit StakeDeposited(msg.sender, amount)', async function () {
            const eventData = {
                account: account2,
                amount: depositAmount
            };

            const initialBalance = await this.token.balanceOf(this.stakingContract.address);
            await this.token.approve(this.stakingContract.address, depositAmount, from(account2));
            const {logs} = await this.stakingContract.deposit(depositAmount, from(account2));
            const currentBalance = await this.token.balanceOf(this.stakingContract.address);

            expectEvent.inLogs(logs, 'StakeDeposited', eventData);
            expect(initialBalance.add(depositAmount)).to.be.bignumber.equal(currentBalance);
        });

        it('4.8. deposit: should have current total stake less than current maximum staking limit', async function () {
            const totalStake = await this.stakingContract.currentTotalStake();
            const currentMaxLimit = await this.stakingContract.currentStakingLimit();

            expect(totalStake).to.be.bignumber.below(currentMaxLimit);
            expect(currentMaxLimit).to.be.bignumber.equal(stakingConfig.initialAmount);
        });

        it('4.9. deposit: should revert if trying to deposit more than the first wave limit (5 * 10^8)', async function () {
            const revertMessage = "[Deposit] Your deposit would exceed the current staking limit";
            await this.token.mint(account3, stakingConfig.initialAmount);

            await expectRevert(this.stakingContract.deposit(stakingConfig.initialAmount, from(account3)), revertMessage);
        });

        it('4.10. initiateWithdrawal: should revert when contract is paused', async function () {
            await this.stakingContract.pause();
            await expectRevert(this.stakingContract.initiateWithdrawal(from(account1)), "Pausable: paused");
            await this.stakingContract.unpause();
        });

        it('4.12. initiateWithdrawal: should revert if minimum staking period did not pass', async function () {
            const revertMessage = "[Withdraw] Not enough days passed";
            // 0 Days passed
            await expectRevert(this.stakingContract.initiateWithdrawal(from(account1)), revertMessage);

            // 26 Days passed
            await time.increase(time.duration.days(26));
            await expectRevert(this.stakingContract.initiateWithdrawal(from(account1)), revertMessage);

            // 27 Days passed
            await time.increase(time.duration.days(1));
            await expectRevert(this.stakingContract.initiateWithdrawal(from(account1)), revertMessage);
        });

        it('4.13. initiateWithdrawal: should revert if the account has no stake deposit', async function () {
            // 30 Days passed
            await time.increase(time.duration.days(3));
            const revertMessage = "[Initiate Withdrawal] There is no stake deposit for this account";
            await expectRevert(this.stakingContract.initiateWithdrawal(from(unauthorized)), revertMessage)
        });

        it('4.14. initiateWithdrawal: should emit the WithdrawInitiated(msg.sender, stakeDeposit.amount) event', async function () {
            const eventData = {
                account: account1,
                amount: depositAmount,
            };
            const {logs} = await this.stakingContract.initiateWithdrawal(from(account1));
            expectEvent.inLogs(logs, 'WithdrawInitiated', eventData);
        });

        it('4.15. initiateWithdrawal: should revert if account has already initiated the withdrawal', async function () {
            const revertMessage = "[Initiate Withdrawal] You already initiated the withdrawal";
            await expectRevert(this.stakingContract.initiateWithdrawal(from(account1)), revertMessage)
        });

        it('4.16. executeWithdrawal: should revert when contract is paused', async function () {
            const revertMessage = "Pausable: paused";
            await this.stakingContract.pause();
            await expectRevert(this.stakingContract.executeWithdrawal(from(account1)), revertMessage);
            await this.stakingContract.unpause();
        });

        it('4.17. executeWithdrawal: should revert if there is no deposit on the account', async function () {
            const revertMessage = "[Withdraw] There is no stake deposit for this account";
            await expectRevert(this.stakingContract.executeWithdrawal(), revertMessage);
        });

        it('4.18. executeWithdrawal: should revert if the withdraw was not initialized', async function () {
            const revertMessage = "[Withdraw] Withdraw is not initialized";
            await expectRevert(this.stakingContract.executeWithdrawal(from(account2)), revertMessage);
        });

        it('4.19. executeWithdrawal: should revert if unstaking period did not pass', async function () {
            const revertMessage = '[Withdraw] The unstaking period did not pass';
            await expectRevert(this.stakingContract.executeWithdrawal(from(account1)), revertMessage);
        });

        it('4.20. executeWithdrawal: should revert if transfer fails on reward', async function () {
            const revertMessage = "ERC20: transfer amount exceeds allowance";

            await time.increase(time.duration.days(stakingConfig.unstakingPeriod.add(BigNumber(1))));

            await this.token.decreaseAllowance(
                this.stakingContract.address,
                rewardsAmount.sub(BigNumber(123)),
                from(rewardsAddress)
            );

            await expectRevert(this.stakingContract.executeWithdrawal(from(account1)), revertMessage);
        });

        it('4.21. executeWithdrawal: should transfer the initial staking deposit and the correct reward and emit WithdrawExecuted(msg.sender, amount, reward)', async function () {

        });

        it('4.22. executeWithdrawal: should update the current total stake', async function () {

        });

        it('4.23. executeWithdrawal: should update the base reward history according to the new currentTotalStake', async function () {

        });
    });

    describe('5. Staking limit waves', async function () {
        before(async function () {
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            await this.token.mint(rewardsAddress, rewardsAmount);
            await this.token.mint(account1, depositAmount);
            await this.token.mint(account2, depositAmount);
            await this.token.mint(account3, depositAmount);

            await this.token.approve(this.stakingContract.address, depositAmount, from(account1));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account2));
            await this.token.approve(this.stakingContract.address, depositAmount, from(account3));

            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                anualRewardRates,
                lowerBounds,
                upperBounds
            );
        });

        it('5.3. should not advance the wave earlier', async function () {

        });

        it('5.2. should advance the staking limit to the second wave (1 Billion', async function () {

        });
    });

    describe('6. Base reward changes', async function () {

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
});
