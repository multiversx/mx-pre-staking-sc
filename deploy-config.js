const {ether} = require('@openzeppelin/test-helpers');
const {BigNumber} = require('./test/helper');

const stakingConfig = {
    maxAmount: ether(BigNumber(5e+9)),
    initialAmount: ether(BigNumber(500e+6)),
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

// Only used on a testnet
const rewardsAmount = ether(BigNumber(400e+6));

const ownerAddress = "0x585126227843F8C40A7047d008992E31de1dC7fa";
const tokenAddress = "";
const rewardsAddress = "";

module.exports = {
    stakingConfig,
    rewardsAmount,
    rewardsConfig,
    anualRewardRates,
    lowerBounds,
    upperBounds,
    ownerAddress,
    tokenAddress,
    rewardsAddress,
};
