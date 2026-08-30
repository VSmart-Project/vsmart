# VSmart Tracking — Infrastructure

> **AWS CloudFormation** deployment for the complete VSmart IoT Asset Tracking backend on AWS.

This single stack provisions **all** required AWS resources so you only need to deploy once to get a fully working cloud backend — from authentication to real-time GPS tracking.

---

## What's Included

| Service | Resource Name | Purpose |
|---|---|---|
| **Cognito User Pool** | `TrackingDATN-UserPool` | Email-based login / registration / OTP |
| **DynamoDB** | `TrackingDATN-Devices` | Device metadata storage |
| **DynamoDB** | `TrackingDATN-DeviceState` | Current device state for phased realtime rollout |
| **AWS Location Service** | `TrackingDATN-Map/Tracker/GeofenceCollection` | Map tiles, real-time GPS tracking, geofences |
| **AWS IoT Core** | `TrackingDATN_UpdateLocationTracker` | MQTT broker & routing rule |
| **Lambda (Python)** | `TrackingDATN-IoTMessageProcessor` | Parses MQTT payloads → pushes to Tracker |
| **Lambda (Python)** | `TrackingDATN-GeofenceEventConsumer` | Validates ownership and publishes geofence events |
| **EventBridge + SQS** | `TrackingDATN-GeofenceEventRule` | Captures geofence breach events |
| **SNS** | `TrackingDATN-AntitheftAlerts` | Email alert on anti-theft trigger |

---

## Prerequisites

Before deploying, make sure you have these installed and configured:

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) — and configured with `aws configure`
- Your IAM user must have **Administrator Access** (or permissions for CloudFormation, IAM, Lambda, Location, IoT, Cognito, DynamoDB, SNS, SQS, S3)

Verify your AWS identity:

```powershell
aws sts get-caller-identity
```

---

## Deployment Steps

### Step 1 — Create an S3 Bucket for artifacts

CloudFormation needs an S3 bucket to upload the Lambda source code before deploying.  
*(Pick a globally unique bucket name — it cannot already exist.)*

```powershell
aws s3 mb s3://vsmart-tracking-artifacts --region us-east-1
```

---

### Step 2 — Package the stack (uploads Lambda code to S3)

Run this from inside the `tracking-data-streaming-infrastructure` directory:

```powershell
aws cloudformation package `
  --template-file template.yml `
  --s3-bucket vsmart-tracking-artifacts `
  --output-template-file packaged.yml `
  --region us-east-1
```

This command compresses the Lambda folders under `lambda/` and uploads them to S3, producing a new file `packaged.yml` with S3 references.

---

### Step 3 — Deploy the stack

```powershell
aws cloudformation deploy `
  --template-file packaged.yml `
  --stack-name TrackingDATN-UnifiedStack `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides AlertEmail="tranvix.work@gmail.com" `
  --region us-east-1
```

> **Replace** `your-email@example.com` with your real email.  
> AWS will send an **SNS subscription confirmation** email — you must click the link to activate alerts.

Deployment takes **3–8 minutes**. Wait for `CREATE_COMPLETE` status.

---

### Step 4 — Retrieve the Output values

Once deployment completes, fetch the generated resource IDs:

```powershell
aws cloudformation describe-stacks `
  --stack-name TrackingDATN-UnifiedStack `
  --query "Stacks[0].Outputs" `
  --output table
```

You will see a table like this:

| OutputKey | OutputValue |
|---|---|
| CognitoUserPoolId | `us-east-1_xxxxxxxxx` |
| CognitoClientId | `xxxxxxxxxxxxxxxxx` |
| DynamoTableName | `TrackingDATN-Devices` |
| DeviceStateTableName | `TrackingDATN-DeviceState` |
| MapName | `TrackingDATN-Map` |
| RealtimeAppEventsTopicTemplate | `users/{userId}/events` |
| RealtimeDebugDeviceEventsTopicTemplate | `devices/{deviceId}/events` |
| RealtimeRecommendedClientIdPrefix | `TrackingDATN-mobile-` |
| RealtimeWebhookSecretArn | `arn:aws:secretsmanager:...` |

For Phase 0 realtime preparation, also retrieve the AWS IoT data endpoint manually:

```powershell
aws iot describe-endpoint `
  --endpoint-type iot:Data-ATS `
  --query endpointAddress `
  --output text
```

Save this value for later phases when the mobile app starts connecting via MQTT over WebSocket.

---

### Step 4.5 — Create Map API Key manually *(required)*

> **Why manually?** The `geo:CreateKey` permission is often restricted in IAM policies, so the Map API Key is NOT created by CloudFormation. You must create it yourself in the AWS Console.

**Option A — AWS Console (recommended):**

1. Go to [AWS Location Service Console](https://console.aws.amazon.com/location/home) → **API Keys** in the left sidebar
2. Click **Create API Key**
3. Fill in:
   - **Name:** `TrackingDATN-MapApiKey`
   - **Expiry:** Check **No expiration**
4. Under **Restrictions → Allow actions**, add:
   - `geo:GetMap*` (or individually: `GetMapStyleDescriptor`, `GetMapGlyphs`, `GetMapSprites`, `GetMapTile`)
5. Under **Restrictions → Allow resources**, select the map: `TrackingDATN-Map`
6. Click **Create API Key**
7. **Copy the key value** — it starts with `v1.public.eyJ...` and is only shown once!

**Option B — AWS CLI:**

```powershell
aws location create-key `
  --key-name TrackingDATN-MapApiKey `
  --restrictions AllowActions="geo:GetMapStyleDescriptor","geo:GetMapGlyphs","geo:GetMapSprites","geo:GetMapTile",AllowResources="arn:aws:geo:us-east-1:<ACCOUNT_ID>:map/TrackingDATN-Map" `
  --no-expiry `
  --region us-east-1 `
  --query "Key" --output text
```

*(Replace `<ACCOUNT_ID>` with your AWS Account ID — run `aws sts get-caller-identity --query Account --output text` to get it.)*

---

### Step 5 — Update frontend and backend configuration

#### Frontend (`tracking-data-streaming-datn`)

Create a `.env` file by copying the example:

```powershell
copy ..\tracking-data-streaming-datn\.env.example ..\tracking-data-streaming-datn\.env
```

Fill in the values from Step 4:

```env
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxx
VITE_MAP_API_KEY=v1.public.xxxxxxx
```

#### Backend (`tracking-data-streaming-backend`)

Open the `.env` file and update these fields. Retrieve the webhook value from the `RealtimeWebhookSecretArn` output with Secrets Manager; do not commit it.

```env
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxx
REALTIME_WEBHOOK_KEY=<generated secret value>
```

---

## Updating the Stack

If you change `template.yml` or the Lambda code, re-run Steps 2 & 3 to update the stack:

```powershell
# Re-package
aws cloudformation package `
  --template-file template.yml `
  --s3-bucket vsmart-tracking-artifacts `
  --output-template-file packaged.yml

# Re-deploy (CloudFormation will only update changed resources)
aws cloudformation deploy `
  --template-file packaged.yml `
  --stack-name TrackingDATN-UnifiedStack `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides AlertEmail="your-email@example.com"
```

---

## Deleting the Stack

To remove **all** resources created by this stack:

```powershell
aws cloudformation delete-stack --stack-name TrackingDATN-UnifiedStack
```

> ⚠️ This will permanently delete DynamoDB data, Location resources, IoT rules, and all associated IAM roles.

---

## Stack Parameters

| Parameter | Default | Description |
|---|---|---|
| `ProjectName` | `TrackingDATN` | Prefix for all resource names |
| `Environment` | `dev` | Environment tag (`dev` / `staging` / `prod`) |
| `AlertEmail` | `admin@example.com` | Email for anti-theft SNS alerts |
| `MapStyle` | `VectorEsriNavigation` | AWS Location map style |

---

## Troubleshooting

| Error | Solution |
|---|---|
| `ROLLBACK_COMPLETE` on first deploy | Check the Events tab in CloudFormation console for the specific resource that failed |
| `CAPABILITY_NAMED_IAM` error | Add `--capabilities CAPABILITY_NAMED_IAM` to your deploy command |
| Lambda packaging fails | Make sure `lambda/iot-message-processor/index.py` exists |
| Geofence API returns `403` | Verify the backend IAM role can access the geofence collection and that the JWT owner matches `ownerUserId` |
| SNS subscription not active | Check your email inbox and click the "Confirm subscription" link from AWS |
