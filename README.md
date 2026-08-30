# Vsmart — hệ thống theo dõi và chống trộm phương tiện IoT

Vsmart là dự án nghiên cứu khoa học/đồ án tốt nghiệp về định vị GPS thời gian thực, geofencing và cảnh báo chống trộm trên kiến trúc AWS serverless.

## Thành phần chính

- `vsmart-infrastructure/`: AWS SAM, Lambda và tài nguyên cloud.
- `vsmart-backend/`: Node.js/Express, REST API và Socket.io.
- `vsmart-web/`: web dashboard React/Vite.
- `vsmart-mobile/`: ứng dụng di động Expo/React Native.
- `vsmart-firmware/`: firmware ESP32, GPS và MQTT AWS IoT.
- `vsmart-module-esp32-s3-mini/`: thiết kế PCB carrier Rev B, tài liệu và bộ gia công.
- `vsmart-osrm/`: dịch vụ map-matching cục bộ phục vụ demo.
- `tools/`: công cụ hỗ trợ thiết kế KiCad được dùng trong workspace.

## Chạy local

Từ thư mục gốc, xem hướng dẫn chi tiết tại [README hệ thống](README.md) trong bản gốc trước khi chạy các thành phần. Script `start-system.sh` và `stop-system.sh` hỗ trợ khởi động/dừng backend và web dashboard.

## An toàn

Repository không chứa khóa riêng, certificate thiết bị, tệp `.env`, dependency, build artifact, dữ liệu OSRM hay snapshot sinh tự động. Hãy dùng các tệp `*.example.*` để cấu hình môi trường cục bộ.
