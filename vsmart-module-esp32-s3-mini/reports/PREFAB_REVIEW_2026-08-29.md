# Pre-fabrication review — ESP32-S3 SuperMini carrier

Date: 2026-08-29  
Project: `vsmart-module-esp32-s3-mini`  
Review stage: bare-PCB prototype release candidate

## Executive decision

**CONDITIONAL GO for one bare-PCB prototype.** The saved PCB and generated fabrication files are internally consistent and pass KiCad DRC and Gerber checks. Do not order a production quantity until the exact physical modules have been checked against a 1:1 print and the two module-level assumptions below have been confirmed.

## Verified results

- KiCad DRC from the reloaded, saved PCB: **0 errors, 0 warnings**.
- Board routing: **14/14 nets routed**, 0 unrouted pads.
- Board: **74.0 mm × 62.0 mm**, rounded corners, two copper layers, nominal thickness 1.6 mm.
- Four M3 NPTH mounting holes: 3.2 mm.
- DFM metrics: minimum trace 0.25 mm, minimum drill 0.30 mm, minimum annular ring 0.15 mm; no standard-fab violations detected.
- Power connectivity graph: +5V and +4V_SIM each form one connected island with no disconnected power pads.
- ESP32 antenna keepout exists on F.Cu and B.Cu and blocks tracks, vias, pads and copper pour.
- Fabrication archive: 7 Gerber files, 2 Excellon drill files, 200 holes total; Gerber analyzer reports 0 findings.
- Fabrication ZIP integrity test: passed. SHA-256: `7a28cc6895b9c39439e5b887c3e0beacb903178a4dff6eaaedfa98f138f1d0aa`.

## Optimizations applied in this review

- Split the +5V and +4V_SIM T-junctions into explicit trace nodes so connectivity is unambiguous to KiCad and downstream analyzers.
- Shortened the 2.0 mm +4V_SIM path from C1 to U4 from approximately 18.1 mm to 14.1 mm while preserving clearance around U4 pin 7.
- Added a GND return via adjacent to the distant GPS_RX layer transition.
- Refilled both GND zones after routing changes.
- Corrected all silkscreen DRC issues: 12 undersized A7680C pin labels, three silk overlaps and one silk-over-mask warning.
- Added `REV A` to front silkscreen.
- Kept the board at 74 × 62 mm. Further shrinking would reduce margin around the GPS/A7680C bodies and the M3 holes without verified mechanical drawings for the exact breakout boards.

## Electrical review

### ESP32-S3 SuperMini

The footprint expects an 18-pin SuperMini variant with 2.54 mm pitch and 15.24 mm between pin rows. Its pin names are TX, RX, GPIO1–7 on one side and 5V, GND, 3V3, GPIO13–8 on the other. This matches published pinout information for the 18-pin ESP32-S3 SuperMini family, but generic boards vary slightly in outline and orientation. The physical board must be placed on a 1:1 print before ordering quantity.

### A7680C TDM2309

The TDLOGY TDM2309 documentation specifies 3.8–4.2 V supply, 3.3 V/5 V compatible logic and peak current up to 1.4 A. The carrier uses a dedicated external 4.0 V input, a 2.0 mm supply trace and C1 = 1000 µF low-ESR close to the module supply path. Set the external LM2596 to **4.0 V before connecting U4**, use a supply capable of at least 2 A transient current and keep the supply wires short.

Source: https://github.com/TDLOGY/TDM2309-A7680C-4G-Replace-SIM800L

### MPU6050 GY-521

The analyzer reports missing I2C pull-ups because the carrier schematic contains no discrete pull-up resistors. This is acceptable only if the exact GY-521 board contains its usual onboard SDA/SCL pull-ups. Measure or inspect the module before ordering. If pull-ups are absent, add approximately 4.7 kΩ from SDA and SCL to 3.3 V, or revise the carrier.

The carrier also relies on the GY-521's onboard decoupling.

### GPS NEO-7M breakout

The footprint is a nominal 25 × 25 mm GY-GPSU3/NEO-7M-style board with a 1×4 header. The exact breakout body and header offset must be checked physically. A 5 V-capable breakout normally regulates VCC to the NEO-7 device domain, but 5 V power-input tolerance does not by itself prove 5 V UART-input tolerance. The current connection is safe only for a breakout whose UART is 3.3 V compatible; verify the exact module schematic or measure TX idle voltage.

## Analyzer findings that are not bare-PCB blockers

- Explicit test-point coverage is reported as 0/10. This is a manually assembled module carrier and the signals are directly probeable on through-hole module headers; dedicated ICT pads were intentionally not added to preserve area.
- The automated gate reports 12 PCB footprints versus 8 schematic BOM components. The four additional footprints are non-BOM M3 mounting holes.
- The automated gate reports 26 schematic nets versus 14 PCB nets because schematic-only power-symbol/no-connect bookkeeping is counted differently; routed PCB nets are complete.
- MPN coverage is 0%. This blocks turnkey assembly sourcing, but not fabrication of a bare PCB populated with the user's existing modules. Exact capacitor voltage, ESR, size and connector/module identities still need to be selected for assembly.
- EMC heuristics flag partial plane coverage on low-speed UART/I2C/interrupt nets and onboard-decoupling assumptions. These are design-risk indicators, not KiCad rule violations. No formal EMC compliance is claimed.
- Thermal simulation was skipped because no MPN/datasheet power models are attached. Heat depends mainly on the plug-in modules and enclosure airflow.
- SPICE was skipped because no supported simulator is installed and the design is primarily a module interconnect carrier.

## Before placing the order

1. Print `manufacturing/CHECK-1to1-footprints.pdf` at 100%, with “fit to page” disabled.
2. Place the actual ESP32-S3 SuperMini, GY-521, GPS board and TDM2309 on the print; confirm pin-1 orientation, row spacing, module outline and connector access.
3. Confirm GY-521 SDA/SCL pull-ups and onboard decoupling.
4. Confirm GPS TX idle voltage is approximately 3.3 V and that its RX accepts a 3.3 V high level.
5. Set LM2596 output to 4.0 V without U4 connected; then verify polarity at J2.
6. For the first power-up, use a current-limited supply and populate/test one subsystem at a time.

## Manufacturing package

Upload only `manufacturing/vsmart-module-esp32-s3-mini-fab.zip` to the PCB manufacturer. Recommended initial order: 1–5 bare prototype boards, 2 layers, 1.6 mm FR-4, 1 oz copper, standard green solder mask unless another stackup is required.

## Overview

This is a compact, manually assembled carrier for four plug-in modules: ESP32-S3 SuperMini, MPU6050 GY-521, GPS NEO-7M breakout and A7680C TDM2309. LM2596 converters remain external and enter the PCB through solder-wire pads.

## Critical Findings

No copper, clearance, routing, outline, silkscreen, Gerber or drill defect remains. Release is conditional only on physical-module fit, GY-521 pull-ups, GPS UART levels and correct 4.0 V A7680C power setup.

## Component Summary

Eight BOM items are represented in the schematic: U1–U4, C1, C3, J1 and J2. The PCB contains those items plus four non-BOM M3 mounting-hole footprints. All active modules are through-hole/plugin assemblies; there are no carrier-board SMD parts.

## Power Tree

- External regulated 5 V at J1 feeds C3, U1 ESP32-S3 SuperMini and U3 GPS breakout.
- U1's 3.3 V output feeds U2 GY-521.
- External regulated 4.0 V at J2 feeds C1 and U4 TDM2309 through a 2.0 mm trace.
- All supplies share the carrier GND planes.

## Analyzer Verification

The final saved files were reopened and reanalyzed. KiCad DRC is clean; PCB analysis reports routing complete and no DFM violation; cross-analysis reports no power-island warning; Gerber analysis reports all expected layers and drills with no finding. ERC has no electrical error and one library-cache comparison warning for U1.

## Signal Analysis Review

- I2C: ESP GPIO8/GPIO9 to GY-521 SDA/SCL; GPIO10 to MPU INT.
- GPS UART: ESP TX/RX crossed to GPS RX/TX.
- Cellular UART/control: GPIO6, 7, 11, 12 and 13 connect to TDM2309 TXD, RXD, DTR, RST and RI as documented in the project schematic.
- All routed signals are low-rate control/UART/I2C nets; no controlled-impedance interface leaves the plug-in modules.

## PCB Layout Analysis

Board size is 74 × 62 mm. Placement leaves ESP antenna copper-free, puts module connectors at accessible edges and preserves four M3 holes. Both sides use GND pours with 145 through vias. Routing is complete and passes standard two-layer fabrication rules.

## EMC / Cross-Domain Analysis

The heuristic EMC score is 70/100. It flags incomplete local reference-plane coverage on several slow nets and assumes U2/U3 have no local capacitors because module-internal parts are not modeled. These findings should be handled as bring-up risks, not evidence of formal compliance. No EMC certification is claimed.

## Thermal Analysis

Not quantified: no MPN-backed power-loss and thermal-resistance data are attached. The carrier itself has no switching regulator or high-power semiconductor; enclosure airflow and plug-in module temperatures must be checked during bring-up.

## Gerber Verification

Seven Gerber layers and separate PTH/NPTH Excellon files were parsed successfully. Coordinate ranges are consistent, the outline is present, and the archive contains exactly the ten intended fabrication files.

## PDN Impedance

Not performed: there is no SPICE simulator, capacitor ESR/ESL model or cable/source-impedance model. The A7680C rail was instead reviewed geometrically and uses a 2.0 mm trace plus 1000 µF low-ESR bulk capacitance.

## Power Budget

The documented TDM2309 peak is up to 1.4 A; use a 4.0 V source rated for at least 2 A transient current. Exact ESP32, GPS and MPU current totals were not calculated because the generic breakout variants and operating modes are not identified by MPN.

## Bus Topology

One point-to-point I2C bus serves U2. Two independent UART links serve U3 and U4. The remaining cellular lines are point-to-point control/status signals.

## Test Coverage

There are no dedicated test-point footprints. For prototype bring-up, every signal and rail is accessible at through-hole module/header pads and J1/J2; this is suitable for manual probing but not automated ICT.

## Assembly Complexity

Low to moderate manual-assembly complexity: two polarized electrolytic capacitors, two solder-wire connectors, four plug-in module footprints and four mechanical holes. Correct module orientation and power polarity are the main assembly risks.

## BOM Optimization

Not performed: this is a carrier for user-supplied modules. MPNs for C1, C3, J1, J2 and the exact module variants should be added before turnkey assembly or volume procurement.

## Not Performed / Review Limits

No SPICE simulation, quantitative thermal simulation, lifecycle audit, formal signal-integrity simulation or EMC compliance test was possible. Datasheet coverage is incomplete for the exact generic breakout boards. Mechanical correctness therefore still requires a 1:1 physical fit check.

## Final verdict / readiness

Ready to order **one small batch of bare prototype PCBs after the six pre-order checks above pass**. Not approved for production quantity or turnkey PCBA while exact module variants, MPNs and mechanical fit remain unconfirmed.
