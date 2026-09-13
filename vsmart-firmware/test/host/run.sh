#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
bin=$(mktemp /tmp/vsmart-gps-regression.XXXXXX)
trap 'rm -f "$bin"' EXIT
c++ -std=c++17 -Wall -Wextra -DGPS_HOST_TEST -DARDUINO=10819 \
 -DARDUINOJSON_ENABLE_ARDUINO_STRING=0 -DARDUINOJSON_ENABLE_ARDUINO_STREAM=0 -DARDUINOJSON_ENABLE_ARDUINO_PRINT=0 -DARDUINOJSON_ENABLE_PROGMEM=0 \
 -I test/host/stubs -I include -I lib/Board -I lib/Gps -I lib/Telemetry -I lib/Diagnostics -I lib/Commands \
 -I .pio/libdeps/devkitc/TinyGPSPlus/src -I .pio/libdeps/devkitc/ArduinoJson/src \
 test/host/gps_regression.cpp lib/Gps/Gps.cpp lib/Telemetry/Telemetry.cpp \
 .pio/libdeps/devkitc/TinyGPSPlus/src/TinyGPS++.cpp -o "$bin"
"$bin"
