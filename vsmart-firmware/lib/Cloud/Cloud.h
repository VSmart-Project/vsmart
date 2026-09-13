// Cloud.h — Wi-Fi + TLS + MQTT to AWS IoT Core.
//
// GPS bring-up build: Wi-Fi is the only transport. The LTE fallback, the
// offline ring buffer and the transport-failover logic live in attic/ and are
// not compiled — see attic/README.md to bring them back.
#pragma once
#include <Arduino.h>

class CloudLink {
  public:
    void begin();
    void loop(); // pumps MQTT keepalive, reconnects when dropped

    bool ready() const;
    bool publish(const char *topic, const char *payload);
    bool subscribe(const char *topic);

    int rssiDbm() const;

    // Reads the actual system clock rather than the bring-up flag. The SNTP
    // daemon keeps running after syncTimeOverNtp() gives up, so the clock is
    // often correct a few seconds after that timeout was reported — a latched
    // flag would keep claiming "no" for the rest of the session.
    bool timeSynced() const;
    uint32_t consecutiveFailures() const { return _failStreak; }

    uint32_t session() const { return _session; }

    void onMessage(void (*cb)(const char *topic, const char *payload));

  private:
    uint32_t _session = 0;
    bool connect();
    bool syncTimeOverNtp();

    uint32_t _failStreak = 0;
    unsigned long _nextRetryMs = 0;
};

extern CloudLink Cloud;
