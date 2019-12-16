const { expect } = require('chai');

function selectErrorObject(error) {
    return {
        code: error.code,
        arg: error.arg,
        coderType: error.coderType,
    };
}

const expectException = async function (promise, expectedError) {
    try {
        await promise;
    } catch (error) {
        const actualError = selectErrorObject(error);
        expect(actualError).to.deep.equal(expectedError, 'Wrong kind of exception received');
        return;
    }

    expect.fail('Expected an exception but none was received');
};

const expectInvalidArgument = async function (promise, argName, coderType) {
    const expectedError = {
        code: 'INVALID_ARGUMENT',
        arg: argName,
        coderType
    };

    return await expectException(promise, expectedError);
};

expectInvalidArgument.string = async (promise, argumentName) => expectInvalidArgument(promise, argumentName, 'string');
expectInvalidArgument.array = async (promise, argumentName) => expectInvalidArgument(promise, argumentName, 'array');
expectInvalidArgument.uint256 = async (promise, argumentName) => expectInvalidArgument(promise, argumentName, 'uint256');
expectInvalidArgument.address = async (promise, argumentName) => expectInvalidArgument(promise, argumentName, 'address');

module.exports = {
    expectInvalidArgument,
};
