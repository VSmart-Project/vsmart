// board_devkitc.h — Netlist record for the ESP32-DevKitC carrier, Rev C.
//
// Source of truth: vsmart-module-esp32/vsmart-module-carrier.kicad_pcb
//                  (Rev C, 2026-08-30, 105.1 × 82.1 mm, 2 layers)
//
// Net names on the schematic are **from the ESP32's point of view**:
//   GPS_TX = ESP32 transmits -> RXD of the GPS module
//   GPS_RX = ESP32 receives  <- TXD of the GPS module
// Same for SIM_TX / SIM_RX with the A7680C. Do not swap them.
//
// "U1 pin" is the pin number in the KiCad symbol; "silk" is what is printed on
// the DevKitC itself.
#pragma once
#include <Arduino.h>

namespace devkitc {

constexpr const char* NAME = "vsmart-carrier-revC (ESP32-DevKitC)";

// ── U3 · GPS NEO-7M (GY-GPSU3), UART2 ───────────────────────────────────────
// Rev C routes these as copper traces. The overrides exist only for bench
// bring-up, when the GPS is on jumper wires and you want to rule out a dead
// GPIO. Build them from platformio.ini, e.g.
//     build_flags = ${env.build_flags} -DGPS_RX_PIN=18 -DGPS_TX_PIN=19
// so the netlist record below stays true to the board.
//
// Do NOT pick GPIO1 or GPIO3. They are UART0, wired to the USB-serial bridge
// on the DevKitC module itself: the bridge and the GPS would both drive the
// same line, and flashing and the console would stop working.
// GPIO6-11 are the internal flash. GPIO12 must stay low at boot.
// Free and safe on this board: 18, 19, 23, 4, 13, 14 — plus 34/35/36/39 for RX
// only (those are input-only, which is all an RX pin has to be).
#ifndef GPS_RX_PIN
#define GPS_RX_PIN 16               // U1.27 GPIO16, silk "16"  <- U3.3 TXD  (net GPS_RX)
#endif
#ifndef GPS_TX_PIN
#define GPS_TX_PIN 17               // U1.28 GPIO17, silk "17"  -> U3.2 RXD  (net GPS_TX)
#endif
constexpr int8_t   GPS_RX   = GPS_RX_PIN;
constexpr int8_t   GPS_TX   = GPS_TX_PIN;
constexpr uint8_t  GPS_UART = 2;
// Starting point for the auto-probe in lib/Gps, not a hard setting.
// NEO-6M/7M/8M leave the factory at 9600; the M10 generation at 38400.
// Set this to whatever module is actually fitted and the probe locks on the
// first try; get it wrong and it costs 3 s per wrong candidate.
constexpr uint32_t GPS_BAUD = 9600;

// The GY-GPSU3 has no PPS pin — net GPS_PPS was dropped in Rev C, so U1.5
// (GPIO34) is unconnected and marked no-connect on the schematic.

// ── U4 · A7680C TDM2309 LTE, UART1 ──────────────────────────────────────────
constexpr int8_t   SIM_RX   = 26;   // U1.10 GPIO26, silk "26"  <- U4.11 TXD
constexpr int8_t   SIM_TX   = 27;   // U1.11 GPIO27, silk "27"  -> U4.10 RXD
constexpr int8_t   SIM_RST  = 32;   // U1.7  GPIO32, silk "32"  -> U4.9  RST (active LOW)
constexpr int8_t   SIM_DTR  = 25;   // U1.9  GPIO25, silk "25"  -> U4.2  DTR
constexpr int8_t   SIM_RI   = 33;   // U1.8  GPIO33, silk "33"  <- U4.1  RI  (active LOW)
constexpr uint8_t  SIM_UART = 1;
constexpr uint32_t SIM_BAUD = 115200;   // the A7680C autobauds; the first AT locks it in

// ── U2 · MPU6050 GY-521, I2C ────────────────────────────────────────────────
constexpr int8_t  I2C_SDA = 21;     // U1.33 GPIO21, silk "21"  <-> U2.4 SDA
constexpr int8_t  I2C_SCL = 22;     // U1.36 GPIO22, silk "22"  <-> U2.3 SCL
constexpr int8_t  MPU_INT = 35;     // U1.6  GPIO35, silk "35"  <-  U2.8 INT

// GPIO35 is INPUT-ONLY and has no internal pull resistors, so the pin must stay
// bare and the MPU6050 INT output has to be driven push-pull active-high.
constexpr uint8_t MPU_INT_PINMODE = INPUT;

// U2.7 (AD0) is tied to GND -> fixed address 0x68.
constexpr uint8_t MPU_ADDR = 0x68;

// ── Power (no firmware handles required) ────────────────────────────────────
// +5V     : J1 (5 V/1 A)   -> C3 470 µF/10 V   -> U1.19, trace 1.0 mm
// +5V_SIM : J2 (5 V/2.5 A) -> C1 1000 µF/16 V  -> U4.8,  trace 2.0 mm
// +3V3    : U1.1, output of the DevKitC's AMS1117 LDO -> U2.1 and U3.1
// Feed J1 and J2 separately: the 1.0 mm +5V trace sags under the modem's 2 A
// transmit burst if both share a terminal.

}  // namespace devkitc
