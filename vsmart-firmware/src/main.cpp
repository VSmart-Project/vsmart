#include <Arduino.h>
#include <Commands.h>
#include <esp_idf_version.h>
#include <esp_system.h>
#include <esp_task_wdt.h>

#include <Board.h>
#include <Cloud.h>
#include <Gps.h>
#include <Log.h>
#include <Telemetry.h>

#include "app_config.h"
#include "secrets.h"

static const char *TAG = "main";

static unsigned long lastTickMs = 0;
static unsigned long lastStatusMs = 0;
static unsigned long lastGgaMs = 0;
static bool commandSubscribed = false;
static uint32_t commandSession = 0;
static unsigned long lastSubscribeMs = 0;

static void onCloudMessage(const char *topic, const char *payload) {
    LOGI(TAG, "Received on %s: %s", topic, payload);

    char expected[128];
    snprintf(expected, sizeof(expected), TOPIC_DEVICE_CMD_FMT, VSMART_DEVICE_ID);
    if (strcmp(topic, expected) != 0)
        return;
    DeviceCommand command = parseDeviceCommand(payload);
    if (command == DeviceCommand::Reboot) {
        LOGW(TAG, "Cloud requested a reboot");
        delay(200);
        esp_restart();
    } else if (command == DeviceCommand::Ping) {
        Telemetry.publishNow("cloud_ping");
    } else {
        LOGW(TAG, "Unknown command");
    }
}

static void subscribeAll() {
    char topic[128];
    snprintf(topic, sizeof(topic), TOPIC_DEVICE_CMD_FMT, VSMART_DEVICE_ID);
    commandSubscribed = Cloud.subscribe(topic);
    commandSession = Cloud.session();
    lastSubscribeMs = millis();
    if (commandSubscribed)
        LOGI(TAG, "Subscription requested: %s", topic);
    else
        LOGW(TAG, "Subscription request failed: %s", topic);
}

static void printBanner() {
    Serial.println();
    Serial.println("========================================================");
    Serial.printf("  VSMART TRACKER — %s\n", BOARD.name);
    Serial.printf("  build      : %s %s\n", __DATE__, __TIME__);
    Serial.printf("  device id  : %s\n", VSMART_DEVICE_ID);
    Serial.printf("  mqtt client: %s\n", AWS_IOT_CLIENT_ID);
    Serial.printf("  endpoint   : %s:%d\n", AWS_IOT_ENDPOINT, MQTT_PORT);
    Serial.printf("  topic      : %s\n", TOPIC_PUBLISH_LOCATION);
    Serial.printf("  reset      : %d\n", (int)esp_reset_reason());
    Serial.println("--------------------------------------------------------");
    Serial.printf("  GPS  U3  RX=GPIO%-2d TX=GPIO%-2d @%lu bps\n", BOARD.gps.rx, BOARD.gps.tx,
                  (unsigned long)BOARD.gps.baud);
    Serial.println("  LTE modem / IMU: not in this build (see attic/)");
    Serial.println("--------------------------------------------------------");
    Serial.printf("  A frame is published only when sats >= %d AND hdop <= %.1f\n",
                  GPS_MIN_SATELLITES, (float)GPS_MAX_HDOP);
    Serial.println("  Weaker fixes are still printed here, just not sent.");
    Serial.println("========================================================");
    Serial.println();
}

// ── setup ───────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(500);
    printBanner();

#if ESP_IDF_VERSION_MAJOR >= 5
    esp_task_wdt_config_t wdtCfg = {
        .timeout_ms = WDT_TIMEOUT_S * 1000,
        .idle_core_mask = 0,
        .trigger_panic = true,
    };
    esp_task_wdt_reconfigure(&wdtCfg);
#else
    esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
    esp_task_wdt_add(NULL);

    Gps.begin();
    if (!Gps.startReader()) {
        LOGE(TAG, "Cannot start GPS reader task");
        delay(1000);
        esp_restart();
        return;
    }
    Telemetry.begin();

    Cloud.onMessage(onCloudMessage);
    Cloud.begin();
    if (Cloud.ready())
        subscribeAll();

    esp_task_wdt_reset();
}

void loop() {
    esp_task_wdt_reset();

    Cloud.loop();
    if (!Cloud.ready())
        commandSubscribed = false;
    if (Cloud.ready() && (Cloud.session() != commandSession ||
                          (!commandSubscribed && millis() - lastSubscribeMs >= 5000UL)))
        subscribeAll();

    unsigned long now = millis();
    if (now - lastTickMs >= PUBLISH_TICK_MS) {
        lastTickMs = now;
        Telemetry.tick();
    }

    if (now - lastStatusMs >= STATUS_PUBLISH_MS) {
        lastStatusMs = now;

        // Same information, two destinations: the serial line for when a cable
        // is attached, and devices/<id>/status for when the device runs on
        // external power and the only way to see it is the AWS IoT console.
        Telemetry.publishHealth();

        auto gps = Gps.snapshot();
        LOGI(TAG,
             "status: mqtt=%s gps@%lu quality=%u used=%u hdop=%.2f valid=%lu bad=%lu sent=%lu "
             "lost=%lu",
             Cloud.ready() ? "up" : "down", (unsigned long)gps.baud, gps.fix.valid,
             gps.fix.satellites, gps.fix.hdop, (unsigned long)gps.passed, (unsigned long)gps.failed,
             (unsigned long)Telemetry.published(), (unsigned long)Telemetry.dropped());
        if (!gps.fix.valid && gps.lastGga[0] && now - lastGgaMs >= 30000UL) {
            lastGgaMs = now;
            Serial.printf("        raw: %s\n", gps.lastGga);
        }
    }

    delay(5);
}
