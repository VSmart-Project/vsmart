const test = require('node:test');
const assert = require('node:assert/strict');

process.env.COGNITO_USER_POOL_ID ||= 'ap-southeast-1_example123';
process.env.COGNITO_CLIENT_ID ||= 'exampleclientid';
process.env.REALTIME_WEBHOOK_KEY = 'test-only-webhook-key-that-is-at-least-32-characters';

const { server } = require('../index');
const { createRealtimeEvent, REALTIME_EVENT_TYPES } = require('../src/config/realtimeEventSchema');

const listen = () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const close = () => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
});

test('realtime webhook rejects bad keys and accepts a valid envelope', async () => {
    const port = await listen();
    const url = `http://127.0.0.1:${port}/api/realtime/event`;
    const event = createRealtimeEvent({
        type: REALTIME_EVENT_TYPES.DEVICE_ONLINE,
        userId: 'owner-1',
        deviceId: 'device-1',
    });

    try {
        const unauthorized = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': 'wrong' },
            body: JSON.stringify(event),
        });
        assert.equal(unauthorized.status, 401);

        const accepted = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': process.env.REALTIME_WEBHOOK_KEY,
            },
            body: JSON.stringify(event),
        });
        assert.equal(accepted.status, 200);
        assert.deepEqual(await accepted.json(), { success: true });
    } finally {
        await close();
    }
});
