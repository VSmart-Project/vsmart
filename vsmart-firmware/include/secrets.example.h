#ifndef SECRETS_H
#define SECRETS_H

#include <pgmspace.h>

const char WIFI_SSID[] = "replace-with-wifi-ssid";
const char WIFI_PASSWORD[] = "replace-with-wifi-password";
const char AWS_IOT_ENDPOINT[] = "replace-with-iot-endpoint";
const char AWS_IOT_CLIENT_ID[] = "replace-with-unique-device-id";

const char AWS_CERT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
replace-with-amazon-root-ca
-----END CERTIFICATE-----
)EOF";

const char AWS_CERT_CRT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
replace-with-device-certificate
-----END CERTIFICATE-----
)EOF";

const char AWS_CERT_PRIVATE[] PROGMEM = R"EOF(
-----BEGIN PRIVATE KEY-----
replace-with-device-private-key
-----END PRIVATE KEY-----
)EOF";

#endif
