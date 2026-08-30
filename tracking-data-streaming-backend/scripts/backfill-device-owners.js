require('dotenv').config();

const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDBDocumentClient } = require('../src/config/aws');
const { DYNAMODB_DEVICES_TABLE } = require('../src/config/constants');

async function backfillDeviceOwners() {
    const ownerUserId = process.argv[2] || process.env.BACKFILL_OWNER_USER_ID;
    const deviceIds = process.argv.slice(3);
    if (!ownerUserId || !deviceIds.length) {
        throw new Error(
            'Usage: node scripts/backfill-device-owners.js <cognito-sub> <device-id> [device-id...]'
        );
    }

    for (const deviceId of deviceIds) {
        const response = await dynamoDBDocumentClient.send(new GetCommand({
            TableName: DYNAMODB_DEVICES_TABLE,
            Key: { deviceId },
            ProjectionExpression: 'deviceId, ownerUserId',
        }));
        if (!response.Item) {
            throw new Error(`Device not found: ${deviceId}`);
        }
        if (response.Item.ownerUserId) {
            console.log(`[Backfill] Skipped ${deviceId}; owner is already set`);
            continue;
        }
        await dynamoDBDocumentClient.send(new UpdateCommand({
            TableName: DYNAMODB_DEVICES_TABLE,
            Key: { deviceId },
            UpdateExpression: 'SET ownerUserId = :owner, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':owner': ownerUserId,
                ':updatedAt': new Date().toISOString(),
            },
            ConditionExpression: 'attribute_exists(deviceId) AND attribute_not_exists(ownerUserId)',
        }));

        console.log(`[Backfill] Updated ${deviceId} -> ${ownerUserId}`);
    }

    console.log('[Backfill] Done');
}

backfillDeviceOwners().catch((error) => {
    console.error('[Backfill] Failed:', error.message);
    process.exit(1);
});
