const {BN} = require('@openzeppelin/test-helpers');

advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock('latest'));
};

advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
};

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;

            return resolve(newBlockHash)
        });
    });
};

daysToSeconds = (days) => days * 24 * 60 * 60;

const getStartDate = async () => {
    const {timestamp} = await web3.eth.getBlock(await web3.eth.getBlockNumber());
    return new BN(timestamp).add(new BN(100));
};

module.exports = {
    advanceTime,
    advanceBlock,
    advanceTimeAndBlock,
    daysToSeconds,
    getStartDate,
};
