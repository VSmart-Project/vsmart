// Watchdog.h — Feed the task watchdog from inside long blocking waits.
//
// Wi-Fi association plus the NTP wait can block tens of seconds. Without
// wdtFeed() inside those loops the device resets while it is coming online —
// and then does it again, forever. The LTE driver in attic/ needs this even
// more: modem bring-up alone can block about two minutes.
#pragma once
#include <Arduino.h>
#include <esp_task_wdt.h>

// esp_task_wdt_reset() returns ESP_ERR_NOT_FOUND when the current task is not
// subscribed; ignoring the result keeps this safe to call from anywhere.
static inline void wdtFeed() { (void)esp_task_wdt_reset(); }

// delay() already feeds the watchdog. Use this instead of delay() in long waits.
static inline void wdtDelay(uint32_t ms) {
    const uint32_t step = 200;
    while (ms > step) { delay(step); wdtFeed(); ms -= step; }
    delay(ms);
    wdtFeed();
}
