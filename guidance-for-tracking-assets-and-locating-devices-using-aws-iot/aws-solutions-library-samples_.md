## 1. Mục tiêu \& output của dự án

- Mục tiêu: streaming dữ liệu vị trí (GPS) từ các asset/device IoT lên AWS, ghi nhận vào Amazon Location Tracker, sinh sự kiện geofencing, hiển thị real‑time trên bản đồ web, và (tuỳ chọn) lưu toàn bộ vị trí vào S3 cho phân tích sau này.
- Output chính khi triển khai xong:
    - Ứng dụng web (React) chạy ở `localhost:8080` hiển thị bản đồ Amazon Location và các phương tiện demo + thiết bị của bạn (VD `Vehicle-1`).
    - Các stack CloudFormation:
        - `TrackingAndGeofencingSample` (visualization + Amazon Location + Cognito + Kinesis stream),
        - `TrackingAndGeofencingIoTResources` (IoT Rule + Lambda để đẩy sang Location),
        - `TrackingAndGeofencingAnalyticsResources` (S3 + Firehose + EventBridge cho analytics – optional).
    - Một S3 bucket chứa file log các bản ghi vị trí nếu bạn bật analytics stack.

***

## 2. Kiến trúc tổng thể \& luồng dữ liệu

Luồng dữ liệu chính của giải pháp như sau:

1. Thiết bị IoT gửi message MQTT lên AWS IoT Core topic `location` với payload JSON gồm `deviceid`, `timestamp`, `location.lat/long`, `accuracy`, v.v.
2. AWS IoT Core Topic Rule `UpdateLocationTrackerFromMQTT` (`SELECT * FROM 'location'`) bắt mọi message topic `location` và invoke Lambda `TrackingAndGeofencingSampleIoTLambdaFunction`.
3. Lambda parse payload, chuyển thành định dạng API của Amazon Location Service (`batch_update_device_position`) và cập nhật vào Tracker (mặc định `SampleTracker`).
4. Amazon Location Service phát sinh sự kiện “Location Device Position Event” lên Amazon EventBridge với `source: aws.geo` và `detail.TrackerName = SampleTracker`.
5. EventBridge Rule `TrackingAndGeofencingSampleAnalyticsEventBridgeRule` filter theo TrackerName, gửi sự kiện sang Kinesis Data Firehose Delivery Stream.
6. Firehose ghi dữ liệu vị trí dạng raw JSON xuống S3 bucket được mã hoá SSE AES256 với policy quyền đầy đủ cho Firehose.
7. Web app (React) sử dụng Amazon Location Map + Tracker, truy cập bằng Cognito Identity Pools (read‑only / write‑only) để đọc vị trí từ tracker và hiển thị trên bản đồ, đồng thời có thể ghi vị trí demo vào tracker.

Kết quả: bạn có bản đồ real‑time, pipeline sự kiện ra S3, và có thể mở rộng sang Athena, QuickSight, SNS notification,… như README gợi ý.

***

## 3. Thành phần \& service chi tiết

### 3.1 Web visualization \& Amazon Location

- Repo sử dụng submodule `amazon-location-samples-react` (thư mục `amazon-location-samples-react/tracking-data-streaming`) làm frontend React hiển thị map và tracker.
- Script `deploy_cloudformation.sh` bên trong submodule này tạo:
    - Amazon Location **Tracker** và **Map** resource,
    - Cấu hình **Amazon Cognito** cho 2 Identity Pool: read‑only và write‑only,
    - Một **Kinesis stream** để nhận location updates phục vụ app.
- File `configuration.js` (trong `tracking-data-streaming/src`) chứa: `READ_ONLY_IDENTITY_POOL_ID`, `WRITE_ONLY_IDENTITY_POOL_ID`, `REGION`; bạn lấy các giá trị này từ Outputs của stack `TrackingAndGeofencingSample` và sửa vào file để web app gọi đúng resource.

Chức năng chi tiết: khi chạy `npm start`, app mở local web server, tải map tiles từ Amazon Location Map, và đọc position từ tracker để hiển thị icon phương tiện di chuyển.

### 3.2 IoT Core Rule \& Lambda (cf/iotResources.yml)

CloudFormation `cf/iotResources.yml` triển khai tầng ingest từ MQTT sang Amazon Location:

- **IAM Role cho Lambda** `TrackingAndGeofencingSampleIoTLambdaFunctionRole`:
    - Trust policy cho `lambda.amazonaws.com`,
    - Managed policy `AWSLambdaBasicExecutionRole`,
    - Inline policy cho phép `geo:BatchUpdateDevicePosition` với tracker ARN `arn:aws:geo:${Region}:${AccountId}:tracker/${TrackerName}` (mặc định `SampleTracker`).
- **Lambda Function** `TrackingAndGeofencingSampleIoTLambdaFunction`:
    - Runtime `python3.12`, handler `index.lambda_handler`, env var `TrackerName`.
    - Source code inline:
        - Đọc `event["payload"]`, xây `update` gồm:
            - `DeviceId` = `payload.deviceid`,
            - `SampleTime` = ISO8601 convert từ `payload.timestamp` (epoch seconds),
            - `Position` = `[long, lat]` (chú ý đảo trật tự so với input lat/long).
            - Nếu có `accuracy` thì gán vào `Accuracy`, nếu có `positionProperties` thì gán `PositionProperties`.
        - Gọi `client.batch_update_device_position(TrackerName=TRACKER_NAME, Updates=[update])` tới Amazon Location Service.
- **IoT Topic Rule** `UpdateLocationTrackerFromMQTT` (type `AWS::IoT::TopicRule`):
    - `Sql: "SELECT * FROM 'location'"`,
    - Action: invoke Lambda function phía trên.
- **Lambda Permission** cho phép `iot.amazonaws.com` invoke function.

Như vậy, bất kỳ MQTT message nào publish lên topic `location` đúng schema mẫu sẽ tự động được chuyển thành vị trí trên tracker Amazon Location.

### 3.3 Analytics stack: S3 + Firehose + EventBridge (cf/analyticsResources.yml)

CloudFormation `cf/analyticsResources.yml` là phần tuỳ chọn cho analytics:

- **S3 Bucket** `TrackingAndGeofencingSampleAnalyticsBucket`:
    - Bật SSE với `AES256` thông qua `BucketEncryption.ServerSideEncryptionConfiguration`.
- **IAM Role cho Firehose** `TrackingAndGeofencingSampleAnalyticsDeliveryStreamRole`:
    - Trust policy cho `firehose.amazonaws.com` với điều kiện `sts:ExternalId = AccountId`,
    - Policy cho phép các action `s3:AbortMultipartUpload`, `GetBucketLocation`, `GetObject`, `ListBucket`, `ListBucketMultipartUploads`, `PutObject` trên bucket và prefix `/*`.
- **Kinesis Data Firehose Delivery Stream** `TrackingAndGeofencingSampleAnalyticsDeliveryStream`:
    - `DeliveryStreamType: DirectPut`, encrypt bằng `AWS_OWNED_CMK`,
    - Destination S3 bucket, `BufferingHints` 60 giây hoặc 1 MB, log ra CloudWatch (`/aws/kinesisfirehose/TrackingAndGeofencingSampleAnalyticsDeliveryStream`, stream `S3Delivery`).
- **IAM Role cho EventBridge** `TrackingAndGeofencingSampleAnalyticsEventBridgeRole`:
    - Policy cho phép `firehose:PutRecord` và `PutRecords` lên Firehose ARN.
- **EventBridge Rule** `TrackingAndGeofencingSampleAnalyticsEventBridgeRule`:
    - `source: ["aws.geo"]`, `detail-type: ["Location Device Position Event"]`,
    - `detail.TrackerName` = `TrackerName` (mặc định `SampleTracker`),
    - Target: Firehose delivery stream ở trên, dùng RoleEventBridge.

Kết quả: mọi event vị trí mới từ Amazon Location Service tracker sẽ chảy qua EventBridge → Firehose → S3, tạo file log đều đặn mỗi 60s hoặc khi đủ 1MB.

### 3.4 Các service AWS khác trong giải pháp

README liệt kê thêm các service cần quyền truy cập:

- **Amazon Location Service**: tracker, geofencing, map tiles, position reads/writes và sinh events; là lõi cho phần “location intelligence”.
- **AWS IoT Core**: MQTT broker, topic rule engine, MQTT test client để publish sample payload.
- **AWS Lambda**: glue code giữa IoT và Location Service.
- **Amazon EventBridge**: nhận “Location Device Position Event” và route tới Firehose.
- **Amazon Kinesis Data Firehose**: buffer và ghi stream sự kiện vị trí xuống S3.
- **Amazon S3**: lưu trữ lịch sử vị trí dạng file để sau này phân tích với Athena, QuickSight,…
- **Amazon Cognito**: identity pools read‑only/write‑only cho frontend React, control ai được đọc/gửi vị trí qua Location Service/Kinesis.
- **Amazon SNS** (gợi ý, chưa triển khai sẵn): để gửi thông báo geofence enter/exit nếu bạn mở rộng giải pháp.

***

## 4. Các bước triển khai chi tiết

### 4.1 Chuẩn bị môi trường

- Khuyến nghị dùng **Amazon Linux 2023 trên AWS Cloud9** làm môi trường phát triển để chạy web server cục bộ, CLI, Node.js.
- Cần cài và cấu hình:
    - **AWS CLI** (đã có credentials/role đúng account + region),
    - **Node.js** để `npm install` và `npm start` web app.
- Region phải nằm trong danh sách hỗ trợ Amazon Location \& guidance: us-east-1/2, us-west-2, ap-south-1, ap-southeast-1/2, ap-northeast-1, ca-central-1, eu‑central‑1, eu‑west‑1/2, eu‑north‑1, sa‑east‑1, us‑gov‑west‑1.


### 4.2 Bước 1 – Clone repo

Trong terminal Cloud9 hoặc môi trường dev của bạn:

```bash
git clone https://github.com/aws-solutions-library-samples/guidance-for-tracking-assets-and-locating-devices-using-aws-iot --recurse-submodules
cd guidance-for-tracking-assets-and-locating-devices-using-aws-iot
```

README gốc ghi nhầm tên repo cũ, nhưng repo bạn đưa là bản mới với cùng nội dung guidance.

### 4.3 Bước 2 – Cài đặt \& deploy visualization

1. `cd amazon-location-samples-react/tracking-data-streaming` rồi chạy `npm install` để cài dependency cho frontend.
2. Chạy `chmod +x deploy_cloudformation.sh` để script có quyền thực thi.
3. Set region: `export AWS_REGION=<your-region>` (VD `ap-southeast-1` nếu bạn dùng Singapore).
4. Chạy `./deploy_cloudformation.sh`; script này sẽ:
    - Tạo Amazon Location Map + Tracker + Cognito + Kinesis stream cần cho app.
    - Sinh CloudFormation stack `TrackingAndGeofencingSample` (tên chính xác xem trong console).
5. Mở AWS CloudFormation Console, tìm stack `TrackingAndGeofencingSample`, tab **Outputs**, copy:
    - `TrackingAndGeofencingSampleReadOnlyCognitoPoolId`
    - `TrackingAndGeofencingSampleWriteOnlyCognitoPoolId`.
6. Mở file `amazon-location-samples-react/tracking-data-streaming/src/configuration.js`, gán giá trị:
    - `READ_ONLY_IDENTITY_POOL_ID`,
    - `WRITE_ONLY_IDENTITY_POOL_ID`,
    - `REGION` = region bạn dùng.
7. Lưu file, chạy `npm start` để chạy dev server ở port 8080.
8. Truy cập `http://localhost:8080` hoặc dùng **Preview running application** (nếu dùng Cloud9) để kiểm tra map đã load được chưa.

### 4.4 Bước 3 – Deploy IoT Core + Lambda

1. `cd cf` trong root project.
2. Chạy lệnh:
```bash
aws cloudformation create-stack \
  --stack-name TrackingAndGeofencingIoTResources \
  --template-body file://iotResources.yml \
  --capabilities CAPABILITY_IAM
```

3. Đợi stack `TrackingAndGeofencingIoTResources` ở trạng thái `CREATE_COMPLETE` (xem trong console hoặc dùng `aws cloudformation describe-stacks ...`).

Stack này sẽ tạo role, Lambda, IoT Rule như đã mô tả ở trên để nhận message từ topic `location` và cập nhật vào Location tracker.

### 4.5 Bước 4 – (Tuỳ chọn) Deploy analytics stack

Nếu bạn muốn lưu log vị trí vào S3:

```bash
aws cloudformation create-stack \
  --stack-name TrackingAndGeofencingAnalyticsResources \
  --template-body file://analyticsResources.yml \
  --capabilities CAPABILITY_IAM
```

- Chờ stack `TrackingAndGeofencingAnalyticsResources` `CREATE_COMPLETE`.
- Sau đó, mỗi event “Location Device Position Event” sẽ được EventBridge → Firehose → S3.


### 4.6 Bước 5 – Gửi message MQTT mẫu

1. Vào AWS Console → **AWS IoT Core** → **MQTT test client**.
2. Tab **Publish to a topic**:
    - Topic name: `location`
    - Message payload (ví dụ):
```json
{
  "payload": {
    "deviceid": "Vehicle-1",
    "timestamp": 1713812103,
    "location": { "lat": 47.54372304079714, "long": -122.32275832917712 },
    "accuracy": { "Horizontal": 20.5 }
  }
}
```

3. Publish message; IoT Rule sẽ chuyển message sang Lambda → Amazon Location.

### 4.7 Bước 6 – Kiểm tra dữ liệu

- **Kiểm tra trên Amazon Location**:

```bash
aws location get-device-position \
  --tracker-name SampleTracker \
  --device-id Vehicle-1
```

Bạn sẽ thấy `Position` `[long, lat]`, `SampleTime`, `ReceivedTime`, `Accuracy` giống ví dụ trong README.

- **Kiểm tra trên web map**:
    - Trên ứng dụng, bấm **Run Demo**, bạn sẽ thấy 2 vehicle demo + `Vehicle-1` di chuyển trên bản đồ.
- **Kiểm tra S3 (nếu bật analytics)**:
    - Vào Amazon S3 Console, mở bucket do stack analytics tạo, bạn sẽ thấy các file JSON/ndjson cho từng batch location updates.

***

## 5. Chi phí 1 ngày / 1 tuần / 1 tháng

README cung cấp bảng chi phí mẫu cho 1 triệu cập nhật vị trí/tháng (US East N. Virginia, April 2024): tổng ~224,05 USD/tháng. Các thành phần chính:


| Dịch vụ | Khối lượng mẫu | Chi phí/tháng (USD) |
| :-- | :-- | :-- |
| Amazon Location – Tracker Updates | 1.000.000 update | 42,50 |
| Amazon Location – Geofence Evaluations | 1.000.000 eval | 122,50 |
| Amazon Location – Positions Read | 1.000.000 read | 50,00 |
| Amazon Location – Map Tiles | 10.000 tiles | 0,40 |
| AWS IoT Core – Messages | 1.000.000 msg | 1,00 |
| AWS IoT Core – Rules | 1.000.000 trigger | 0,30 |
| AWS Lambda | 1.000.000 request | 0,21 |
| Amazon EventBridge | 2.000.000 event | 2,00 |
| Amazon S3 – PUTs | 1.000.000 PUT | 5,00 |
| Amazon Data Firehose – Direct Puts | 1.000.000 put | 0,14 |

Tổng các dòng trên đúng bằng 224,05 USD/tháng ở mức 1M updates. Từ đó ta có thể xấp xỉ:

- **Theo ngày**:
    - 224,05 / 30 ≈ **7,47 USD/ngày** cho ~33.333 cập nhật vị trí/ngày.
- **Theo tuần**:
    - 224,05 / 4,2857 ≈ **52,3 USD/tuần** (tương ứng ~250.000 update/tuần).
- **Theo tháng**:
    - README đã nêu rõ: **~224,05 USD/tháng** cho 1 triệu updates với cấu hình default.

Lưu ý:

- Chi phí chủ yếu nằm ở write/read/geofence của **Amazon Location Service**, nên nếu bạn giảm tần suất update, dùng position filtering, hoặc hạn chế geofence evaluation thì sẽ giảm đáng kể.
- Con số trên **chưa tính** các yếu tố như lưu trữ S3 lâu dài ngoài quota mẫu, traffic web app, hay các dịch vụ bạn mở rộng thêm (Athena, QuickSight, SNS,…).

Bạn có thể scale tuyến tính theo số lượng update: ví dụ nếu chỉ đẩy 100.000 updates/tháng (~1/10), chi phí xấp xỉ cũng ~1/10 của bảng trên, tức khoảng 22–23 USD/tháng ở cùng region và pattern sử dụng.

***

## 6. Yêu cầu \& giới hạn dịch vụ

- **Service quotas**: Amazon Location Service mặc định giới hạn 50 Device Position Updates/second; nếu bạn cần cao hơn (nhiều device gửi liên tục), phải mở case tăng quota theo quy trình Service Quotas.
- **Supported regions**: chỉ các region liệt kê trong README; nếu chạy ở region khác sẽ fail do Location Service/stack không khả dụng.
- **AWS Account**: cần quyền tạo IAM Role, Lambda, IoT Rule, Location, EventBridge, Firehose, S3, Cognito, SNS (nếu dùng), v.v.

***

## 7. Mở rộng \& tuỳ biến giải pháp

README đề xuất một số hướng mở rộng mà bạn có thể triển khai thêm:

- Tùy biến kênh ingest: thay hoặc bổ sung nguồn vào từ Kinesis, Kafka,… thay vì chỉ MQTT IoT Core.
- Phân tích \& BI: dùng Amazon Athena đọc data trong S3, Visualize bằng QuickSight (báo cáo heatmap hành trình, thời gian dừng, v.v.).
- Alerting: dựng Amazon SNS + EventBridge rule geofence enter/exit để gửi SMS/email khi thiết bị ra khỏi vùng.
- Thiết bị thực: cấu hình device thực (ESP32, thiết bị GPS, xe tải, container) publish định kỳ lên topic `location` theo đúng schema để thấy moving asset ngoài demo có sẵn.

Nếu bạn cho mình biết thêm: số lượng thiết bị, tần suất gửi vị trí, region bạn định chạy (ví dụ Singapore hay Tokyo), mình có thể giúp bạn ước tính chi phí chi tiết hơn cho workload thực tế của bạn, và gợi ý tối ưu kiến trúc/cost thêm.

