#include "Cloud.h"
#include "app_config.h"
#include "secrets.h"
#include <Gps.h>
#include <Log.h>
#include <Watchdog.h>
#include <sys/time.h>

#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

static const char *TAG = "cloud";

CloudLink Cloud;

static WiFiClientSecure tlsClient;
static PubSubClient mqtt(tlsClient);
static void (*g_userCb)(const char *, const char *) = nullptr;

static void mqttCallback(char *topic, byte *payload, unsigned int len) {
    if (!g_userCb)
        return;
    String s;
    s.reserve(len + 1);
    for (unsigned int i = 0; i < len; i++)
        s += (char)payload[i];
    g_userCb(topic, s.c_str());
}

void CloudLink::onMessage(void (*cb)(const char *topic, const char *payload)) {
    g_userCb = cb;
    mqtt.setCallback(mqttCallback);
}

int CloudLink::rssiDbm() const { return WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0; }

bool CloudLink::timeSynced() const {
    time_t now = time(nullptr);
    return now > 1600000000LL && now < 4102444800LL;
}

// TLS needs a correct clock, otherwise every certificate reads as "not yet
// valid" and the handshake fails with a confusing error.
bool CloudLink::syncTimeOverNtp() {
    configTime(NTP_TZ_OFFSET_S, 0, NTP_SERVER_1, NTP_SERVER_2);
    time_t now = time(nullptr);
    unsigned long deadline = millis() + 15000;
    while (!timeSynced() && (long)(millis() - deadline) < 0) {
        wdtDelay(250);
        now = time(nullptr);
    }
    if (!timeSynced()) {
        const auto fix = Gps.read();
        if (fix.valid && fix.utc > 1600000000LL && fix.utc < 4102444800LL) {
            timeval tv{};
            tv.tv_sec = fix.utc + fix.ageMs / 1000;
            if (settimeofday(&tv, nullptr) == 0) {
                LOGI(TAG, "System clock initialized from fresh GPS UTC");
                return true;
            }
        }
        LOGW(TAG, "Waiting for NTP or fresh GPS UTC before TLS");
        return false;
    }
    LOGI(TAG, "NTP synced: %ld", (long)now);
    return true;
}

bool CloudLink::connect() {
    if (WiFi.status() != WL_CONNECTED) {
        WiFi.mode(WIFI_STA);
        WiFi.setSleep(false); // Wi-Fi sleep adds hundreds of ms of uplink latency
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

        LOGI(TAG, "Joining Wi-Fi \"%s\"", WIFI_SSID);
        unsigned long deadline = millis() + WIFI_CONNECT_TIMEOUT_MS;
        while (WiFi.status() != WL_CONNECTED && (long)(millis() - deadline) < 0) {
            wdtDelay(250);
        }
        if (WiFi.status() != WL_CONNECTED) {
            LOGW(TAG, "Wi-Fi did not come up within %lu ms",
                 (unsigned long)WIFI_CONNECT_TIMEOUT_MS);
            WiFi.disconnect(true);
            return false;
        }
        LOGI(TAG, "Wi-Fi up: %s, %d dBm", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }

    if (!timeSynced() && !syncTimeOverNtp())
        return false;

    tlsClient.setCACert(AWS_CERT_CA);
    tlsClient.setCertificate(AWS_CERT_CRT);
    tlsClient.setPrivateKey(AWS_CERT_PRIVATE);

    // Cap the TLS handshake. The default lets a half-open connection hold the
    // loop for far longer than the watchdog allows, and every retry costs heap
    // that a 20 KB free pool cannot spare.
    tlsClient.setHandshakeTimeout(15);

    mqtt.setServer(AWS_IOT_ENDPOINT, MQTT_PORT);
    mqtt.setKeepAlive(MQTT_KEEPALIVE_S);
    if (!mqtt.setBufferSize(MQTT_BUFFER_BYTES)) {
        LOGE(TAG, "Cannot allocate MQTT buffer");
        return false;
    }
    mqtt.setCallback(mqttCallback);
    mqtt.setSocketTimeout(5);

    if (mqtt.connect(AWS_IOT_CLIENT_ID)) {
        ++_session;
        LOGI(TAG, "AWS IoT connected (client %s)", AWS_IOT_CLIENT_ID);
        return true;
    }
    LOGW(TAG, "MQTT connection failed (state=%d); retry after backoff", mqtt.state());
    return false;
}

void CloudLink::begin() {
    if (!connect()) {
        _nextRetryMs = millis() + LINK_RETRY_BACKOFF_MS;
        LOGW(TAG, "No uplink yet; GPS reader continues while waiting to reconnect");
    }
}

bool CloudLink::ready() const { return WiFi.status() == WL_CONNECTED && mqtt.connected(); }

void CloudLink::loop() {
    mqtt.loop();

    if (ready()) {
        _failStreak = 0;
        return;
    }

    // Do not hammer the reconnect path: loop() runs every few milliseconds, and
    // without this gate _failStreak races upward over a link that only blinked.
    if (_nextRetryMs && (long)(millis() - _nextRetryMs) < 0)
        return;

    _failStreak++;
    LOGW(TAG, "Uplink down (attempt %lu), reconnecting", (unsigned long)_failStreak);
    connect();
    _nextRetryMs = millis() + LINK_RETRY_BACKOFF_MS;
}

bool CloudLink::publish(const char *topic, const char *payload) {
    return ready() && mqtt.publish(topic, payload);
}

bool CloudLink::subscribe(const char *topic) { return ready() && mqtt.subscribe(topic); }
