# Vsmart firmware — GPS-only

Phần cứng hiện dùng: ESP32 + GPS. Firmware đọc GPS liên tục qua UART và gửi vị trí qua Wi-Fi/TLS tới AWS IoT. A7680C, MPU6050 và bộ đệm offline nằm trong `attic/`, chưa được tích hợp.

## Build và nạp

```sh
pio run -e devkitc
pio run -e s3mini
pio run -e devkitc-altpins

# Khi muốn nạp board DevKitC đang nối USB:
pio run -e devkitc -t upload -t monitor
```

Wi-Fi, endpoint, device ID và chứng chỉ dùng cấu hình hiện có trong `include/secrets.h`. Không chia sẻ file này. Cổng mặc định của DevKitC là `/dev/cu.usbserial-0001`; sửa `platformio.ini` nếu cổng thực tế khác.

| Môi trường | GPS TXD → ESP RX | GPS RXD ← ESP TX |
|---|---|---|
| devkitc | GPIO16 | GPIO17 |
| devkitc-altpins, chỉ khi đi jumper | GPIO18 | GPIO19 |
| s3mini | GPIO44 | GPIO43 |

Theo PCB carrier hiện tại, U3.1 là +3V3, U3.4 là GND. Không thay đổi bảng chân theo chân của project màn hình `ESP32_OSM_NAV`.

## Đọc và kiểm tra GPS

- Task `gps-reader` chạy trước khi kết nối mạng; UART RX buffer 4096 byte. Mạng có thể chờ kết nối mà không dừng parser.
- Task và vòng lặp chính trao đổi bằng snapshot có mutex; không chia sẻ con trỏ vào parser/string đang thay đổi.
- Chỉ dùng frame NMEA nguyên vẹn, đúng checksum. Parser GGA/RMC/GSA/GSV hỗ trợ talker 2 ký tự; TinyGPSPlus chỉ còn dùng phép tính khoảng cách tiện ích, không quyết định validity.
- Dò baud 9600, 38400, 115200, 57600, 19200, 4800; ưu tiên baud trong bảng board. Nếu 30 s không có frame đúng checksum, tự dò lại.
- Fix phải có GGA hợp lệ, tọa độ trong phạm vi, ≥4 vệ tinh, HDOP ≤5, tuổi ≤5 s. RMC invalid hoặc GSA cùng talker báo không có solution chặn tọa độ cũ ngay khi nhận được.
- GSV chỉ được công bố khi nhận đủ nhóm, tổng hợp các chòm và loại trùng vệ tinh giữa các signal band. GSA/GSV hết hạn sau 10 s. `gsvFresh=false` nghĩa là chưa có thống kê hiện tại, không phải bằng chứng anten hỏng.
- `passed`/`failed` là số frame checksum hợp lệ/lỗi định dạng hoặc checksum; `nmea` là số ký tự UART. `snr` trong health là C/N0, đơn vị dB-Hz.

Cấu hình `GPS_ECHO_NMEA=1` để in từng frame đã qua checksum thành một dòng `[nmea]`. Log lỗi vẫn được đếm trong `failed`; khi chưa đạt chất lượng, raw GGA gần nhất được in định kỳ.

## Chính sách gửi trong giai đoạn thử GPS

Mỗi 3 s (`PUBLISH_TICK_MS`), gửi **tọa độ đo hiện tại** nếu đạt chất lượng, kể cả xe đang đứng yên. Không còn bộ lọc 30 m hoặc yêu cầu tốc độ tối thiểu để gửi. Không thay tọa độ mới bằng tọa độ cũ trên heartbeat. Tốc độ dưới 1.5 km/h chỉ được làm tròn về 0 để hiển thị; không ngăn cập nhật vị trí.

Topic `location`, envelope giữ tương thích Lambda:

```json
{"payload":{"deviceid":"your-device-id","timestamp":1789214400,"location":{"lat":10.8,"long":106.8},"accuracy":{"Horizontal":5.0},"positionProperties":{"speed":"9.26","heading":"90.0","status":"moving","reason":"sample"}}}
```

Chỉ có tối đa 4 `positionProperties`. HDOP dùng cùng mẫu GGA với quality gate; `accuracy.Horizontal = HDOP × 5` là ước lượng thô, không phải độ chính xác được GPS chứng nhận. Diagnostics chi tiết gửi riêng trên health.

Timestamp dùng GPS UTC cùng epoch GGA/RMC, còn mới. Nếu lệch đồng hồ hệ thống hợp lệ quá 30 s, dùng thời gian hệ thống trừ tuổi fix. Không gửi vị trí với timestamp 0. Nếu NTP chưa hoạt động nhưng GPS đã có fix/ngày giờ hợp lệ, Cloud có thể khởi tạo đồng hồ từ GPS để thực hiện TLS; không tắt kiểm tra chứng chỉ.

Khi mất Wi-Fi, GPS vẫn đọc; mạng thử lại có backoff 15 s sau mỗi lần thất bại, không reboot chỉ vì mất mạng. Chưa có hàng đợi offline: các mẫu không gửi được không được phát lại sau này. `sent` chỉ xác nhận MQTT client đã ghi bản tin, không xác nhận Location/Lambda đã lưu thành công.

## Health và lệnh

`devices/<deviceid>/status` mỗi 30 s, có `gps.valid`, `ageMs`, `silent`, `gsvFresh`, checksum counters và `lastKnown` kèm `ageS`. Vị trí last-known là fix chất lượng gần nhất, độc lập với lần publish, không được đẩy vào tracker như một phép đo mới.

Lệnh chỉ trên `devices/<deviceid>/cmd`:

```json
{"cmd":"ping"}
{"cmd":"reboot"}
```

Ping có fix tốt thì trả vị trí mới; không có fix thì trả health. Không còn subscribe topic lệnh chung `esp32/sub`. `{"reboot":false}`, chuỗi chứa chữ reboot hoặc JSON sai không thực hiện lệnh.

## Source cloud đi kèm — cần triển khai riêng

`../vsmart-infrastructure/template.yml` thêm rule health tới Lambda hiện có, và đổi tracker sang `TimeBased` để đánh giá các fix dịch chuyển ngắn; dịch vụ lưu lịch sử tối đa một điểm mỗi 30 s. Health cập nhật `lastSeenAtMs`/online và `gpsHealth` riêng, không ghi đè position/sampleTime. Owner lấy từ metadata đăng ký thiết bị, không lấy từ body health. Body device ID phải khớp topic.

Lambda cũng giới hạn thuộc tính Location theo allowlist để vẫn nhận được firmware cũ gửi quá nhiều diagnostics, và kiểm tra timestamp/tọa độ. Các thay đổi này **chưa có hiệu lực trên AWS cho đến khi package/deploy stack**. Bản firmware mới giới hạn payload ngay ở nguồn nên sửa lỗi 15 thuộc tính không phụ thuộc việc deploy Lambda.

## Kiểm thử

```sh
sh test/host/run.sh
python3 -m unittest discover -s ../vsmart-infrastructure/tests -v
pio run -e devkitc -e s3mini -e devkitc-altpins
```

Host tests chạy parser và Telemetry thật với UART/MQTT/đồng hồ giả, bao phủ no-fix, stale fix, checksum, nhiều chòm vệ tinh, signal trùng, frame thiếu/hỏng, autobaud, timestamp, ping và schema lệnh. Test Lambda dùng mock AWS, không gọi tài khoản thật. Test host không thay thế thử task FreeRTOS/UART/TLS trên board.

Nghiệm thu phần cứng: nạp đúng board, để anten ngoài trời, quan sát `quality=1` và `MQTT wrote`; ngắt Wi-Fi rồi nối lại, kiểm tra GPS vẫn cập nhật; che tín hiệu GPS, kiểm tra chỉ health còn được gửi; đối chiếu vị trí trên dashboard sau khi deploy source cloud.
