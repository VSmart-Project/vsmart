#pragma once
// GPS-only build: UART GPS -> Wi-Fi / mutual TLS -> AWS IoT. LTE/IMU deferred.
#define TOPIC_PUBLISH_LOCATION   "location"
#define TOPIC_DEVICE_CMD_FMT     "devices/%s/cmd"
#define TOPIC_DEVICE_STATUS_FMT  "devices/%s/status"
#define STATUS_PUBLISH_MS        30000UL
#define MQTT_PORT               8883
#define MQTT_KEEPALIVE_S         60
#define MQTT_BUFFER_BYTES       1280
// Send the CURRENT quality fix every 3 s, even when parked. No distance or
// speed gate: those filters hid short/slow motion during GPS bring-up.
#define PUBLISH_TICK_MS          3000UL
#define SPEED_DEADBAND_KMH       1.5
#define WIFI_CONNECT_TIMEOUT_MS 20000UL
#define LINK_RETRY_BACKOFF_MS    15000UL
#define WDT_TIMEOUT_S           90
#define NTP_TZ_OFFSET_S          (7 * 3600)
#define NTP_SERVER_1            "pool.ntp.org"
#define NTP_SERVER_2            "time.nist.gov"
#define GPS_MAX_FIX_AGE_MS       5000UL
#define GPS_MIN_SATELLITES       4
#define GPS_MAX_HDOP             5.0
#define GPS_NO_DATA_TIMEOUT_MS   30000UL
#define GPS_DIAGNOSTIC_AGE_MS    10000UL
#define GPS_BAUD_PROBE_MS        3000UL
#define GPS_ECHO_NMEA            0
#define LOG_LEVEL               3
#define SERIAL_BAUD             115200
