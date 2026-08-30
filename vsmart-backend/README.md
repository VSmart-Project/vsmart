# vsmart-backend

REST API backend cho hệ thống Vsmart - Quản lý CRUD Devices.

## Kiến trúc

```
React Frontend
      ↕ REST API (port 3001)
  Express Backend   ← vsmart-backend
      ↕
  DynamoDB: Vsmart-Devices  ← metadata device
      +
  AWS Location Service Tracker    ← vị trí thực tế
```

## Cấu trúc thư mục

```
vsmart-backend/
├── src/
│   ├── config/
│   │   ├── aws.js           # AWS SDK clients (DynamoDB, Location)
│   │   └── constants.js     # Tên bảng, tracker, enums
│   ├── controllers/
│   │   └── deviceController.js  # Business logic (CRUD handlers)
│   ├── routes/
│   │   └── devices.js       # Express routes
│   ├── services/
│   │   ├── dynamoService.js     # Thao tác DynamoDB
│   │   └── locationService.js   # AWS Location Service
│   └── middleware/
│       └── errorHandler.js  # Global error handler
├── cloudformation/
│   └── devices-table.yaml   # CloudFormation template DynamoDB
├── .env                     # Environment variables (KHÔNG commit)
├── .env.example             # Template env vars
└── index.js                 # Entry point
```

## Bước 1: Tạo DynamoDB Table

### Option A: CloudFormation (khuyến nghị)
```bash
aws cloudformation deploy \
  --template-file cloudformation/devices-table.yaml \
  --stack-name Vsmart-DevicesTable \
  --region us-east-1
```

### Option B: AWS CLI
```bash
aws dynamodb create-table \
  --table-name Vsmart-Devices \
  --attribute-definitions AttributeName=deviceId,AttributeType=S \
  --key-schema AttributeName=deviceId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Bước 2: Cấu hình credentials

Copy `.env.example` thành `.env` và điền thông tin:

```bash
cp .env.example .env
```

```env
PORT=3001
NODE_ENV=development

AWS_REGION=us-east-1
AWS_PROFILE=default             # Chỉ dùng cho local; production dùng IAM role

DYNAMODB_DEVICES_TABLE=Vsmart-Devices
LOCATION_TRACKER_NAME=Vsmart-Tracker
LOCATION_GEOFENCE_COLLECTION=Vsmart-GeofenceCollection
REALTIME_WEBHOOK_KEY=<chuỗi bí mật tối thiểu 32 ký tự từ Secrets Manager>

CORS_ORIGIN=http://localhost:5173
```

> **IAM Permissions cần thiết:**
> - `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query` (table `Vsmart-Devices` và GSI)
> - `geo:ListDevicePositions`, `geo:GetDevicePositionHistory`, `geo:BatchDeleteDevicePositionHistory` (tracker)
> - `geo:ListGeofences`, `geo:GetGeofence`, `geo:PutGeofence`, `geo:BatchDeleteGeofence` (geofence collection)

## Bước 3: Chạy server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Path                | Mô tả                                               |
|--------|---------------------|-----------------------------------------------------|
| GET    | `/health`           | Health check                                        |
| GET    | `/api/devices`      | Lấy tất cả devices (merge vị trí từ Tracker)        |
| GET    | `/api/devices/:id`  | Chi tiết một device                                 |
| POST   | `/api/devices`      | Tạo device mới                                      |
| PUT    | `/api/devices/:id`  | Cập nhật metadata (displayName, type, status, ...)  |
| DELETE | `/api/devices/:id`  | Xóa device (DynamoDB + lịch sử Tracker)             |

### POST /api/devices — Body
```json
{
  "deviceId": "Vehicle-001",
  "displayName": "Xe tải số 1",
  "type": "truck",
  "licensePlate": "51A-12345",
  "status": "active",
  "description": "Xe tải chở hàng tuyến HN-HCM"
}
```

### GET /api/devices — Response
```json
{
  "success": true,
  "total": 2,
  "data": [
    {
      "deviceId": "Vehicle-001",
      "displayName": "Xe tải số 1",
      "type": "truck",
      "licensePlate": "51A-12345",
      "status": "active",
      "description": "...",
      "createdAt": "2026-04-20T11:49:00Z",
      "updatedAt": "2026-04-20T11:49:00Z",
      "position": [105.804, 21.028],
      "sampleTime": "2026-04-20T11:55:00Z",
      "isOnline": true
    }
  ],
  "unregistered": [
    {
      "deviceId": "Unknown-Device-XYZ",
      "position": [105.8, 21.0],
      "isRegistered": false
    }
  ]
}
```
