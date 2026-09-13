#pragma once
#include <Arduino.h>
#include <Gps.h>

class TelemetryService {
  public:
    void begin();
    void tick();
    void publishNow(const char *reason);
    void publishHealth();
    uint32_t published() const { return _published; }
    uint32_t dropped() const { return _dropped; }

  private:
    size_t buildPayload(const GpsFix &, const char *, char *, size_t);
    time_t bestTimestamp(const GpsFix &) const;
    bool send(const char *, size_t);
    uint32_t _published = 0, _dropped = 0;
};
extern TelemetryService Telemetry;
