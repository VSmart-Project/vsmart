# Debug hai PCB Vsmart — 09/09/2026

## Kết luận

**Chưa nên gửi in hoặc cấp 5 V vào J2 của bản hiện tại.** Hai PCB không có lỗi DRC hình học hay pad chưa nối theo KiCad 10.0.5, nhưng điều đó không kiểm tra điện áp phù hợp module, khả năng chịu dòng, anten hoặc lắp ráp thực tế.

Hai mục cần giải quyết trước: điện áp cấp A7680C và đường nguồn SIM 0,2 mm. Đây không phải lượt sửa thiết kế: không lưu thay đổi vào PCB/schematic/project; chỉ tạo kết quả debug, netlist và bản xuất kiểm tra trong thư mục này. Tool MCP có ghi lại báo cáo DRC phụ của dự án.

## Phạm vi và phương pháp

- S3: `../vsmart-hardware/vsmart-module-esp32-s3-mini.kicad_pcb` cùng schematic/project.
- DevKitC: `../vsmart-module-esp32/vsmart-module-carrier.kicad_pcb` cùng schematic/project.
- Không coi snapshots, `.mcp-backups`, `.history` hoặc ba bản PCB trong `.tmp` là thiết kế độc lập. Thư mục `vsmart-module-carrier` chỉ có project file, không có PCB hiện hành riêng.
- Dùng KiCad MCP `open_project`, `run_drc`, `run_erc` cho cả hai; bổ sung CLI DRC `--severity-all --all-track-errors --schematic-parity --refill-zones`, không dùng `--save-board`.
- Xuất XML netlist bằng KiCad để đối chiếu với parser độc lập và analyzer. Đọc trực tiếp `.kicad_pro`, raw PCB, toàn bộ pad/net và các gói fab hiện tại.
- Đây chủ yếu là kiểm tra **tính nhất quán thiết kế**. Không có datasheets/extracted hay MPN cho đúng revision các module. Nguồn nhà cung cấp dưới đây bổ sung bằng chứng nhưng không thay cho sơ đồ đầy đủ của module thực tế.

## Kết quả chạy mới

| Hạng mục | S3 Mini | ESP32 DevKitC |
|---|---:|---:|
| Kích thước outline | 74 × 62 mm | 95 × 70 mm |
| Diện tích | 4.588 mm² | 6.650 mm² |
| Lớp đồng / dày board | 2 / 1,6 mm | 2 / 1,6 mm |
| Linh kiện schematic, không tính nguồn | 8 | 8 |
| Footprint PCB, gồm 4 lỗ MH | 12 | 12 |
| DRC hình học sau refill | 0 | 0 |
| Pad chưa nối theo DRC | 0 | 0 |
| ERC KiCad | 0 | 0 |
| Cảnh báo schematic parity | 25 | 43 |
| Chân analyzer so XML KiCad | 46/46 khớp | 66/66 khớp |
| Sai khác net có tên, ngoài no-connect rỗng | 0 | 1: GPS_PPS |
| Track / via | 90 / 122 | 69 / 181 |
| EMC score heuristic, cao hơn là tốt hơn | 59,5/100 | 56,5/100 |
| Thermal định lượng | Không tính được | Không tính được |
| Gerber + drill trong fab.zip | 0 findings | 0 findings |

DRC `--severity-all` không bật lại các check đang đặt `ignore`. Cả hai bỏ qua missing courtyard, track-not-centered-on-via, tuning profile geometry, footprint filters/type mismatch. Không có DRC exclusions. Clearance mặc định netclass là 0,2 mm; global min clearance 0 không có nghĩa là toàn board được phép chạm đồng. Min silk clearance đang 0, nên chưa đánh giá theo khoảng cách silk-mask của xưởng cụ thể.

## Các vấn đề ưu tiên

### P1 — Nguồn SIM 5 V mâu thuẫn tài liệu của module được chỉ định

Cả hai schematic ghi U4 `A7680C TDM2309 4G`, J2 `EXTERNAL 5V 2A SIM INPUT`. J2.1 nối trực tiếp U4.8 qua `+5V_SIM`; không có bộ hạ áp trung gian trên carrier.

[Repository TDLOGY được symbol dẫn tới](https://github.com/TDLOGY/TDM2309-A7680C-4G-Replace-SIM800L) ghi 3,8–4,2 V. [Trang TDM2309 của nhà cung cấp](https://linhkienthuduc.com/san-pham/module-4g-simcom-a7680c-tdm2309-giai-phap-thay-the-y-het-chan-cho-2g-sim800-sim800l/) ghi 3,7–4 V. Hai nguồn hơi khác nhau về dải nhưng **đều không cho phép suy ra 5 V** cho module này.

Hành động: xác định chính xác model/revision board SIM, kiểm tra có bộ ổn áp đầu vào hay không. Nếu là TDM2309 theo hai nguồn trên, thiết kế lại chỉ dẫn nguồn quanh 4,0 V theo đúng giới hạn của revision, đổi tên rail/nhãn J2/silkscreen và tài liệu cùng nhau. Chưa cấp 5 V chỉ vì nhãn PCB ghi như vậy. Nếu phần cứng thật là biến thể nhận 5 V, cần tài liệu của biến thể đó và cập nhật BOM/symbol tương ứng.

### P1 — Đường cấp nguồn SIM chỉ 0,2 mm

Raw PCB cho thấy mọi segment `+5V_SIM` đều rộng 0,2 mm, không có power plane song song (hai pour là GND).

| Đo / tính | S3 | DevKitC |
|---|---:|---:|
| Tổng chiều dài đường SIM dương | 46,42 mm | 53,40 mm |
| R đường J2.1 → U4.8, giả định đồng 35 µm | 0,1143 Ω | 0,1315 Ω |
| Sụt áp tại 2 A theo nhãn đầu vào | 0,229 V | 0,263 V |
| Tổn hao đồng nếu 2 A liên tục | 0,457 W | 0,526 W |

Tính R=ρL/(wt), ρ=1,724×10⁻⁸ Ω·m. Đây là ước tính điện trở ở nhiệt độ phòng, chưa gồm GND, via barrel, dây, socket, tiếp xúc, nhiệt độ hay ESR. Không phải dự đoán nhiệt hoặc khẳng định modem tiêu thụ 2 A liên tục. Module có tải xung; cần đo sụt áp thực tế lúc phát sóng. Nguồn TDLOGY nêu dòng đỉnh tới 1,4 A, khi đó sụt trên đường dương riêng vẫn khoảng 0,160/0,184 V.

Nguyên nhân cấu hình:

- DevKitC có class `POWER_SIM` rộng 2 mm nhưng còn gán cho **`+4V_SIM`**, không phải `+5V_SIM` hiện tại.
- S3 hiện **không có netclass assignments và patterns**, nên không có ràng buộc nguồn SIM riêng đang áp dụng. Không giống hoàn toàn trường hợp DevKitC.

Hành động: gán đúng rail vào class nguồn, đi lại toàn tuyến J2–C1–U4 bằng đường rộng/pour phù hợp dòng và đồng xưởng. Class 2 mm là ý định đã có của DevKitC, không phải kết quả tính nhiệt cuối cùng. Netclass width là thông số routing; muốn bắt mọi đoạn nhỏ bằng DRC cần thêm custom rule minimum width cho rail. Tụ lớn không bù được một đường cấp nguồn DC/xung quá mảnh.

### P2 — Chưa có keepout anten

Cả hai PCB có `keepout_zones=[]`; không có rule area khóa tránh đồng/track dưới anten. GND pour đang bao phủ phần lớn board. Không được suy ra anten đạt chỉ từ việc DRC không lỗi.

[Espressif: bố trí module trên baseboard](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/pcb-layout-design.html) khuyến nghị đặt phần anten ra ngoài mép baseboard và giữ vùng trống thích hợp. Cần xác định anten thật của DevKitC và SuperMini rồi đặt keepout cả hai lớp hoặc thay vị trí. Không áp kích thước keepout của WROOM một cách máy móc cho anten chip trên SuperMini. Cần thử RF với vỏ và anten GPS/LTE thực tế.

### P2 — Parity chưa sạch

- S3: 12 chênh tên no-connect, 7 chênh Description/Datasheet, 2 chênh BOM exclusion J1/J2, 4 footprint lỗ MH không có schematic.
- DevKitC: 29 chênh tên no-connect rỗng, 1 `GPS_PPS`, 7 field, 2 BOM exclusion, 4 MH.
- DevKitC U1 pad 5/GPIO34 vẫn mang `GPS_PPS`; schematic đánh no-connect. Không còn track GPS_PPS, nên chưa thấy short hay kết nối GPS sai do mục này. Đây là net tồn dư sau đổi GPS cần dọn đồng bộ.
- S3 U1 còn dẫn datasheet DevKitC; DevKitC U3 mang tên GY-GPSU3 nhưng URL còn Keyestudio KS0319. Những link sai này gây nguy cơ chọn nhầm pinout/nguồn ở lần sửa sau.

Hành động: đồng bộ các trường/schematic-PCB, xử lý J1/J2 là pad hàn không mua linh kiện và đánh dấu MH là cơ khí đúng cách. Không xóa/cắm dây vào các chân bỏ trống chỉ để giảm số warning.

### P2 — Nguồn USB / ngoài, bảo vệ và dữ liệu module

Carrier không có bảo vệ đảo cực, cầu chì, OR-ing hoặc tách nguồn USB với J1. [Hướng dẫn chính thức DevKitC](https://documentation.espressif.com/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) yêu cầu chỉ dùng một cách cấp nguồn tại một thời điểm. Không đồng thời cấp 5 V ngoài và USB cấp nguồn nếu chưa xử lý power-path. SuperMini cần sơ đồ đúng biến thể để kết luận tương tự.

Các rail khác có thể bật/tắt riêng; cần đánh giá back-power qua UART khi SIM hoặc MCU chưa có nguồn. Điện áp logic không thể suy trực tiếp từ tên rail 5 V. TDLOGY mô tả logic tương thích 3,3/5 V cho sản phẩm của họ; cần xác nhận đúng module và các chân điều khiển, không kết luận UART 5 V chỉ vì U4 được cấp 5 V trong schematic.

## Deep review từng module và linh kiện

| Ref | Cách dùng hiện tại | Đánh giá / phần chưa biết |
|---|---|---|
| U1 S3 | J1 5 V vào, 3V3_OUT nuôi MPU + GPS | Pin-net tự nhất quán; thiếu sơ đồ đúng SuperMini, giới hạn LDO và mạch USB power-path. Không coi tên ESP32-S3 là MPN board. |
| U1 DevKitC | 5 V pin19; +3V3 pin1 | Cách dùng phù hợp vai trò header trong tài liệu DevKitC; phải đúng revision/biến thể WROOM/WROVER. Không dùng “AMS1117 1 A” như bảo đảm dòng khả dụng khi chưa tính công suất nhiệt. |
| U2 GY-521 | VCC=3V3; SDA/SCL I²C; ADD=GND; INT về MCU | ADD thấp phù hợp ý định địa chỉ 0x68; pull-up và tụ trên module không được mô hình hóa. Cần kiểm tra pull-up lên rail nào, regulator/dropout ở board thực. |
| U3 GY-GPSU3 | 3V3 vào; RXD=GPS_TX; TXD=GPS_RX; GND | UART đã đấu chéo đúng theo tên chân. Chưa có sơ đồ breakout để bảo đảm 3,3 V đưa vào VCC sau regulator vẫn đủ điện áp cho NEO-7; không dùng datasheet chip thay cho board. |
| U4 TDM2309 | +5V_SIM; RXD=SIM_TX, TXD=SIM_RX, RI/DTR/RST nối MCU | Ưu tiên giải quyết nguồn và routing nêu trên. Logic và cơ khí phải đối chiếu đúng revision thật. ANT header không nối là chủ ý dùng đầu anten riêng; phải lắp anten thực tế. |
| C1 | 1000 µF/16 V low-ESR, pad1=SIM+, pad2=GND | Cực tính tự nhất quán; điện áp định mức ghi cao hơn rail. Chưa có MPN/ESR/ripple/lifetime và kích thước thật. |
| C3 | 470 µF/10 V, pad1=+5V, pad2=GND | Cực tính tự nhất quán; chưa kiểm chứng dòng nạp lúc hot-plug và khả năng nguồn ngoài. |
| J1/J2 | Pad1=dương, pad2=GND chung | Cần dây/cách hàn chịu tải và giảm lực kéo; không có bảo vệ đảo cực. |
| MH1–MH4 | 4 lỗ M3 cơ khí | Không phải IC bị thiếu trên schematic. Cần clearance đầu vít và module trong lắp ráp thực. |

### Mapping A7680C — cả hai board

Nhìn từ trên vào mặt khe SIM: trái từ trên xuống RI, DTR, MICP, MICN, SPKP, SPKN; phải ANT, VCC, RST, RXD, TXD, GND. ANT cao hơn RI một bước gần 2,54 mm.

| Chân module U4 | Net | S3 GPIO | DevKitC GPIO |
|---|---|---:|---:|
| 1 RI | SIM_RI | 13 | 33 |
| 2 DTR | SIM_DTR | 11 | 25 |
| 8 VCC | +5V_SIM hiện tại | Nguồn riêng J2 | Nguồn riêng J2 |
| 9 RST | SIM_RST | 12 | 32 |
| 10 RXD | SIM_TX | 7, MCU phát | 27, MCU phát |
| 11 TXD | SIM_RX | 6, MCU nhận | 26, MCU nhận |
| 12 GND | GND | GND | GND |

Chân 3–7 không nối trên carrier. Toàn bộ mapping chi tiết trong `s3/raw-audit.json` và `devkit/raw-audit.json`.

### Cơ khí U4 sau các lần lật

Đã tải [footprint gốc từ nhà cung cấp](https://cdn.tdlogy.com/public/CAD/TDM-4G-V1/TDM-4G-V1.kicad_mod). Đối chiếu bằng tọa độ, lấy RI làm gốc và phản chiếu theo mặt SIM hướng lên: khoảng cách 12 chân khớp tới sai số số học; khoảng cách hai cột 22,0736 mm, bước chân 2,54 mm. Lỗ NPTH duy nhất khác 0,016 mm theo Y so footprint nhà cung cấp. Đây không còn bằng chứng lệch cả hàng 5,08 mm so hình học nguồn này.

Tuy nhiên footprint nguồn tự lặp số pad 1–6 ở hai cột: **không thay trực tiếp vào thiết kế** vì sẽ nối sai net. Dự án dùng số riêng 1–12. Việc khớp tọa độ không bảo đảm file 3D dựng chính xác hoặc đúng mẫu module đang cầm. Offset model hiện (-21,75; 6; 2,5), xoay X=180°; chưa đo chiều cao header/chi tiết mặt dưới. Vẫn cần in 1:1, áp module thật, đo hai cột, kiểm tra lỗ bắt vít và khe hở chống chạm linh kiện khi SIM ngửa lên.

## Nguồn, EMC và nhiệt

Power tree: J1 +5V → U1 + C3; U1 3V3_OUT → U2 + U3. J2 SIM rail → C1 + U4. Tất cả dùng GND chung. Không có LM2596 trên carrier; nguồn buck ở ngoài.

EMC analyzer báo S3 18 findings (5 error, 10 warning, 3 info), DevKitC 14 (6 error, 5 warning, 3 info). Các điểm return-plane đáng rà: S3 SIM_RI/SIM_TX khoảng 67% coverage theo heuristic; DevKitC I²C SDA 60%, SCL 75%. S3 còn MPU_INT/SIM_TX chuyển lớp thiếu stitching gần theo heuristic. Chưa nâng các số này thành kết luận không đạt EMC: đây là UART/I²C/control tốc độ thấp, chưa có edge-rate, cáp/vỏ hay đo thực tế.

Thermal script chạy nhưng **0 linh kiện có dữ liệu công suất**, trả `thermal_score=null`, `skipped_reason`. Không có kết quả Tj; không được diễn đạt thành “nhiệt đạt”. Regulator/modem ở bên trong module nằm ngoài mô hình carrier. Dòng tổng rail 3V3 và nhiệt LDO chưa định lượng.

## Gerber, drill và delta

Gói đang kiểm tra là `manufacturing/<tên-board>-fab.zip` mới nhất ngày 01/09 khoảng 20:23–20:24, không phải các zip cũ có hậu tố “final”.

- 10/10 entries của mỗi zip khớp byte với file trong manufacturing hiện tại.
- Xuất mới từ PCB vào `fresh-fab/`, bao gồm kiểm tra/refill zones. 9/9 file Gerber/drill có hình học giống gói zip sau bỏ dòng ngày giờ/checksum metadata; job metadata không tính trong phép so này.
- Gerber analyzer trên nội dung zip đầy đủ drill: 0 findings mỗi board.
- Chạy analyzer riêng thư mục `gerbers/` ban đầu ra warning thiếu drill vì drill nằm thư mục khác; đây không phải thiếu drill trong zip.
- `diff_analysis.py` so PCB analyzer gần nhất (S3 `2026-09-01_2024`, DevKitC `2026-09-01_2023`) báo không đổi. Điều này chỉ nói delta analyzer không đổi; các lỗi nêu trên vẫn tồn tại, không chứng minh thiết kế đúng.

## Triage cảnh báo tự động

- PR-001 thiếu I²C pull-up: không thấy trên carrier, nhưng module GY-521 có thể đã có. Không kết luận bus chắc chắn thiếu; cần kiểm tra board thật và rail pull-up.
- VM-001 miền 5/3,3 V: tool suy rail nguồn thành logic I/O. Không dùng làm bằng chứng các pin SIM xuất 5 V; vấn đề nguồn VCC sai tài liệu vẫn độc lập và cần xử lý.
- DC-001/DC-002 thiếu tụ cho module: analyzer không thấy linh kiện bên trong module; chưa thể bảo đảm hay phủ nhận decoupling. C1/C3 là tụ bulk, không thay thế bypass nội bộ.
- TE-001 testpoint 0%: chân header và pad nguồn có thể đo thủ công; không đồng nghĩa mọi net không thể đo. Khi module cắm che chân, cần kiểm tra khả năng tiếp cận và test jig.
- `cross_verify` báo 4 orphan MH: chấp nhận là cơ khí. Thông báo C1 hoặc `+5V_SIM` không tìm thấy placement là heuristic lấy rail làm ref, không phải mất tụ.
- 25/43 parity warnings vẫn được lưu nguyên bản; phân loại ở trên thay vì che hoặc bỏ qua toàn bộ.
- DS-001/SS-001: 0/8 MPN và không có bộ datasheet đúng module. Đây là giới hạn thực về xác định phần cứng, không nên bịa MPN để xóa warning.

## Chuỗi đã chạy và giới hạn

Đã chạy mới trên cả hai: KiCad MCP DRC/ERC, CLI all-severity DRC/ERC + parity + refill trong bộ nhớ; schematic analyzer; PCB analyzer `--full`; cross_analysis; cross_verify; EMC; thermal; gerber/drill analyzer; diff_analysis; XML netlist/raw pin audit; zip/fresh-export comparison; per-IC deep_review và gate.

Deep-review gate chấp nhận 7 evidence records cho S3 và 8 cho DevKitC, không quarantine. Gate chỉ kiểm tra cấu trúc/chứng cứ được cung cấp, **không** chứng nhận tính đúng điện của module.

Chưa làm được: SPICE (không tìm thấy ngspice/LTspice/Xyce), lifecycle theo đúng part (thiếu MPN), datasheet/PDF per-IC cho đúng revision, thermal/load transient, EMC lab, đo cơ khí thực và xác nhận khoảng hở 3D. Không có API key DigiKey; đã dùng tài liệu công khai của nguồn liên quan thay vì coi không có key là không thể tra cứu. USB/RF nội bộ các module không được đánh giá đầy đủ. Chưa chọn xưởng và dung sai công nghệ cụ thể để ký duyệt DFM.

## Thứ tự xử lý đề xuất

1. Xác định đúng module SIM và điện áp cấp; sửa tài liệu/rail/J2 đồng bộ. Không cấp thử 5 V khi còn mâu thuẫn.
2. Khôi phục ràng buộc nguồn SIM đúng net và đi lại đường cấp đủ rộng, kiểm tra tải xung.
3. Xác định anten thật, tạo keepout hoặc bố trí lại; giữ kích thước 74×62 và 95×70 chỉ nếu không vi phạm yêu cầu RF/cơ khí.
4. Dọn GPS_PPS và đồng bộ metadata/no-connect/BOM exclusions.
5. In 1:1 và lắp thử header/module; xác minh nguồn logic, LDO, pull-up, thứ tự cấp nguồn.
6. Sau sửa mới chạy lại DRC/ERC/parity, export Gerber mới và chọn đúng một gói gửi xưởng. Chưa dùng các gói ở đây để đặt sản xuất.
