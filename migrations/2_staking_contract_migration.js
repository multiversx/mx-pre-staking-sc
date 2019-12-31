const {
    stakingConfig,
    ownerAddress,
    anualRewardRates,
    lowerBounds,
    upperBounds,
    rewardsAmount,
    rewardsConfig,
} = require('../deploy-config');

let {rewardsAddress, tokenAddress} = require('../deploy-config');

const StakingContract = artifacts.require("StakingContract");
const Token = artifacts.require("Token");

module.exports = async function (deployer, network, [owner]) {
    let token;

    if (!network.includes('mainnet')) {
        rewardsAddress = owner;
        await deployer.deploy(Token, 'Elrond Token', 'ERD', '18');
        token = await Token.deployed();
        tokenAddress = Token.address;

        console.log(`Minting ${rewardsAmount.toString()} tokens for address: '${rewardsAddress}'`);
        await token.mint(rewardsAddress, rewardsAmount);
    }

    // Deploy the Staking Contract
    await deployer.deploy(StakingContract, tokenAddress, rewardsAddress);
    const stakingContract = await StakingContract.deployed();

    if (!network.includes('mainnet')) {
        console.log(`Approving ${rewardsAmount.toString()} tokens for contract: '${StakingContract.address}'`);
        await token.approve(StakingContract.address, rewardsAmount);
    }

    // Setup the contract
    console.log(`Setup staking limit 'StakingContract'`);
    await stakingContract.setupStakingLimit(
        stakingConfig.maxAmount, stakingConfig.initialAmount, stakingConfig.daysInterval, stakingConfig.unstakingPeriod
    );

    console.log(`Setup rewards 'StakingContract'`);
    await stakingContract.setupRewards(
        rewardsConfig.multiplier,
        anualRewardRates,
        lowerBounds,
        upperBounds
    );
    console.log(`Unpausing 'StakingContract'`);
    await stakingContract.unpause();

    // Change owner
    console.log(`Transferring ownership 'StakingContract'`);
    console.log(`from: '${owner}'`, `to: ${ownerAddress}`);
    await stakingContract.transferOwnership(ownerAddress);
};
