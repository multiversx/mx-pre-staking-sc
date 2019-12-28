// LIBRARIES
const {expect} = require('chai');
const _ = require('lodash');

const {expectEvent, expectRevert, constants, time, ether} = require('@openzeppelin/test-helpers');
const {BigNumber, expectInvalidArgument, getEventProperty} = require('./helper');

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
const rewardsAmount = ether(BigNumber(400e+6));
const stakingConfig = {
    maxAmount: ether(BigNumber(5e+9)),
    initialAmount: ether(BigNumber(5e+8)),
    daysInterval: BigNumber(3),
    daysUnstakingPeriod: BigNumber(7),
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
const annualRewardRates = rewardsConfig.rewardRates.map(rewardRate => rewardRate.anualRewardRate.toString());
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
            // uint256 maxAmount, uint256 initialAmount, uint256 daysInterval, uint256 daysUnstakingPeriod
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    null, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
                ),
                'maxAmount'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, null, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
                ),
                'initialAmount'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, null, stakingConfig.daysUnstakingPeriod
                ),
                'daysInterval'
            );
            await expectInvalidArgument.uint256(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, null
                ),
                'daysUnstakingPeriod'
            );
        });

        it('3.2. setupStakingLimit: should revert if not called by the contract owner', async function () {
            const revertMessage = "Ownable: caller is not the owner";
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod,
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
                    stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
                ),
                revertMessage
            );
            await this.stakingContract.pause();
        });

        it('3.4. setupStakingLimit: should revert if maxAmount is not a multiple of initialAmount', async function () {
            const revertMessage = '[Validation] maxAmount should be a multiple of initialAmount';
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    BigNumber(231e+3), stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
                ),
                revertMessage
            );
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    BigNumber(7e+8), stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
                ),
                revertMessage
            );
        });

        it('3.5. setupStakingLimit: should revert if one of the params overflow or underflow', async function () {
            const revertMessage = '[Validation] Some parameters are 0';
            await expectRevert(
                this.stakingContract.setupStakingLimit(
                    stakingConfig.maxAmount, stakingConfig.initialAmount, BigNumber(0), stakingConfig.daysUnstakingPeriod
                ),
                revertMessage
            );
        });

        it('3.6. setupStakingLimit: should setup the staking limit correctly', async function () {
            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
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
                daysUnstakingPeriod: BigNumber(4),
                maxIntervals: BigNumber(10),
            };
            await this.stakingContract.setupStakingLimit(
                newConfig.maxAmount, newConfig.initialAmount, newConfig.daysInterval, newConfig.daysUnstakingPeriod
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
                    rewardsConfig.multiplier, annualRewardRates, lowerBounds, upperBounds,
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
                    rewardsConfig.multiplier, annualRewardRates, lowerBounds, upperBounds
                ),
                revertMessage
            );
            await this.stakingContract.pause();
        });

        it('3.10. setupRewards: should throw if called with wrong argument types', async function () {
            await expectInvalidArgument.uint256(
                this.stakingContract.setupRewards(
                    'not a number', annualRewardRates, lowerBounds, upperBounds
                ),
                'multiplier'
            );
            await expectInvalidArgument.array(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, 'not an array', lowerBounds, upperBounds
                ),
                'annualRewardRates'
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
                    rewardsConfig.multiplier, annualRewardRates, _.slice(lowerBounds, 1), upperBounds
                ),
                message2
            );
            await expectRevert(
                this.stakingContract.setupRewards(
                    rewardsConfig.multiplier, annualRewardRates, wrongLowerBounds, upperBounds
                ),
                message3
            );
            await expectRevert(
                this.stakingContract.setupRewards(
                    BigNumber(123), annualRewardRates, lowerBounds, upperBounds
                ),
                message4
            );
        });

        it('3.12. setupRewards: should setup the rewards with correct param values and number', async function () {
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                annualRewardRates,
                lowerBounds,
                upperBounds
            );

            const actualMultiplier = await this.stakingContract.rewardConfig();
            const actualRewardsLength = await this.stakingContract.baseRewardsLength();

            let actualRewardsConfig = [];
            let baseReward;

            for (let i = 0; i < actualRewardsLength; i++) {
                baseReward = await this.stakingContract.baseReward(i.toString());
                actualRewardsConfig.push({
                    anualRewardRate: baseReward['0'],
                    lowerBound: baseReward['1'],
                    upperBound: baseReward['2'],
                });
            }
            actualRewardsConfig = actualRewardsConfig.map(transformRewardToString);
            let expectedRewardsConfig = rewardsConfig.rewardRates.map(transformRewardToString);

            const zeroRewardLowerBound = ether(BigNumber(5e+9));
            // Adding the 0 annual reward rate
            expectedRewardsConfig.push(        {
                    anualRewardRate: '0',
                    lowerBound: zeroRewardLowerBound.toString(),
                    upperBound: zeroRewardLowerBound.add(BigNumber(10)).toString(),
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
                annualRewardRates,
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
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                annualRewardRates,
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

            await time.increase(time.duration.days(stakingConfig.daysUnstakingPeriod));

            await this.token.decreaseAllowance(
                this.stakingContract.address,
                rewardsAmount.sub(BigNumber(123)),
                from(rewardsAddress)
            );

            await expectRevert(this.stakingContract.executeWithdrawal(from(account1)), revertMessage);
        });

        it('4.21. currentReward(): should return the stake deposit and current reward for a specified account', async function () {
            const currentReward = await this.stakingContract.currentReward(account1);

            expect(currentReward[0]).to.be.bignumber.equal(depositAmount);
            expect(currentReward[1]).to.be.bignumber.above(BigNumber(0));
        });

        it('4.22. getStakeDeposit(): should return the current the stake deposit for the msg.sender', async function () {
            const stakeDeposit = await this.stakingContract.getStakeDeposit(from(account1));

            expect(stakeDeposit[0]).to.be.bignumber.equal(depositAmount);
        });

        it('4.22. executeWithdrawal: should transfer the initial staking deposit and the correct reward and emit WithdrawExecuted', async function () {
            await this.token.increaseAllowance(
                this.stakingContract.address,
                rewardsAmount.sub(BigNumber(123)),
                from(rewardsAddress)
            );
            const initialTotalStake = await this.stakingContract.currentTotalStake();
            const {logs}  = await this.stakingContract.executeWithdrawal(from(account1));
            const currentTotalStake = await this.stakingContract.currentTotalStake();

            const eventData = {
                account: account1,
                amount: depositAmount,
            };

            expectEvent.inLogs(logs, 'WithdrawExecuted', eventData);
            expect(currentTotalStake).to.be.bignumber.equal(initialTotalStake.sub(depositAmount));
        });
    });

    describe('5. Disable rewards', async function () {
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
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                annualRewardRates,
                lowerBounds,
                upperBounds
            );
            await this.stakingContract.unpause();
        });

        it('should allow only the owner to disable rewards', async function () {
            const msg = "Ownable: caller is not the owner";
            await expectRevert(this.stakingContract.toggleRewards(true, from(unauthorized)), msg);
        });

        it("should reduce the reward to half if rewards are disabled for 15 out of 30 days", async function () {
            // Account 1
            await this.stakingContract.deposit(depositAmount, from(account1));

            await time.increase(time.duration.days(15));
            await this.stakingContract.toggleRewards(false);
            await time.increase(time.duration.days(15));
            await this.stakingContract.initiateWithdrawal(from(account1));
            await time.increase(time.duration.days(8));
            const tx1 = await this.stakingContract.executeWithdrawal(from(account1));

            // Account 2
            await this.stakingContract.toggleRewards(true);
            await this.stakingContract.deposit(depositAmount, from(account2));
            await time.increase(time.duration.days(30));
            await this.stakingContract.initiateWithdrawal(from(account2));
            await time.increase(time.duration.days(8));
            const tx2 = await this.stakingContract.executeWithdrawal(from(account2));

            const reward1 = getEventProperty(tx1.logs, 'WithdrawExecuted', 'reward');
            const reward2 = getEventProperty(tx2.logs, 'WithdrawExecuted', 'reward');

            expect(reward1).to.be.bignumber.equal(reward2.div(BigNumber(2)));
        });
    });

    describe('6. Staking limit waves', async function () {
        before(async function () {
            this.bigDepositAmount = ether(BigNumber(2e+9));
            this.token = await Token.new('ElrondToken', 'ERD', BigNumber(18));
            this.stakingContract = await StakingContract.new(this.token.address, rewardsAddress);
            await this.token.mint(rewardsAddress, rewardsAmount);
            await this.token.mint(account1, this.bigDepositAmount);
            await this.token.mint(account2, this.bigDepositAmount);
            await this.token.mint(account3, this.bigDepositAmount);

            await this.token.approve(this.stakingContract.address, this.bigDepositAmount, from(account1));
            await this.token.approve(this.stakingContract.address, this.bigDepositAmount, from(account2));
            await this.token.approve(this.stakingContract.address, this.bigDepositAmount, from(account3));

            await this.stakingContract.setupStakingLimit(
                stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.daysUnstakingPeriod
            );
            await this.stakingContract.setupRewards(
                rewardsConfig.multiplier,
                annualRewardRates,
                lowerBounds,
                upperBounds
            );
            await this.stakingContract.unpause();
        });

        it('5.2. should not advance the wave earlier', async function () {
            await time.increase(time.duration.days(2));
            await expectRevert(this.stakingContract.deposit(this.bigDepositAmount, from(account1)),
                "[Deposit] Your deposit would exceed the current staking limit"
            );
            const currentStakingLimit = await this.stakingContract.currentStakingLimit();
            expect(currentStakingLimit).to.be.bignumber.equal(ether(BigNumber(500e+6)));
        });

        it('5.3. should advance the staking limit to the second wave (1 Billion)', async function () {
            await time.increase(time.duration.days(1));
            const currentStakingLimit = await this.stakingContract.currentStakingLimit();
            expect(currentStakingLimit).to.be.bignumber.equal(ether(BigNumber(1e+9)));
        });

        it('5.4. should advance the stakingLimit to the second wave (1.5 Billion) ', async function () {
            await time.increase(time.duration.days(3));
            const currentStakingLimit = await this.stakingContract.currentStakingLimit();
            expect(currentStakingLimit).to.be.bignumber.equal(ether(BigNumber(1.5e+9)));
        });

        it('5.5. should advance the staking limit to the maximum amount and not more', async function () {
            await time.increase(time.duration.days(33));
            const currentStakingLimit = await this.stakingContract.currentStakingLimit();
            expect(currentStakingLimit).to.be.bignumber.equal(ether(BigNumber(5e+9)));
        });
    });
});
