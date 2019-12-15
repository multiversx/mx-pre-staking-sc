const {getEventProperty} = require('./functions/events');
const {expectInvalidArgument} = require('./functions/invalidArgument');
const numbers = require('./functions/numbers');
const {uniqueId} = require('./functions/uniqueId');

module.exports = {
    getEventProperty,
    expectInvalidArgument,
    numbers,
    uniqueId
};
