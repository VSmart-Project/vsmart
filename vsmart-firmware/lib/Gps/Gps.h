#pragma once
#include <Arduino.h>
#include <TinyGPS++.h>

struct GpsFix {
    double lat = 0, lng = 0;
    float speedKmh = 0, headingDeg = -1, hdop = 99.99f;
    uint8_t satellites = 0;
    time_t utc = 0;
    uint32_t ageMs = UINT32_MAX;
    bool valid = false;
};

// A value copy under the reader mutex: never exposes TinyGPS++ across tasks.
struct GpsSnapshot {
    GpsFix fix;
    bool silent = true, baudLocked = false, gsvFresh = false;
    uint32_t baud = 0, chars = 0, passed = 0, failed = 0;
    uint8_t fixType = 0, solution = 0, inView = 0, tracked = 0, snr = 0;
    float hdopGsa = 99.99f, pdop = 99.99f;
    bool hasLastKnown = false;
    GpsFix lastKnown;
    char talkers[32] = {}, lastGga[128] = {};
};

class GpsService {
  public:
    void begin();
    bool startReader(); // FreeRTOS task; call before any network connection.
    void poll();        // Reader task only; host tests feed UART through this.
    GpsSnapshot snapshot() const;
    GpsFix read() const { return snapshot().fix; }
    bool hasQualityFix() const { return read().valid; }
    bool isSilent() const { return snapshot().silent; }
    uint32_t baud() const { return snapshot().baud; }
    bool baudLocked() const { return snapshot().baudLocked; }
    uint32_t charsProcessed() const { return snapshot().chars; }
    uint8_t satellites() const { return read().satellites; }
    float hdop() const { return read().hdop; }
    uint8_t fixType() const { return snapshot().fixType; }
    float hdopGsa() const { return snapshot().hdopGsa; }
    float pdop() const { return snapshot().pdop; }
    uint8_t satellitesInSolution() const { return snapshot().solution; }
    uint8_t satellitesInView() const { return snapshot().inView; }
    uint8_t satellitesTracked() const { return snapshot().tracked; }
    uint8_t bestSnrDb() const { return snapshot().snr; }
    static double distanceBetween(double a, double b, double c, double d) {
        return TinyGPSPlus::distanceBetween(a, b, c, d);
    }

  private:
    void consume(char c);
    void sentence();
    void nextBaudCandidate();
    bool quality(uint32_t now) const;
    struct Satellite {
        uint16_t id = 0;
        uint8_t snr = 0;
    };
    struct Group {
        char talker[3] = {};
        int signal = -1;
        uint8_t expected = 0, total = 0, count = 0, pendingCount = 0;
        uint8_t inView = 0, pendingView = 0;
        bool complete = false;
        uint32_t at = 0, started = 0;
        Satellite sats[64] = {}, pending[64] = {};
    };
    struct Solution {
        char talker[3] = {};
        int system = -1;
        uint8_t type = 0, used = 0;
        float hdop = 99.99f, pdop = 99.99f;
        uint32_t at = 0;
    };
    HardwareSerial *_uart = nullptr;
    Group _groups[12] = {};
    Solution _solutions[8] = {};
    GpsFix _gga, _lastKnown;
    bool _ggaSeen = false, _ggaValid = false, _rmcSeen = false, _rmcValid = false;
    bool _hasLastKnown = false, _baudLocked = false;
    uint32_t _ggaAt = 0, _rmcAt = 0, _lastKnownAt = 0;
    uint32_t _lastCharMs = 0, _lastValidMs = 0, _baudSinceMs = 0;
    uint32_t _chars = 0, _passed = 0, _failed = 0;
    uint32_t _baud = 0, _ggaTime = UINT32_MAX, _rmcTime = UINT32_MAX;
    time_t _rmcUtc = 0;
    float _speed = 0, _heading = -1;
    uint8_t _baudIdx = 0;
    char _ggaTalker[3] = {}, _rmcTalker[3] = {};
    char _line[128] = {}, _lastGga[128] = {}, _talkers[32] = {};
    size_t _lineLen = 0;
};
extern GpsService Gps;
