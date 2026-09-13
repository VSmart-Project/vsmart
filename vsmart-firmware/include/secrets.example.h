// secrets.example.h — Copy to secrets.h and fill in. secrets.h is gitignored.
//
// Certificates: AWS IoT Core -> Manage -> Things -> <thing> -> Certificates.
// PEM strings must keep their line breaks — use raw string literals as below.
#ifndef SECRETS_H
#define SECRETS_H

#include <pgmspace.h>

// ── Wi-Fi (the only transport in the GPS bring-up build) ────────────────────
const char WIFI_SSID[]     = "replace-with-wifi-ssid";
const char WIFI_PASSWORD[] = "replace-with-wifi-password";

// ── AWS IoT Core ────────────────────────────────────────────────────────────
// Endpoint: aws iot describe-endpoint --endpoint-type iot:Data-ATS
const char AWS_IOT_ENDPOINT[] = "xxxxxxxxxxxxxx-ats.iot.ap-southeast-1.amazonaws.com";

// MQTT client ID. Conventionally the IoT thing name.
const char AWS_IOT_CLIENT_ID[] = "replace-with-thing-name";

// The identifier that goes into payload.deviceid. This is what the Lambda
// writes into the Location Service tracker and what the backend keys devices
// on — it is NOT necessarily the same string as the MQTT client ID, and
// changing it starts a brand-new device track.
const char VSMART_DEVICE_ID[] = "replace-with-device-id";

const char AWS_CERT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
replace-with-amazon-root-ca-1
-----END CERTIFICATE-----
)EOF";

const char AWS_CERT_CRT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
replace-with-device-certificate
-----END CERTIFICATE-----
)EOF";

const char AWS_CERT_PRIVATE[] PROGMEM = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
replace-with-device-private-key
-----END RSA PRIVATE KEY-----
)EOF";

#endif
