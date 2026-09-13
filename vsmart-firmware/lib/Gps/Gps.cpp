#include "Gps.h"
#include "app_config.h"
#include <Board.h>
#include <Log.h>
#include <cmath>
#include <cstdlib>
#include <cstring>
#ifndef GPS_HOST_TEST
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
static SemaphoreHandle_t gpsMutex = nullptr;
static TaskHandle_t gpsTask = nullptr;
struct GpsGuard {
    GpsGuard() {
        if (gpsMutex)
            xSemaphoreTake(gpsMutex, portMAX_DELAY);
    }
    ~GpsGuard() {
        if (gpsMutex)
            xSemaphoreGive(gpsMutex);
    }
};
#else
struct GpsGuard {
    ~GpsGuard() {}
};
#endif
static const char *TAG = "gps";
GpsService Gps;
static time_t utcFromTm(const struct tm &t) {
    int y = t.tm_year + 1900;
    unsigned m = (unsigned)t.tm_mon + 1;
    unsigned d = (unsigned)t.tm_mday;
    y -= m <= 2;
    const int era = (y >= 0 ? y : y - 399) / 400;
    const unsigned yoe = (unsigned)(y - era * 400);
    const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
    const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    const long long days = (long long)era * 146097 + (long long)doe - 719468;
    return (time_t)(days * 86400LL + t.tm_hour * 3600LL + t.tm_min * 60LL + t.tm_sec);
}

namespace {
const uint32_t rates[] = {9600, 38400, 115200, 57600, 19200, 4800};
bool fresh(uint32_t now, uint32_t at, uint32_t age = GPS_MAX_FIX_AGE_MS) {
    return uint32_t(now - at) <= age;
}
int hex(char c) {
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    return -1;
}
bool number(const char *s, double &value) {
    if (!s || !*s)
        return false;
    for (const char *p = s; *p; ++p)
        if ((*p < '0' || *p > '9') && *p != '.')
            return false;
    char *end;
    value = strtod(s, &end);
    return !*end && std::isfinite(value) && value >= 0;
}
int integer(const char *s, int maximum) {
    double n;
    return number(s, n) && n <= maximum && floor(n) == n ? int(n) : -1;
}
uint32_t clockField(const char *s) {
    if (strlen(s) < 6)
        return UINT32_MAX;
    if (s[6]) {
        if (s[6] != '.' || !s[7])
            return UINT32_MAX;
        for (const char *p = s + 7; *p; ++p)
            if (*p < '0' || *p > '9')
                return UINT32_MAX;
    }
    for (int i = 0; i < 6; i++)
        if (s[i] < '0' || s[i] > '9')
            return UINT32_MAX;
    int h = (s[0] - '0') * 10 + s[1] - '0', m = (s[2] - '0') * 10 + s[3] - '0',
        sec = (s[4] - '0') * 10 + s[5] - '0';
    return h < 24 && m < 60 && sec < 60 ? h * 3600 + m * 60 + sec : UINT32_MAX;
}
} // namespace
void GpsService::begin() {
#ifndef GPS_HOST_TEST
    if (!gpsMutex)
        gpsMutex = xSemaphoreCreateMutex();
#endif
    GpsGuard guard;
    static HardwareSerial serial(BOARD.gps.port);
    _uart = &serial;
    for (uint8_t i = 0; i < sizeof(rates) / sizeof(rates[0]); i++)
        if (rates[i] == BOARD.gps.baud)
            _baudIdx = i;
    _baud = rates[_baudIdx];
    _uart->setRxBufferSize(4096);
    _uart->begin(_baud, SERIAL_8N1, BOARD.gps.rx, BOARD.gps.tx);
    _lastCharMs = _lastValidMs = _baudSinceMs = millis();
    LOGI(TAG, "UART%u RX=GPIO%d TX=GPIO%d @%lu (probing)", BOARD.gps.port, BOARD.gps.rx,
         BOARD.gps.tx, (unsigned long)_baud);
}
bool GpsService::startReader() {
#ifndef GPS_HOST_TEST
    if (!gpsMutex)
        return false;
    if (gpsTask)
        return true;
    return xTaskCreate(
               [](void *context) {
                   auto *gps = static_cast<GpsService *>(context);
                   for (;;) {
                       gps->poll();
                       vTaskDelay(pdMS_TO_TICKS(5));
                   }
               },
               "gps-reader", 4096, this, 2, &gpsTask) == pdPASS;
#else
    return true;
#endif
}
void GpsService::nextBaudCandidate() {
    _baudIdx = (_baudIdx + 1) % (sizeof(rates) / sizeof(rates[0]));
    _baud = rates[_baudIdx];
    _uart->updateBaudRate(_baud);
    // Discard bytes queued at the old baud. Never let stale input lock a new rate.
    for (int n = _uart->available(); n > 0; --n)
        _uart->read();
    _lineLen = 0;
    _baudSinceMs = millis();
    _ggaSeen = _rmcSeen = false;
    for (auto &g : _groups)
        g = Group{};
    for (auto &s : _solutions)
        s = Solution{};
    LOGW(TAG, "Probing GPS @%lu", (unsigned long)_baud);
}
void GpsService::poll() {
    GpsGuard guard;
    if (!_uart)
        return;
    // Bound each critical section even if input is continuous.
    for (int i = 0; i < 512 && _uart->available(); i++) {
        char c = char(_uart->read());
        ++_chars;
        _lastCharMs = millis();
        consume(c);
    }
    uint32_t now = millis();
    if (_ggaSeen && !fresh(now, _ggaAt))
        _ggaValid = false;
    if (_rmcSeen && !fresh(now, _rmcAt))
        _rmcSeen = false;
    for (auto &group : _groups)
        if (group.complete && !fresh(now, group.at, GPS_DIAGNOSTIC_AGE_MS))
            group.complete = false;
    for (auto &solution : _solutions)
        if (*solution.talker && !fresh(now, solution.at, GPS_DIAGNOSTIC_AGE_MS))
            solution = Solution{};
    if (_baudLocked && !fresh(now, _lastValidMs, GPS_NO_DATA_TIMEOUT_MS)) {
        _baudLocked = false;
        _baudSinceMs = now;
        LOGW(TAG, "No checksum-valid NMEA for 30 s; resuming baud probe");
    }
    if (!_baudLocked && !fresh(now, _baudSinceMs, GPS_BAUD_PROBE_MS))
        nextBaudCandidate();
}
void GpsService::consume(char c) {
    if (c == '$') {
        _lineLen = 0;
        _line[_lineLen++] = c;
        return;
    }
    if (!_lineLen)
        return;
    if (c == '\r' || c == '\n') {
        _line[_lineLen] = 0;
        sentence();
        _lineLen = 0;
        return;
    }
    if (_lineLen >= sizeof(_line) - 1) {
        ++_failed;
        _lineLen = 0;
        return;
    }
    _line[_lineLen++] = c;
}
void GpsService::sentence() {
    char *star = strchr(_line, '*');
    if (!star || strlen(star) != 3 || _lineLen < 9 || _line[6] != ',') {
        ++_failed;
        return;
    }
    unsigned sum = 0;
    for (char *p = _line + 1; p < star; p++)
        sum ^= (uint8_t)*p;
    int h = hex(star[1]), l = hex(star[2]);
    if (h < 0 || l < 0 || sum != unsigned(h * 16 + l)) {
        ++_failed;
        return;
    }
    ++_passed;
    _lastValidMs = millis();
    if (!_baudLocked) {
        _baudLocked = true;
        LOGI(TAG, "NMEA locked @%lu", (unsigned long)_baud);
    }
#if GPS_ECHO_NMEA
    Serial.printf("[nmea] %s\n", _line);
#endif
    char talker[3] = {_line[1], _line[2], 0};
    if (!strstr(_talkers, talker) && strlen(_talkers) + 4 < sizeof(_talkers)) {
        if (*_talkers)
            strcat(_talkers, ",");
        strcat(_talkers, talker);
    }
    if (!memcmp(_line + 3, "GGA", 3))
        snprintf(_lastGga, sizeof(_lastGga), "%s", _line);
    *star = 0;
    char *f[24] = {_line};
    size_t nf = 1;
    for (char *p = _line; p < star; p++)
        if (*p == ',') {
            *p = 0;
            if (nf < 24)
                f[nf++] = p + 1;
        }
    uint32_t now = millis();
    if (!strcmp(f[0] + 3, "GGA")) {
        strcpy(_ggaTalker, talker);
        _ggaSeen = true;
        _ggaAt = now;
        _ggaValid = false;
        _gga = GpsFix{};
        if (nf < 10)
            return;
        int q = integer(f[6], 8), sats = integer(f[7], 99);
        double hd, la, lo;
        _ggaTime = clockField(f[1]);
        if (sats >= 0)
            _gga.satellites = sats;
        if (number(f[8], hd) && hd > 0)
            _gga.hdop = hd;
        bool coords = number(f[2], la) && number(f[4], lo) &&
                      (!strcmp(f[3], "N") || !strcmp(f[3], "S")) &&
                      (!strcmp(f[5], "E") || !strcmp(f[5], "W"));
        if (q < 1 || q > 5 || sats < 0 || _ggaTime == UINT32_MAX || !coords)
            return;
        if (fmod(la, 100) >= 60 || fmod(lo, 100) >= 60)
            return;
        _gga.lat = floor(la / 100) + fmod(la, 100) / 60;
        _gga.lng = floor(lo / 100) + fmod(lo, 100) / 60;
        if (*f[3] == 'S')
            _gga.lat = -_gga.lat;
        if (*f[5] == 'W')
            _gga.lng = -_gga.lng;
        _ggaValid = std::isfinite(_gga.lat) && std::isfinite(_gga.lng) && fabs(_gga.lat) <= 90 &&
                    fabs(_gga.lng) <= 180;
    } else if (!strcmp(f[0] + 3, "RMC")) {
        strcpy(_rmcTalker, talker);
        _rmcSeen = true;
        _rmcAt = now;
        _rmcValid = nf > 9 && !strcmp(f[2], "A");
        _speed = 0;
        _heading = -1;
        _rmcUtc = 0;
        if (nf <= 9)
            return;
        _rmcTime = clockField(f[1]);
        _rmcValid = _rmcValid && _rmcTime != UINT32_MAX;
        double n;
        if (_rmcValid && number(f[7], n))
            _speed = n * 1.852;
        if (_rmcValid && number(f[8], n) && n < 360)
            _heading = n;
        if (_rmcTime != UINT32_MAX && strlen(f[9]) == 6 && integer(f[9], 999999) >= 0) {
            unsigned date = integer(f[9], 999999);
            unsigned year = 2000 + date % 100, month = (date / 100) % 100, day = date / 10000;
            static const uint8_t days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
            bool leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
            if (year >= 2020 && year <= 2099 && month >= 1 && month <= 12 && day >= 1 &&
                day <= days[month - 1] + (month == 2 && leap)) {
                tm t{};
                t.tm_year = year - 1900;
                t.tm_mon = month - 1;
                t.tm_mday = day;
                t.tm_hour = _rmcTime / 3600;
                t.tm_min = (_rmcTime / 60) % 60;
                t.tm_sec = _rmcTime % 60;
                _rmcUtc = utcFromTm(t);
            }
        }
    } else if (!strcmp(f[0] + 3, "GSA")) {
        if (nf < 18)
            return;
        int type = integer(f[2], 3);
        if (type < 1)
            return;
        int system = nf > 18 ? integer(f[18], 99) : -1;
        Solution *slot = nullptr;
        for (auto &s : _solutions)
            if (!strcmp(s.talker, talker) && s.system == system) {
                slot = &s;
                break;
            }
        if (!slot)
            for (auto &s : _solutions)
                if (!*s.talker || !fresh(now, s.at, GPS_DIAGNOSTIC_AGE_MS)) {
                    slot = &s;
                    break;
                }
        if (!slot)
            return;
        *slot = Solution{};
        strcpy(slot->talker, talker);
        slot->system = system;
        slot->at = now;
        slot->type = type;
        for (int i = 3; i <= 14; i++)
            if (integer(f[i], 999) > 0)
                slot->used++;
        double n;
        if (number(f[15], n) && n > 0)
            slot->pdop = n;
        if (number(f[16], n) && n > 0)
            slot->hdop = n;
    } else if (!strcmp(f[0] + 3, "GSV")) {
        if (nf < 4)
            return;
        int total = integer(f[1], 16), seq = integer(f[2], 16), view = integer(f[3], 64);
        if (total < 1 || seq < 1 || seq > total || view < 0)
            return;
        size_t remaining = nf - 4;
        int signal = remaining % 4 == 1 ? integer(f[nf - 1], 99) : -1;
        if (remaining % 4 > 1)
            return;
        size_t count = remaining / 4;
        if (count > 4)
            return;
        Group *slot = nullptr;
        for (auto &g : _groups)
            if (!strcmp(g.talker, talker) && g.signal == signal) {
                slot = &g;
                break;
            }
        if (!slot)
            for (auto &g : _groups)
                if (!*g.talker || (!fresh(now, g.at, GPS_DIAGNOSTIC_AGE_MS) &&
                                   !fresh(now, g.started, GPS_DIAGNOSTIC_AGE_MS))) {
                    slot = &g;
                    *slot = Group{};
                    break;
                }
        if (!slot)
            return;
        if (seq == 1) {
            strcpy(slot->talker, talker);
            slot->signal = signal;
            slot->pendingCount = 0;
            slot->expected = 1;
            slot->total = total;
            slot->pendingView = view;
            slot->started = now;
        }
        if (slot->expected != seq || slot->total != total ||
            !fresh(now, slot->started, GPS_DIAGNOSTIC_AGE_MS)) {
            slot->expected = 0;
            return;
        }
        for (size_t i = 0; i < count; i++) {
            int id = integer(f[4 + i * 4], 999), snr = integer(f[7 + i * 4], 99);
            if (id > 0 && slot->pendingCount < 64) {
                auto &sat = slot->pending[slot->pendingCount++];
                sat.id = uint16_t(id);
                sat.snr = uint8_t(snr > 0 ? snr : 0);
            }
        }
        slot->expected++;
        if (seq == total) {
            memcpy(slot->sats, slot->pending, sizeof(Satellite) * slot->pendingCount);
            slot->count = slot->pendingCount;
            slot->inView = slot->pendingView;
            slot->at = now;
            slot->complete = true;
            slot->expected = 0;
        }
    }
    if (quality(now)) {
        _lastKnown = _gga;
        _lastKnown.valid = true;
        _lastKnownAt = _ggaAt;
        _hasLastKnown = true;
    }
}
bool GpsService::quality(uint32_t now) const {
    bool sawSolution = false, hasSolution = false;
    for (const auto &solution : _solutions) {
        if (*solution.talker && !strcmp(solution.talker, _ggaTalker) && fresh(now, solution.at)) {
            sawSolution = true;
            hasSolution |= solution.type >= 2;
        }
    }
    if (sawSolution && !hasSolution)
        return false;
    return _ggaSeen && _ggaValid && fresh(now, _ggaAt) &&
           (!_rmcSeen || !fresh(now, _rmcAt) || _rmcValid ||
            (strcmp(_rmcTalker, _ggaTalker) && strcmp(_rmcTalker, "GN"))) &&
           _gga.satellites >= GPS_MIN_SATELLITES && _gga.hdop <= GPS_MAX_HDOP;
}
GpsSnapshot GpsService::snapshot() const {
    GpsGuard guard;
    uint32_t now = millis();
    GpsSnapshot s;
    s.fix = _gga;
    s.fix.valid = quality(now);
    s.fix.ageMs = _ggaSeen ? uint32_t(now - _ggaAt) : UINT32_MAX;
    if (!_ggaSeen || !fresh(now, _ggaAt)) {
        s.fix.satellites = 0;
        s.fix.hdop = 99.99f;
    }
    if (_rmcSeen && _rmcValid && fresh(now, _rmcAt) &&
        (!strcmp(_rmcTalker, _ggaTalker) || !strcmp(_rmcTalker, "GN"))) {
        s.fix.speedKmh = _speed;
        s.fix.headingDeg = _heading;
        if (_ggaTime == _rmcTime)
            s.fix.utc = _rmcUtc;
    }
    s.silent = !fresh(now, _lastCharMs, GPS_NO_DATA_TIMEOUT_MS);
    s.baud = _baud;
    s.baudLocked = _baudLocked;
    s.chars = _chars;
    s.passed = _passed;
    s.failed = _failed;
    snprintf(s.talkers, sizeof(s.talkers), "%s", _talkers);
    snprintf(s.lastGga, sizeof(s.lastGga), "%s", _lastGga);
    s.hasLastKnown = _hasLastKnown;
    s.lastKnown = _lastKnown;
    s.lastKnown.ageMs = uint32_t(now - _lastKnownAt);
    unsigned solution = 0;
    for (const auto &v : _solutions)
        if (*v.talker && fresh(now, v.at, GPS_DIAGNOSTIC_AGE_MS)) {
            if (v.type > s.fixType)
                s.fixType = v.type;
            solution += v.used;
            if (v.type >= 2) {
                if (v.hdop < s.hdopGsa)
                    s.hdopGsa = v.hdop;
                if (v.pdop < s.pdop)
                    s.pdop = v.pdop;
            }
        }
    s.solution = solution > 255 ? 255 : solution;
    // If a receiver emits combined GN plus constellation-specific groups,
    // prefer the specific groups rather than counting the same satellite twice.
    bool specific = false;
    for (const auto &g : _groups)
        if (g.complete && strcmp(g.talker, "GN") && fresh(now, g.at, GPS_DIAGNOSTIC_AGE_MS))
            specific = true;
    unsigned view = 0, tracked = 0;
    for (size_t i = 0; i < 12; i++) {
        const auto &g = _groups[i];
        if (!g.complete || !fresh(now, g.at, GPS_DIAGNOSTIC_AGE_MS) ||
            (specific && !strcmp(g.talker, "GN")))
            continue;
        s.gsvFresh = true;
        // Count in-view once per constellation (max across its signal bands).
        bool first = true;
        unsigned maxView = g.inView;
        for (size_t j = 0; j < 12; j++)
            if (j != i && _groups[j].complete && !strcmp(g.talker, _groups[j].talker) &&
                fresh(now, _groups[j].at, GPS_DIAGNOSTIC_AGE_MS)) {
                if (j < i)
                    first = false;
                if (_groups[j].inView > maxView)
                    maxView = _groups[j].inView;
            }
        if (first)
            view += maxView;
        for (size_t k = 0; k < g.count; k++)
            if (g.sats[k].snr) {
                if (g.sats[k].snr > s.snr)
                    s.snr = g.sats[k].snr;
                bool duplicate = false;
                for (size_t j = 0; j <= i; j++) {
                    const auto &prev = _groups[j];
                    if (!prev.complete || strcmp(g.talker, prev.talker) ||
                        !fresh(now, prev.at, GPS_DIAGNOSTIC_AGE_MS))
                        continue;
                    for (size_t n = 0; n < (j == i ? k : prev.count); n++)
                        if (prev.sats[n].id == g.sats[k].id && prev.sats[n].snr)
                            duplicate = true;
                }
                if (!duplicate)
                    tracked++;
            }
    }
    s.inView = view > 255 ? 255 : view;
    s.tracked = tracked > 255 ? 255 : tracked;
    return s;
}
