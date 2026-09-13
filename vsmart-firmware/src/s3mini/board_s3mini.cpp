// board_s3mini.cpp — Binds the S3 SuperMini netlist to the shared Board interface.
//
// Compiled only in env:s3mini; env:devkitc excludes this whole folder through
// build_src_filter.
#include "board_s3mini.h"
#include <Board.h>

const BoardPins BOARD = {
    .name = s3mini::NAME,

    .gps = { s3mini::GPS_RX, s3mini::GPS_TX, s3mini::GPS_UART, s3mini::GPS_BAUD },

    .sim = { s3mini::SIM_RX, s3mini::SIM_TX, s3mini::SIM_UART, s3mini::SIM_BAUD },
    .simRst = s3mini::SIM_RST,
    .simDtr = s3mini::SIM_DTR,
    .simRi  = s3mini::SIM_RI,

    .i2c = { s3mini::I2C_SDA, s3mini::I2C_SCL },
    .mpuInt        = s3mini::MPU_INT,
    .mpuIntPinMode = s3mini::MPU_INT_PINMODE,
    .mpuAddr       = s3mini::MPU_ADDR,
};
