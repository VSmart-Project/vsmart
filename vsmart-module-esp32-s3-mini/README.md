# Vsmart ESP32-S3 SuperMini Module Carrier

Carrier PCB 2 lớp mới cho các module cắm/rút:

- ESP32-S3 SuperMini 18 chân, kích thước danh nghĩa khoảng 18.2 × 23.2 mm
- MPU6050 GY-521
- **GPS GY-GPSU3-NEO (NEO-7M, 4 chân VCC/RX/TX/GND, ăng-ten gốm rời qua cáp u.FL)**
- A7680C TDM2309 / TDM-4G-V1

PCB có kích thước **74 × 62 mm**, bo góc 3 mm và bốn lỗ bắt vít M3. Mạch hạ áp được đặt bên ngoài; carrier chỉ nhận 5 V và 4 V đã ổn áp qua hai đầu hàn dây.

## Module GPS GY-GPSU3-NEO

Thay cho Keyestudio KS0319 (footprint 55 × 27 mm), module này chỉ chiếm khoảng
**25 × 25 mm** nên PCB giảm được từ 96 × 76 mm xuống 74 × 62 mm (−34 % diện tích).

- Header 1×4 bước 2.54 mm, thứ tự **VCC – RX – TX – GND** đúng như in trên module.
- Ăng-ten gốm nằm rời, nối bằng cáp u.FL, nên module GPS **không cần đặt sát mép
  PCB**; chỉ cần đặt tấm ăng-ten hướng lên trời khi lắp vỏ.
- Không còn chân PPS: net `GPS_PPS` đã bị xoá khỏi schematic và **GPIO11 của
  ESP32-S3 giờ để trống** (đã đánh dấu no-connect).
- Footprint `VSmart_Modules:GY-GPSU3-NEO7M` chỉ ràng buộc bằng 4 lỗ header;
  đường bao 25 × 25 mm là **kích thước danh nghĩa**, chưa có lỗ bắt vít cho module.
  Bắt buộc in PDF 1:1 và đặt module thật lên để đối chiếu trước khi đặt PCB.

## Lắp ESP32-S3 SuperMini

Footprint U1 dùng hai hàng 9 chân, bước chân 2.54 mm, khoảng cách hai hàng 15.24 mm. Lỗ khoan 1.0 mm, pad 1.8 mm phù hợp với pin header/socket header 2.54 mm thông dụng.

Nên hàn hai socket cái 1×9 lên carrier để có thể cắm/rút ESP32-S3. Đối chiếu đúng đầu USB, pin TX/RX và dấu pad vuông trước khi cấp nguồn. Vùng giữa hai hàng chân ở đầu anten được cấm trace, via và copper pour trên cả hai lớp.

## Đầu nối nguồn

| Đầu nối | Pad vuông số 1 | Pad tròn số 2 | Chức năng |
|---|---|---|---|
| J1 | +5V | GND | Cấp cho ESP32-S3, GPS, MPU6050 và C3 |
| J2 | +4V_SIM | GND | Cấp riêng cho A7680C và C1 |

J1/J2 có lỗ khoan 1.4 mm, pad ngoài 2.7 mm, bước 5.4 mm; có thể hàn trực tiếp dây khoảng 0.5–1.0 mm². Nhánh 4V_SIM cần dây ngắn, tiết diện đủ lớn.

## Yêu cầu nguồn

- Chỉnh LM2596 cấp J1 chính xác 5.0 V trước khi kết nối.
- Chỉnh bộ hạ áp cấp J2 khoảng 4.0 V; tuyệt đối không đưa 5 V hoặc 12 V vào A7680C.
- Nguồn 4V_SIM phải chịu được dòng xung lớn của modem và không sụt áp khi phát sóng.
- C1 1000 µF low-ESR lọc nhánh 4V_SIM; C3 470 µF lọc nhánh 5 V.
- **Không có tụ gốm 100 nF trên carrier.** Module A7680C TDM2309 đã có tụ lọc
  cao tần riêng ngay tại chân nguồn của con chip trên board module. Nếu khi chạy
  thực tế modem bị reset lúc phát sóng, hàn thêm một tụ gốm 104 (100 nF, chân cắm)
  **trực tiếp lên hai chân VCC–GND của header module A7680C** — đó mới là vị trí
  có tác dụng, và hàn ở đó dễ hơn hàn trên carrier.
- Hai bộ hạ áp và carrier phải dùng chung GND.
- Tránh cấp đồng thời 5 V từ J1 và USB-C của ESP32-S3 nếu chưa xác minh mạch bảo vệ/chống cấp ngược của module đang dùng.

## Ánh xạ tín hiệu ESP32-S3

| Module | Chân module | Net | Chân ESP32-S3 SuperMini |
|---|---|---|---|
| MPU6050 | SDA | I2C_SDA | GPIO8 |
| MPU6050 | SCL | I2C_SCL | GPIO9 |
| MPU6050 | INT | MPU_INT | GPIO10 |
| MPU6050 | AD0 | GND | GND |
| GPS | TXD | GPS_RX | RX |
| GPS | RXD | GPS_TX | TX |
| GPS | PPS | GPS_PPS | GPIO11 |
| A7680C | TXD | SIM_RX | GPIO6 |
| A7680C | RXD | SIM_TX | GPIO7 |
| A7680C | RST | SIM_RST | GPIO12 |
| A7680C | RI | SIM_RI | GPIO13 |
| A7680C | DTR | SIM_DTR | GPIO11 |

GPIO1, GPIO2, GPIO3, GPIO4 và GPIO5 được đánh dấu không sử dụng trong schematic. (SIM_DTR đã chuyển từ GPIO4 sang GPIO11 để đường đi trên PCB không phải cắt qua vùng cấm ăng-ten ESP32-S3.) UART GPS dùng cặp TX/RX được in trực tiếp trên module; UART modem dùng GPIO6/GPIO7.

## Luật PCB

- +4V_SIM: trace 2.0 mm
- +5V và GND: trace 1.0 mm
- +3V3: trace 0.5 mm
- UART/I²C/tín hiệu điều khiển: trace 0.25 mm
- Ground plane F.Cu và B.Cu
- 135 via stitching GND (lưới 5 mm + via hồi dòng cạnh via tín hiệu)
- Keep-out anten ESP32-S3 trên F.Cu và B.Cu
- 4 lỗ M3, đường kính khoan 3.2 mm

## Kiểm tra cơ khí bắt buộc

Footprint GPS KS0319, MPU6050 và A7680C được dựng theo module mẫu/thư viện đã cung cấp. Các module bán trên thị trường có thể khác kích thước, vị trí header, chiều linh kiện hoặc vị trí lỗ bắt vít. Trước khi đặt PCB số lượng lớn:

1. In PDF PCB đúng tỉ lệ 1:1.
2. Đặt module thật và socket header lên bản in.
3. Kiểm tra chiều pin, khoảng cách hàng chân, đầu USB, anten và chiều cao linh kiện.
4. Đo lại điện áp 5 V và 4 V trước khi cắm module.

## Kết quả kiểm tra (bản 74 × 62 mm, GY-GPSU3)

- Schematic: **ERC 0 lỗi**, 1 cảnh báo cache thư viện của symbol ESP32-S3 tùy chỉnh.
- PCB: **DRC 0 lỗi, 0 pad chưa nối**. Còn 16 cảnh báo silkscreen/cỡ chữ của các
  footprint module tự vẽ (không ảnh hưởng mạch).
- Đã bỏ C2 (tụ gốm 0805) — xem mục Yêu cầu nguồn.
- **Đã route đầy đủ 14 net**: `GND` (đổ đồng 2 mặt), `+5V` 1.0 mm,
  `+3V3` 0.3–0.4 mm, `+4V_SIM` 2.0 mm, và 10 net tín hiệu 0.25 mm.
- 12 via nhảy lớp cho các đường buộc phải cắt nhau.
- **140 via khâu GND** (lưới 5 mm + 6 via hồi dòng đặt cạnh via tín hiệu) — tổng 145 via.

### Ghi chú từ design review (kicad-happy v2.2.0)

- Mặt phẳng GND liền một khối duy nhất (`connectivity_graph`: GND = 1 island, 0 gap).
- EMC risk score **70/100** (FCC Part 15 Class B và CISPR 32 Class B cho cùng
  kết quả). `RP-001` đường hồi dòng: đã xử lý 3/4 net, còn `MPU_INT` (2 via)
  không đặt được via GND kề vì khe đồng quá hẹp.
- Cảnh báo `GP-001` còn lại: 9 net có độ phủ mặt phẳng tham chiếu 55–95 %
  (thấp nhất `SIM_TX` 55 %). Đây là hệ quả của việc dồn nhiều làn tín hiệu
  song song xuống mặt dưới. **Không xử lý** vì tất cả đều là tín hiệu chậm
  (UART/I²C, analyzer đánh dấu `is_high_speed_or_clock: false`); rủi ro thực
  tế thấp. Nếu sau này chạy UART modem ở baud rất cao thì nên đi lại dây.
- **Chưa xác minh: mức logic UART của module A7680C TDM2309.** Dòng SIMCom
  A76xx thường dùng UART 1.8 V. Nếu module không có mạch dịch mức on-board,
  chân TX 3.3 V của ESP32-S3 có thể làm hỏng modem. Phải tra tài liệu module
  trước khi cấp nguồn lần đầu.

### Chiến lược đi dây

- **F.Cu**: nguồn `+5V`, `+4V_SIM`, `+3V3`, cùng `I2C_SDA`/`I2C_SCL` chạy dọc
  mép trái xuống MPU6050.
- **B.Cu**: `GPS_TX`/`GPS_RX` sang GPS, và 5 net `SIM_*` sang A7680C, chạy theo
  các làn ngang song song ở dải y = 57–73 mm.
- Các đường cắt qua hàng chân ESP32-S3 đều luồn đúng khe giữa hai pad
  (bước 2.54 mm, khe hở 0.74 mm), trace 0.25 mm, clearance 0.2 mm.
- Không có trace/via nào nằm trong vùng cấm ăng-ten ESP32-S3.

### Lỗi đã sửa trong bước này

- Bốn pad của ESP32-S3 bị gán sai net khi import netlist: GPIO1 và GPIO2 bị nối
  vào `+3V3` (chập GPIO với nguồn 3.3 V), GPIO5 và GPIO11 còn dính `GPS_PPS`,
  trong khi chân `3V3_OUT` lại **không** có net. Đã gán lại đúng toàn bộ 18 pad.
- Xoá 6 đoạn trace trùng lặp/đầu hở còn sót từ lần import file autoroute.
- Toàn bộ trace cũ rộng 0.2 mm (kể cả `+4V_SIM` cấp cho modem 4G) — đã đi lại
  nguồn theo đúng bề rộng quy định.
- Phục hồi hai mặt đổ đồng GND (bản 86 × 70 mm trước đó đã mất sạch ground plane).
- `MountingHole:MountingHole_3.2mm` không tồn tại trong thư viện KiCad
  (tên đúng là `MountingHole_3.2mm_M3`) — đã thay, 4 lỗ M3 nay resolve được.
- Chữ `ANT KEEP-OUT` ở mặt dưới chưa mirror (in ngược) — đã sửa; các chữ silk
  nhỏ hơn 0.8 mm đã tăng lên 0.9 mm.

File chế tạo trong `manufacturing/` (Gerber + Excellon + pick-and-place + BOM,
đã nén sẵn `vsmart-module-esp32-s3-mini-fab.zip`); PDF sơ đồ và PDF PCB trong `reports/`.

## Rev B — trạng thái gia công (2026-08-30)

Đổi từ Rev A: `U4` 4.0 V → **5 V 2 A**, `U3` 5 V → **3.3 V**, `C1` 6.3 V → **16 V**,
silk thêm dòng định mức `+5V 1A` (J1) / `+5V 2A` (J2). **Rev A không dùng nữa.**

| Kiểm tra | Kết quả |
|---|---|
| DRC (`kicad-cli` 10.0.5, severity-all) | **0 vi phạm** |
| Pad chưa nối / đối chiếu schematic ↔ PCB | **0 / 0** |
| Bộ gerber (`analyze_gerbers`) | **0 phát hiện**, đủ 7/7 lớp |
| EMC risk score | 70/100 |
| Kích thước · via · lỗ | 74.1 × 62.1 mm · 146 via · 196 PTH + 5 NPTH |

Nộp xưởng: `manufacturing/vsmart-module-esp32-s3-mini-fab.zip` (10 file phẳng).

### Trước khi cấp nguồn — hai việc phải tự đo

1. **Mức logic UART của A7680C.** Cấp nguồn module rời, đo chân TXD lúc rảnh.
   ~3.3 V → nối thẳng. ~1.8 V → chừa trống RXD/TXD, đấu qua module dịch mức.
2. **LDO 3.3 V trên SuperMini.** GPS nay ăn từ chân 3V3 của U1; tổng đỉnh ~420 mA
   nếu bật WiFi. ME6211 (500 mA) đủ, bản clone 200 mA thì không.

### Trước khi đặt board

In `manufacturing/CHECK-1to1-footprints.pdf` ở **100 %**, đặt U1–U4 thật lên giấy.
Footprint U3 và U4 vẽ theo kích thước danh nghĩa, chưa đo trên hàng thật.

### Cấp nguồn

`J1` = 5 V/1 A (ESP32), `J2` = 5 V/2.5 A (SIM). **Cấp riêng.** Một nguồn ≥ 3 A thì
kéo hai cặp dây riêng, đấu hình sao tại nguồn. Đừng câu J2 ăn theo cọc của J1.

Báo cáo review đầy đủ: https://claude.ai/code/artifact/87cbf2e2-2273-45b7-b7cd-e9a7c37d8165
