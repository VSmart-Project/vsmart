const {
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    paginateQuery,
} = require('@aws-sdk/lib-dynamodb');
const { dynamoDBDocumentClient } = require('../config/aws');
const { DYNAMODB_DEVICES_TABLE } = require('../config/constants');

/**
 * DynamoDB Service
 * All CRUD operations on the Devices table go through here.
 */

// ─── LIST ──────────────────────────────────────────────────────────────────

/**
 * Retrieve all devices belonging to a specific ownerUserId
 * @param {string} ownerUserId
 * @returns {Array}
 */
const getAllDevicesByOwner = async (ownerUserId) => {
    const items = [];
    const paginator = paginateQuery({ client: dynamoDBDocumentClient }, {
        TableName: DYNAMODB_DEVICES_TABLE,
        IndexName: 'ownerUserId-index',
        KeyConditionExpression: 'ownerUserId = :ownerUserId',
        ExpressionAttributeValues: { ':ownerUserId': ownerUserId },
    });
    for await (const page of paginator) {
        items.push(...(page.Items || []));
    }
    return items;
};

// ─── GET ONE ───────────────────────────────────────────────────────────────

/**
 * Retrieve a single device by deviceId
 * @param {string} deviceId
 * @returns {Object|null}
 */
const getDeviceById = async (deviceId) => {
    const command = new GetCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Key: { deviceId },
    });
    const response = await dynamoDBDocumentClient.send(command);
    return response.Item || null;
};

// ─── CREATE ────────────────────────────────────────────────────────────────

/**
 * Create a new device record
 * @param {Object} deviceData - { deviceId, displayName, type, status, description, ownerUserId }
 * @returns {Object} the created device item
 */
const createDevice = async (deviceData) => {
    const now = new Date().toISOString();
    const item = {
        deviceId: deviceData.deviceId,
        displayName: deviceData.displayName || deviceData.deviceId,
        type: deviceData.type || 'other',
        status: deviceData.status || 'active',
        description: deviceData.description || '',
        ownerUserId: deviceData.ownerUserId || null,
        createdAt: now,
        updatedAt: now,
    };

    const command = new PutCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Item: item,
        // Prevent overwriting an existing item
        ConditionExpression: 'attribute_not_exists(deviceId)',
    });

    await dynamoDBDocumentClient.send(command);
    return item;
};

// ─── UPDATE ────────────────────────────────────────────────────────────────

/**
 * Update device metadata (deviceId / primary key cannot be changed)
 * @param {string} deviceId
 * @param {Object} updates - fields to update
 * @returns {Object} updated device attributes
 */
const updateDevice = async (deviceId, updates) => {
    const allowedFields = ['displayName', 'type', 'status', 'description'];
    const filteredUpdates = {};
    allowedFields.forEach((field) => {
        if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
        }
    });

    filteredUpdates.updatedAt = new Date().toISOString();

    // Build UpdateExpression dynamically
    const expressionParts = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.entries(filteredUpdates).forEach(([key, value]) => {
        expressionParts.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
    });

    const command = new UpdateCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Key: { deviceId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(deviceId)', // Must already exist
        ReturnValues: 'ALL_NEW',
    });

    const response = await dynamoDBDocumentClient.send(command);
    return response.Attributes;
};

// ─── DELETE ────────────────────────────────────────────────────────────────

/**
 * Delete a device from DynamoDB
 * @param {string} deviceId
 * @returns {Object} the deleted item attributes
 */
const deleteDevice = async (deviceId) => {
    const command = new DeleteCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Key: { deviceId },
        ConditionExpression: 'attribute_exists(deviceId)',
        ReturnValues: 'ALL_OLD',
    });
    const response = await dynamoDBDocumentClient.send(command);
    return response.Attributes;
};

// ─── ANTI-THEFT ────────────────────────────────────────────────────────────

/**
 * Persist anti-theft activation fields
 * @param {string} deviceId
 * @param {{ antitheftLat, antitheftLng, antitheftRadius }} fields
 */
const enableAntitheftForDevice = async (deviceId, { antitheftLat, antitheftLng, antitheftRadius }) => {
    const command = new UpdateCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Key: { deviceId },
        UpdateExpression: [
            'SET antitheftEnabled    = :e',
            '    antitheftEnabledStr = :estr',
            '    antitheftLat        = :lat',
            '    antitheftLng        = :lng',
            '    antitheftRadius     = :r',
            '    antitheftAlerted    = :a',
            '    antitheftEnabledAt  = :t',
            '    updatedAt           = :u',
        ].join(', '),
        ExpressionAttributeValues: {
            ':e': true,
            ':estr': 'true',
            ':lat': antitheftLat,
            ':lng': antitheftLng,
            ':r': antitheftRadius,
            ':a': false,
            ':t': new Date().toISOString(),
            ':u': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(deviceId)',
    });
    await dynamoDBDocumentClient.send(command);
};

/**
 * Clear all anti-theft fields when feature is disabled
 */
const disableAntitheftForDevice = async (deviceId) => {
    const command = new UpdateCommand({
        TableName: DYNAMODB_DEVICES_TABLE,
        Key: { deviceId },
        UpdateExpression: 'SET antitheftEnabled = :e, antitheftEnabledStr = :estr, antitheftAlerted = :a, updatedAt = :u REMOVE antitheftLat, antitheftLng, antitheftRadius, antitheftEnabledAt',
        ExpressionAttributeValues: {
            ':e': false,
            ':estr': 'false',
            ':a': false,
            ':u': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(deviceId)',
    });
    await dynamoDBDocumentClient.send(command);
};

module.exports = {
    getAllDevicesByOwner,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
    // ── Anti-theft ──────────────────────────────────
    enableAntitheftForDevice,
    disableAntitheftForDevice,
};
