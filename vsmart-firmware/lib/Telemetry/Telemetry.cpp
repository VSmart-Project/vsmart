#include "Telemetry.h"
#include "app_config.h"
#include "secrets.h"
#include <ArduinoJson.h>
#include <Board.h>
#include <Cloud.h>
#include <Log.h>
#include <cmath>
#include <time.h>

static const char *TAG = "tele";
TelemetryService Telemetry;
void TelemetryService::begin() { _published = _dropped = 0; }

time_t TelemetryService::bestTimestamp(const GpsFix &fix) const {
    time_t sys = time(nullptr);
    bool systemValid = sys > 1600000000LL && sys < 4102444800LL;
    bool gpsValid = fix.utc > 1600000000LL && fix.utc < 4102444800LL;
    // Prefer the receiver's sample time only if it agrees with a sane system
    // clock. A stale date/rollover must not poison history with a far-off day.
    if (gpsValid && (!systemValid || llabs((long long)fix.utc - sys) <= 30))
        return fix.utc;
    if (systemValid && fix.ageMs <= GPS_MAX_FIX_AGE_MS)
        return sys - fix.ageMs / 1000;
    return 0;
}
size_t TelemetryService::buildPayload(const GpsFix &fix, const char *reason, char *out,
                                      size_t capacity) {
    if (!fix.valid || !std::isfinite(fix.lat) || !std::isfinite(fix.lng))
        return 0;
    time_t stamp = bestTimestamp(fix);
    if (!stamp) {
        LOGW(TAG, "No valid sample timestamp; position not sent");
        return 0;
    }
    JsonDocument doc;
    JsonObject p = doc["payload"].to<JsonObject>();
    p["deviceid"] = VSMART_DEVICE_ID;
    p["timestamp"] = (int64_t)stamp;
    auto loc = p["location"].to<JsonObject>();
    loc["lat"] = round(fix.lat * 1e6) / 1e6;
    loc["long"] = round(fix.lng * 1e6) / 1e6;
    // Heuristic, not a receiver-provided horizontal accuracy estimate. Always
    // use the same fresh GGA HDOP as the quality gate; GSA stays diagnostic.
    p["accuracy"]["Horizontal"] = round(fix.hdop * 50.0) / 10.0;
    float speed = fix.speedKmh < SPEED_DEADBAND_KMH ? 0 : fix.speedKmh;
    char speedText[24], headingText[24];
    snprintf(speedText, sizeof(speedText), "%.2f", speed);
    auto props = p["positionProperties"].to<JsonObject>();
    props["speed"] = speedText;
    if (fix.headingDeg >= 0 && speed > 0) {
        snprintf(headingText, sizeof(headingText), "%.1f", fix.headingDeg);
        props["heading"] = headingText;
    }
    props["status"] = speed > 0 ? "moving" : "stationary";
    props["reason"] = reason;
    // Amazon Location permits four properties. GPS diagnostics belong in health.
    if (doc.overflowed() || measureJson(doc) >= capacity)
        return 0;
    return serializeJson(doc, out, capacity);
}
bool TelemetryService::send(const char *payload, size_t length) {
    if (Cloud.publish(TOPIC_PUBLISH_LOCATION, payload)) {
        ++_published;
        LOGI(TAG, "MQTT wrote %u bytes to '%s'", (unsigned)length, TOPIC_PUBLISH_LOCATION);
        return true;
    }
    ++_dropped;
    LOGW(TAG, "Position not sent: uplink unavailable (%lu)", (unsigned long)_dropped);
    return false;
}
void TelemetryService::publishNow(const char *reason) {
    GpsFix fix = Gps.read();
    if (!fix.valid) {
        LOGW(TAG, "%s: no current quality fix; returning health", reason);
        publishHealth();
        return;
    }
    char out[MQTT_BUFFER_BYTES - 128];
    size_t n = buildPayload(fix, reason, out, sizeof(out));
    if (n)
        send(out, n);
}
void TelemetryService::tick() {
    auto s = Gps.snapshot();
    if (!s.fix.valid) {
        LOGI(TAG,
             "GPS waiting: silent=%u locked=%u used=%u hdop=%.2f age=%lu gsv=%s in_view=%u "
             "tracked=%u cn0=%u valid=%lu bad=%lu",
             s.silent, s.baudLocked, s.fix.satellites, s.fix.hdop, (unsigned long)s.fix.ageMs,
             s.gsvFresh ? "fresh" : "unknown", s.inView, s.tracked, s.snr, (unsigned long)s.passed,
             (unsigned long)s.failed);
        return;
    }
    // GPS-only bring-up streams each valid sample every PUBLISH_TICK_MS. Slow
    // movement and a stop at a new location must not be hidden by old coordinates.
    char out[MQTT_BUFFER_BYTES - 128];
    size_t n = buildPayload(s.fix, _published ? "sample" : "first_fix", out, sizeof(out));
    if (n) {
        LOGI(TAG, "GPS %.6f, %.6f speed=%.2f sats=%u hdop=%.2f", s.fix.lat, s.fix.lng,
             s.fix.speedKmh, s.fix.satellites, s.fix.hdop);
        send(out, n);
    }
}
void TelemetryService::publishHealth() {
    if (!Cloud.ready())
        return;
    auto s = Gps.snapshot();
    JsonDocument doc;
    doc["deviceid"] = VSMART_DEVICE_ID;
    doc["uptimeS"] = millis() / 1000;
    doc["board"] = BOARD.name;
    doc["build"] = __DATE__ " " __TIME__;
    auto net = doc["net"].to<JsonObject>();
    net["wifi"] = "up";
    net["rssi"] = Cloud.rssiDbm();
    net["ntp"] = Cloud.timeSynced();
    auto g = doc["gps"].to<JsonObject>();
    g["fix"] = s.fixType == 3 ? "3D" : s.fixType == 2 ? "2D" : s.fixType == 1 ? "none" : "unknown";
    g["valid"] = s.fix.valid;
    g["used"] = s.fix.satellites;
    g["solution"] = s.solution;
    g["tracked"] = s.tracked;
    g["inView"] = s.inView;
    g["snr"] = s.snr;
    g["gsvFresh"] = s.gsvFresh;
    g["hdop"] = s.fix.hdop;
    g["hdopGsa"] = s.hdopGsa;
    if (s.fix.ageMs != UINT32_MAX)
        g["ageMs"] = s.fix.ageMs;
    g["baud"] = s.baud;
    g["locked"] = s.baudLocked;
    g["talkers"] = s.talkers;
    g["nmea"] = s.chars;
    g["passed"] = s.passed;
    g["failed"] = s.failed;
    g["silent"] = s.silent;
    if (s.hasLastKnown) {
        auto last = doc["lastKnown"].to<JsonObject>();
        last["lat"] = s.lastKnown.lat;
        last["long"] = s.lastKnown.lng;
        last["ageS"] = s.lastKnown.ageMs / 1000;
    }
    doc["tele"]["sent"] = _published;
    doc["tele"]["dropped"] = _dropped;
    doc["mem"]["heapFree"] = ESP.getFreeHeap();
    doc["mem"]["heapMinEver"] = ESP.getMinFreeHeap();
    doc["mem"]["heapLargest"] = ESP.getMaxAllocHeap();
    char topic[128], out[MQTT_BUFFER_BYTES - 160];
    int t = snprintf(topic, sizeof(topic), TOPIC_DEVICE_STATUS_FMT, VSMART_DEVICE_ID);
    if (t < 0 || size_t(t) >= sizeof(topic) || doc.overflowed() ||
        measureJson(doc) >= sizeof(out)) {
        LOGW(TAG, "Health payload/topic too large; not sent");
        return;
    }
    size_t n = serializeJson(doc, out, sizeof(out));
    LOGI(TAG, "health %s (%u bytes)", Cloud.publish(topic, out) ? "sent" : "failed", (unsigned)n);
}
