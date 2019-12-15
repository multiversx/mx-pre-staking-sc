const {BN} = require('@openzeppelin/test-helpers');

const BigNumber = (number) => new BN(number);

const randomTo = (ceil) => {
    return BigNumber(Math.floor(Math.random() * ceil));
};

module.exports = {
    randomTo,
    BigNumber
};
