const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { LocationClient } = require('@aws-sdk/client-location');

const region = process.env.AWS_REGION || 'us-east-1';

// Shared AWS config — reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars
// or falls back to the default credential chain (IAM role, ~/.aws/credentials, etc.)
const awsConfig = { region };

// DynamoDB bare client
const dynamoDBClient = new DynamoDBClient(awsConfig);

// DynamoDB Document client (higher-level, auto-marshals JS objects)
const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
    },
});

// AWS Location Service client
const locationClient = new LocationClient(awsConfig);

module.exports = {
    dynamoDBClient,
    dynamoDBDocumentClient,
    locationClient,
    region,
};
