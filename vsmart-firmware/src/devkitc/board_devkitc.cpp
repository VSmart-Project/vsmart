// board_devkitc.cpp — Binds the Rev C netlist to the shared Board interface.
//
// Compiled only in env:devkitc; env:s3mini excludes this whole folder through
// build_src_filter. Exactly one translation unit in the firmware defines BOARD.
#include "board_devkitc.h"
#include <Board.h>

const BoardPins BOARD = {
    .name = devkitc::NAME,

    .gps = { devkitc::GPS_RX, devkitc::GPS_TX, devkitc::GPS_UART, devkitc::GPS_BAUD },

    .sim = { devkitc::SIM_RX, devkitc::SIM_TX, devkitc::SIM_UART, devkitc::SIM_BAUD },
    .simRst = devkitc::SIM_RST,
    .simDtr = devkitc::SIM_DTR,
    .simRi  = devkitc::SIM_RI,

    .i2c = { devkitc::I2C_SDA, devkitc::I2C_SCL },
    .mpuInt        = devkitc::MPU_INT,
    .mpuIntPinMode = devkitc::MPU_INT_PINMODE,
    .mpuAddr       = devkitc::MPU_ADDR,
};
