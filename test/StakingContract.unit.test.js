// LIBRARIES
const {expect} = require('chai');
const helper = require('./helper');
const {expectEvent, expectRevert, constants} = require('@openzeppelin/test-helpers');

// CONTRACTS
const StakingContract = artifacts.require('StakingContract');

contract('StakingContract', function ([owner, account1, account2]) {
    describe('Before deployment', async function () {
        it('should fail when trying to deploy with wrong argument types', async function () {
            
        });
    });
});
