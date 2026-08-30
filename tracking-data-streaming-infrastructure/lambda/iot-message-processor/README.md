# Lambda Function: IoT Message Processor

Lambda function xử lý MQTT messages từ AWS IoT Core và cập nhật vị trí thiết bị vào Amazon Location Service.

## 📋 Mô Tả

Function này nhận messages từ IoT Core topic `location`, validate dữ liệu, và gọi API `BatchUpdateDevicePosition` của Amazon Location Service để cập nhật vị trí thiết bị.

## 🏗️ Kiến Trúc

```
IoT Device → MQTT Topic 'location' → IoT Rule → Lambda Function → Location Tracker
```

## 📥 Input Format

### MQTT Message Payload

```json
{
  "payload": {
    "deviceid": "Vehicle-1",
    "timestamp": 1713812103,
    "location": {
      "lat": 21.028511,
      "long": 105.804817
    },
    "accuracy": {
      "Horizontal": 20.5
    },
    "positionProperties": {
      "speed": "60",
      "heading": "180",
      "status": "moving",
      "battery": "85"
    }
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `payload.deviceid` | string | Unique device identifier |
| `payload.timestamp` | integer | Unix timestamp (seconds) |
| `payload.location.lat` | float | Latitude (-90 to 90) |
| `payload.location.long` | float | Longitude (-180 to 180) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `payload.accuracy` | object | Position accuracy |
| `payload.accuracy.Horizontal` | float | Horizontal accuracy in meters |
| `payload.positionProperties` | object | Custom properties (key-value pairs) |

## 📤 Output

### Success Response

```json
{
  "statusCode": 200,
  "body": {
    "message": "Position updated successfully",
    "deviceId": "Vehicle-1",
    "response": {
      "Errors": []
    }
  }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "body": {
    "error": "Validation error",
    "message": "Missing required field: deviceid"
  }
}
```

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TRACKER_NAME` | Amazon Location Tracker name | `TrackingDATN-Tracker` |

## 📦 Dependencies

```
boto3>=1.34.0
botocore>=1.34.0
```

## 🚀 Deployment

### Option 1: CloudFormation (Inline Code)

Code được nhúng trực tiếp trong CloudFormation template `2-iot-resources.yml`.

```bash
aws cloudformation create-stack \
  --stack-name TrackingDATN-IoT \
  --template-body file://cloudformation/2-iot-resources.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

### Option 2: Upload to S3

1. **Package function:**
   ```bash
   cd lambda/iot-message-processor
   pip install -r requirements.txt -t .
   zip -r function.zip .
   ```

2. **Upload to S3:**
   ```bash
   aws s3 cp function.zip s3://my-bucket/lambda/iot-processor.zip
   ```

3. **Deploy with CloudFormation:**
   ```bash
   aws cloudformation create-stack \
     --stack-name TrackingDATN-IoT \
     --template-body file://cloudformation/2-iot-resources.yml \
     --parameters \
       ParameterKey=LambdaCodeBucket,ParameterValue=my-bucket \
       ParameterKey=LambdaCodeKey,ParameterValue=lambda/iot-processor.zip \
     --capabilities CAPABILITY_NAMED_IAM
   ```

### Option 3: AWS CLI Direct

```bash
# Create function
aws lambda create-function \
  --function-name IoTMessageProcessor \
  --runtime python3.12 \
  --role arn:aws:iam::ACCOUNT_ID:role/LambdaExecutionRole \
  --handler index.lambda_handler \
  --zip-file fileb://function.zip \
  --environment Variables={TRACKER_NAME=TrackingDATN-Tracker}

# Update function code
aws lambda update-function-code \
  --function-name IoTMessageProcessor \
  --zip-file fileb://function.zip
```

## 🧪 Testing

### Test với AWS CLI

```bash
# Create test event
cat > test-event.json << EOF
{
  "payload": {
    "deviceid": "TestVehicle-1",
    "timestamp": $(date +%s),
    "location": {
      "lat": 21.028511,
      "long": 105.804817
    },
    "accuracy": {
      "Horizontal": 10.0
    },
    "positionProperties": {
      "speed": "50",
      "status": "moving"
    }
  }
}
EOF

# Invoke function
aws lambda invoke \
  --function-name TrackingDATN-IoTMessageProcessor \
  --payload file://test-event.json \
  response.json

# View response
cat response.json
```

### Test qua IoT Core

```bash
# Publish to MQTT topic
aws iot-data publish \
  --topic location \
  --payload '{
    "payload": {
      "deviceid": "Vehicle-1",
      "timestamp": '$(date +%s)',
      "location": {
        "lat": 21.028511,
        "long": 105.804817
      },
      "accuracy": {
        "Horizontal": 15.0
      }
    }
  }'

# Verify position updated
aws location get-device-position \
  --tracker-name TrackingDATN-Tracker \
  --device-id Vehicle-1
```

### Test với Python

```python
import boto3
import json
from datetime import datetime

lambda_client = boto3.client('lambda')

# Test event
event = {
    "payload": {
        "deviceid": "TestVehicle-1",
        "timestamp": int(datetime.now().timestamp()),
        "location": {
            "lat": 21.028511,
            "long": 105.804817
        },
        "accuracy": {
            "Horizontal": 10.0
        }
    }
}

# Invoke function
response = lambda_client.invoke(
    FunctionName='TrackingDATN-IoTMessageProcessor',
    InvocationType='RequestResponse',
    Payload=json.dumps(event)
)

# Print result
result = json.loads(response['Payload'].read())
print(json.dumps(result, indent=2))
```

## 📊 Monitoring

### CloudWatch Logs

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/TrackingDATN-IoTMessageProcessor --follow

# Get recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/TrackingDATN-IoTMessageProcessor \
  --filter-pattern "ERROR" \
  --max-items 10
```

### CloudWatch Metrics

Key metrics to monitor:
- **Invocations**: Number of times function is invoked
- **Errors**: Number of failed invocations
- **Duration**: Execution time
- **Throttles**: Number of throttled invocations

```bash
# Get invocation count
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=TrackingDATN-IoTMessageProcessor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## 🔍 Debugging

### Common Issues

#### 1. Permission Denied

**Error:**
```
An error occurred (AccessDeniedException) when calling the BatchUpdateDevicePosition operation
```

**Solution:**
Kiểm tra IAM role có quyền `geo:BatchUpdateDevicePosition`:
```bash
aws iam get-role-policy \
  --role-name TrackingDATN-IoTLambdaRole \
  --policy-name LocationServiceAccess
```

#### 2. Invalid Position

**Error:**
```
ValidationException: Position must be within valid range
```

**Solution:**
- Latitude: -90 to 90
- Longitude: -180 to 180
- Đảm bảo thứ tự: [longitude, latitude] (GeoJSON format)

#### 3. Tracker Not Found

**Error:**
```
ResourceNotFoundException: Tracker not found
```

**Solution:**
Kiểm tra environment variable `TRACKER_NAME`:
```bash
aws lambda get-function-configuration \
  --function-name TrackingDATN-IoTMessageProcessor \
  --query 'Environment.Variables.TRACKER_NAME'
```

### Enable X-Ray Tracing

```bash
# Enable tracing
aws lambda update-function-configuration \
  --function-name TrackingDATN-IoTMessageProcessor \
  --tracing-config Mode=Active

# View traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)
```

## 🔐 Security Best Practices

1. **Least Privilege IAM Role**
   - Chỉ cấp quyền `geo:BatchUpdateDevicePosition` cho tracker cụ thể
   - Không sử dụng wildcard `*` trong Resource ARN

2. **Input Validation**
   - Validate tất cả required fields
   - Kiểm tra range của lat/long
   - Sanitize position properties

3. **Error Handling**
   - Không expose sensitive information trong error messages
   - Log errors với context đầy đủ
   - Implement retry logic cho transient errors

4. **Encryption**
   - Environment variables được mã hóa at-rest
   - Sử dụng HTTPS cho tất cả API calls

## 📈 Performance Optimization

### Current Configuration

- **Runtime**: Python 3.12
- **Memory**: 256 MB
- **Timeout**: 30 seconds
- **Concurrent Executions**: 1000 (default)

### Optimization Tips

1. **Reduce Cold Starts**
   - Sử dụng Provisioned Concurrency cho production
   - Keep dependencies minimal

2. **Batch Processing**
   - Function hỗ trợ batch updates (max 10 devices)
   - Sử dụng `batch_update_multiple_devices()` khi có nhiều updates

3. **Connection Reuse**
   - boto3 client được khởi tạo outside handler
   - Reuse connections across invocations

## 💰 Cost Estimation

### Lambda Costs

- **Requests**: $0.20 per 1M requests
- **Duration**: $0.0000166667 per GB-second

**Example (1M requests/month):**
- Requests: $0.20
- Duration (256MB, 100ms avg): ~$0.21
- **Total**: ~$0.41/month

### Location Service Costs

- **Tracker Updates**: $0.0425 per 1,000 updates
- **1M updates/month**: $42.50

## 📚 References

- [Amazon Location Service API Reference](https://docs.aws.amazon.com/location/latest/APIReference/)
- [AWS Lambda Python Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html)
- [AWS IoT Core Rules](https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html)
- [Boto3 Location Service](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/location.html)
