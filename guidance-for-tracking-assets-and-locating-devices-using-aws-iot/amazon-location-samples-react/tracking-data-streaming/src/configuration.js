// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// This configuration file is a single place to provide any values to set up the app

export const READ_ONLY_IDENTITY_POOL_ID = "us-east-1:3b8ae368-f19b-4bbe-ba22-d2255742d290"; // REQUIRED - Amazon Cognito id for readonly role
export const WRITE_ONLY_IDENTITY_POOL_ID = "us-east-1:0201500f-c783-40e7-996c-018d4acde6b9"; // REQUIRED - Amazon Cognito id for writeonly role
export const REGION = "us-east-1"; // REQUIRED - Amazon Cognito Region
export const API_KEY = "v1.public.eyJqdGkiOiJiMTIyZThlMC1iOWI2LTQ2ZWYtOWIyMS0xNWFiMmFkYzI0NzYifUBnaGN3FJbkZQIG4jP3lzzemmkMKHUMuiYI9SqieB0vy7M8vDBmfsK5S1EtjreGDYYG8DvPKOGfJapcNMWlSsSp4hzBKChO_Ted40o8LBi49qeFdX71sRqgQaBTe427yG1O5SoxgF2yJ0NcUCJx6xErH80DPPHyTPhYqtTuPMLdXS18vcgb1Ftiyz8MOwaLDEr3Ok8bZMCgPyZqEwDgXOz8I2w8Zii9uaJTdQ6f3iduxvHGB-shFJGaemnxCpEqq4kau-wy7mjT-nwRU7oz31imT9hvtPhMvRuU7QQCwI9gCXQgQqS35nr-Ek1O5qEwFlxIqPdXdYBxIAi8WZiNe3w.ZWU0ZWIzMTktMWRhNi00Mzg0LTllMzYtNzlmMDU3MjRmYTkx"; // REQUIRED - Amazon Location API key

export const MAP = {
      STYLE: "Standard", // REQUIRED - String containing the desired map style name
      COLOR_SCHEME: "Light", // REQUIRED - String containing the desired map color scheme
};

export const GEOFENCE = "TrackingAndGeofencingSampleCollection"; // REQUIRED - Amazon Location Service geofence collection resource name

export const TRACKER = "SampleTracker"; // REQUIRED - Amazon Location Service tracker resource name

export const DEVICE_POSITION_HISTORY_OFFSET = 3600; // REQUIRED - Relative time range of Device Position History to display in seconds. Default to 1 hour.

export const KINESIS_DATA_STREAM_NAME =
      "TrackingAndGeofencingSampleKinesisDataStream"; // REQUIRED for running the demo - defined in ./cfn_template/kinesisResources.yml
