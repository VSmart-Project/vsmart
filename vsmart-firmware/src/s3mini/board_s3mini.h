// board_s3mini.h — Netlist record for the ESP32-S3 SuperMini board.
//
// Source of truth: vsmart-hardware/vsmart-module-esp32-s3-mini.kicad_pcb
//
// Net naming follows the same convention as the DevKitC carrier: names are
// from the ESP32's point of view, so GPS_TX is the pin the ESP32 transmits on.
#pragma once
#include <Arduino.h>

namespace s3mini {

constexpr const char* NAME = "vsmart-module-esp32-s3-mini";

// ── U3 · GPS NEO-7M (GY-GPSU3) ──────────────────────────────────────────────
constexpr int8_t   GPS_RX   = 44;   // U1.RX (GPIO44) <- U3.3 TXD
constexpr int8_t   GPS_TX   = 43;   // U1.TX (GPIO43) -> U3.2 RXD
constexpr uint8_t  GPS_UART = 2;
// See the note in board_devkitc.h: starting point for the auto-probe.
// 9600 = NEO-6M/7M/8M, 38400 = M10 generation.
constexpr uint32_t GPS_BAUD = 9600;

// ── U4 · A7680C TDM2309 LTE ─────────────────────────────────────────────────
constexpr int8_t   SIM_RX   = 6;    // U1.6  GPIO6  <- U4.11 TXD
constexpr int8_t   SIM_TX   = 7;    // U1.7  GPIO7  -> U4.10 RXD
constexpr int8_t   SIM_RST  = 12;   // U1.12 GPIO12 -> U4.9  RST
constexpr int8_t   SIM_DTR  = 11;   // U1.11 GPIO11 -> U4.2  DTR
constexpr int8_t   SIM_RI   = 13;   // U1.13 GPIO13 <- U4.1  RI
constexpr uint8_t  SIM_UART = 1;
constexpr uint32_t SIM_BAUD = 115200;

// ── U2 · MPU6050 GY-521 ─────────────────────────────────────────────────────
constexpr int8_t  I2C_SDA = 8;      // U1.8  GPIO8  <-> U2.4 SDA
constexpr int8_t  I2C_SCL = 9;      // U1.9  GPIO9  <-> U2.3 SCL
constexpr int8_t  MPU_INT = 10;     // U1.10 GPIO10 <-  U2.8 INT

// GPIO10 on the S3 is a normal pin, so the internal pull-up is available.
constexpr uint8_t MPU_INT_PINMODE = INPUT_PULLUP;

constexpr uint8_t MPU_ADDR = 0x68;  // U2.7 (AD0) tied to GND

// ── Power note ──────────────────────────────────────────────────────────────
// The SuperMini's on-board LDO is only 500 mA, unlike the AMS1117 (~1 A) on the
// DevKitC. Check the budget before hanging anything else off +3V3.

}  // namespace s3mini
