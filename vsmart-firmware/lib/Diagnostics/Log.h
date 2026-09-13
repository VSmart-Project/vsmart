// Log.h — Levelled logging with a per-module tag. Compiles away at LOG_LEVEL 0.
#pragma once
#include <Arduino.h>
#include "app_config.h"

#if LOG_LEVEL > 0
  #define LOG_RAW(tag, lvl, fmt, ...) \
      Serial.printf("[%8lu][%s][%s] " fmt "\n", millis(), lvl, tag, ##__VA_ARGS__)
#else
  #define LOG_RAW(tag, lvl, fmt, ...) do {} while (0)
#endif

#if LOG_LEVEL >= 1
  #define LOGE(tag, fmt, ...) LOG_RAW(tag, "E", fmt, ##__VA_ARGS__)
#else
  #define LOGE(tag, fmt, ...) do {} while (0)
#endif

#if LOG_LEVEL >= 2
  #define LOGW(tag, fmt, ...) LOG_RAW(tag, "W", fmt, ##__VA_ARGS__)
#else
  #define LOGW(tag, fmt, ...) do {} while (0)
#endif

#if LOG_LEVEL >= 3
  #define LOGI(tag, fmt, ...) LOG_RAW(tag, "I", fmt, ##__VA_ARGS__)
#else
  #define LOGI(tag, fmt, ...) do {} while (0)
#endif

#if LOG_LEVEL >= 4
  #define LOGD(tag, fmt, ...) LOG_RAW(tag, "D", fmt, ##__VA_ARGS__)
#else
  #define LOGD(tag, fmt, ...) do {} while (0)
#endif
