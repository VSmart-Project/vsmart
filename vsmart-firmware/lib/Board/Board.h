// Board.h — Hardware interface every module programs against.
//
// This header declares WHAT a board offers. WHICH pins those are lives in
// src/<board>/, one folder per PCB, and exactly one of them is compiled per
// build environment (see build_src_filter in platformio.ini).
//
// Modules must never reference a raw GPIO number or a BOARD_* macro. Ask this
// struct instead, and adding a third board stays a matter of adding one folder.
#pragma once
#include <Arduino.h>

struct UartPins {
    int8_t   rx;        // ESP32 pin that RECEIVES (wired to the peer's TX)
    int8_t   tx;        // ESP32 pin that TRANSMITS (wired to the peer's RX)
    uint8_t  port;      // hardware UART index
    uint32_t baud;
};

struct I2cPins {
    int8_t sda;
    int8_t scl;
};

struct BoardPins {
    const char* name;

    UartPins gps;       // U3 — GPS NEO-7M (GY-GPSU3)

    // U4 — A7680C LTE. Not driven by the GPS bring-up build; kept so the
    // driver in attic/ restores without touching the board layer.
    UartPins sim;
    int8_t   simRst;    // active LOW
    int8_t   simDtr;    // LOW = keep awake
    int8_t   simRi;     // active LOW

    // U2 — MPU6050. Also parked in attic/.
    I2cPins  i2c;
    int8_t   mpuInt;
    uint8_t  mpuIntPinMode;   // INPUT or INPUT_PULLUP, depending on the pin
    uint8_t  mpuAddr;
};

// Defined once, in the board folder selected by this environment.
extern const BoardPins BOARD;
