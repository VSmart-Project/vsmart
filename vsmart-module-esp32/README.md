# Vsmart module carrier — ESP32-DevKitC (board 2)

Carrier lắp tay cho ESP32-DevKitC 38 chân + A7680C 4G + GPS NEO-7M (Keyestudio
KS0319) + MPU6050. Board 105.1 × 82.1 mm, 2 lớp, mọi module cắm header.

## Rev C — trạng thái gia công (2026-08-30)

| Kiểm tra | Kết quả |
|---|---|
| DRC (`kicad-cli` 10.0.5, severity-all) | **0 vi phạm** (trước: 75) |
| Pad chưa nối / đối chiếu schematic ↔ PCB | **0 / 0** |
| Bộ gerber (`analyze_gerbers`) | **0 phát hiện**, đủ 7/7 lớp |
| Cross-domain | **0 phát hiện** |
| EMC risk score | 71.5/100 |
| Via | 294 (285 khâu GND + 4 via hồi dòng) |
| Lỗ khoan | 365 PTH + 5 NPTH, nhỏ nhất 0.3 mm |

Nộp xưởng: `manufacturing/vsmart-module-carrier-fab.zip` — 10 file phẳng.

## Đã sửa trong đợt này

### Điện áp — ba lỗi giống hệt board ESP32-S3

| Hạng mục | Trước | Sau |
|---|---|---|
| Net cấp U4 | `+4V_SIM` (4.0 V) | `+5V_SIM` (5 V 2 A) |
| Nguồn U3 (GPS) | `+5V` | `+3V3` |
| C1 | 1000 µF / 6.3 V | **1000 µF / 16 V** |

Ở 5 V thì tụ 6.3 V chỉ còn dư 21 % — quá sát cho tụ hoá tải xung 2 A.
Dùng loại **16 V, thân Ø10 mm** (footprint giữ nguyên).

### Đường mạch mới cho +3V3

Bỏ nhánh `+5V` chạy sang U3, **tái sử dụng hành lang B.Cu ở y ≈ 42.09** làm
đường `+3V3`, nối vào bằng nhánh mới qua cột trống x = 37.5:

```
U1.3V3 ─ B.Cu ─ (37.5, 59.22) ─ (37.5, 44.6) ─ (62.92, 44.6) ─ (62.92, 42.09) ─ … ─ U3.1
```

Không thể rẽ thẳng tại x = 62.92 vì `I2C_SCL` cắt ngang ở đó; cột x = 37.5 là
chỗ duy nhất trống ≥ 2 mm trên **cả hai mặt**.

### 75 → 0 vi phạm DRC

| Lỗi | Số | Nguyên nhân | Cách sửa |
|---|---|---|---|
| `clearance` | 18 | Netclass `POWER_SIM` cần hở 0.3 mm, vùng đồng đổ với 0.25 mm | Đặt zone clearance = 0.3 |
| `text_height` | 44 | Nhãn chân U1 (0.7 mm) và U4 (0.762 mm) dưới ngưỡng 0.8 | Nâng lên 0.85 |
| `lib_footprint_issues` | 7 | `fp-lib-table` trỏ sai thư mục dự án | Đổi sang `${KIPRJMOD}` |
| `silk_over_copper` | 6 | Silk U3 phủ chính chân nó; text B.Silk đè pad J1 | Thu mép silk, dời text |

Phát sinh và xử lý tiếp: nhãn chân U4 sau khi phóng to chạm pad → dịch trái
1.2 mm; footprint lỗ vít thay bằng bản thư viện chuẩn (mở mask 3.2 mm thay vì
6 mm hở đồng dưới đầu vít) → lộ ra **courtyard MH3 chồng U1 0.02 mm**, đã dời
MH3 và MH4 xuống y = 98.5 để giữ thẳng hàng.

### Bỏ C2 (100 nF gốm 0805)

Đo đường thật: C2 cách chân VCC của U4 **25 mm**. Với ~20 nH nối tiếp, tần số
tự cộng hưởng tụt về ~3.5 MHz — không còn làm được việc lọc cao tần. Bỏ để
thống nhất với board ESP32-S3 (tụ gốm dán khó hàn tay). Nếu modem reset khi
phát, hàn một tụ 104 thẳng lên chân VCC/GND của header U4.

### Silk

`+5V 1A` / `GND` cạnh J1, `+5V 2A` / `GND` cạnh J2 (mỗi nhãn thẳng hàng với
chân của nó), `SIM 5V 2A` cạnh U4, `GPS VCC=3V3` cạnh U3, `VSMART CARRIER REV C`
mặt sau.

## Cây nguồn

| Rail | Đường đi | Bề rộng |
|---|---|---|
| `+5V` | J1 → C3 (470 µF/10 V) → U1.19 | 1.0 mm |
| `+5V_SIM` | J2 → C1 (1000 µF/16 V) → U4.8 | 2.0 mm |
| `+3V3` | U1.1 (ngõ ra LDO AMS1117) → U2.1 + U3.1 | 0.5–1.0 mm |
| `GND` | đổ đồng kín 2 mặt + 285 via khâu | — |

LDO 3.3 V trên DevKitC là **AMS1117-3.3 (~800 mA–1 A)** — dư sức gánh thêm GPS
(~50–80 mA). Đây là khác biệt lớn so với board ESP32-S3 SuperMini, nơi LDO chỉ
500 mA và phải kiểm trước.

## Trước khi cấp nguồn — phải tự đo

**Mức logic UART của A7680C.** ESP32 xuất 3.3 V; UART họ SIMCom A76xx thường là
1.8 V. Cấp nguồn module rời, đo chân TXD lúc rảnh: ~3.3 V nối thẳng được;
~1.8 V thì chừa trống hai chân RXD/TXD khi hàn và đấu qua module dịch mức 2
chiều (TXS0102 hoặc 2×BSS138 + trở kéo). Chân U4 là lỗ xuyên dùng header nên
không phải làm lại board.

## Trước khi đặt board

In `manufacturing/CHECK-1to1-footprints.pdf` ở **100 %** (tắt "fit to page"),
đặt U1–U4 thật lên giấy đối chiếu khoảng cách chân. Footprint U3 (KS0319) và
U4 (TDM-4G-V1) vẽ theo kích thước danh nghĩa, chưa đo trên hàng thật.

## Cấp nguồn

`J1` = 5 V/1 A (ESP32), `J2` = 5 V/2.5 A (SIM). **Cấp riêng.** Đừng câu J2 ăn
theo cọc của J1 — đường `+5V` chỉ 1.0 mm, xung 2 A của modem sẽ kéo sụt rail
ESP32. Một nguồn 5 V ≥ 3 A thì kéo hai cặp dây riêng, đấu hình sao tại nguồn.

## Ghi chú giá

`DFM-001`: board 105 × 82 mm **vượt ngưỡng 100 × 100 mm** của bậc giá rẻ nhất
tại JLCPCB/PCBWay. Thu chiều rộng xuống ≤ 100 mm sẽ rẻ hơn đáng kể, nhưng phải
bố trí lại linh kiện — chưa làm.

## Giới hạn của review

Không có thư mục `datasheets/`, không có MPN (0/8), không có API key và không có
SPICE simulator trên máy. Mọi kết luận về chân và điện là **kiểm tra tính nhất
quán**, không phải xác minh theo datasheet nhà sản xuất.

Báo cáo review đầy đủ: https://claude.ai/code/artifact/87d22087-bd5d-4769-baa9-9593b283e771
