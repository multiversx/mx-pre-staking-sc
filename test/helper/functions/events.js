const { expect } = require('chai');

function getEventProperty (logs, eventName, eventProperty) {
    const events = logs.filter(e => e.event === eventName);
    expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);
    const event = events.find(function (e) {
        return !!e.args[eventProperty];
    });

    return event.args[eventProperty];
}

module.exports = {
    getEventProperty,
};
