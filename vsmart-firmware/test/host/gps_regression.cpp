#include "app_config.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Board.h>
#include <Cloud.h>
#include <Commands.h>
#include <Gps.h>
#include <Telemetry.h>
#include <cassert>
#include <iostream>
unsigned long fakeMillis = 1000;
static time_t fakeEpoch = 1789200000;
extern "C" time_t time(time_t *p) {
    if (p)
        *p = fakeEpoch;
    return fakeEpoch;
}
CloudStub Cloud;
const BoardPins BOARD = {
    "audit", {16, 17, 2, 9600}, {26, 27, 1, 115200}, 32, 25, 33, {21, 22}, 35, 0, 0x68};
std::string frame(const std::string &body, bool corrupt = false) {
    unsigned sum = 0;
    for (char c : body)
        sum ^= (unsigned char)c;
    char end[8];
    snprintf(end, sizeof(end), "*%02X\r\n", corrupt ? (sum ^ 1) : sum);
    return "$" + body + end;
}
void feed(const std::string &body, bool corrupt = false) {
    HardwareSerial::input += frame(body, corrupt);
    Gps.poll();
}
void reset() {
    Gps = GpsService();
    Telemetry = TelemetryService();
    Cloud = CloudStub();
    HardwareSerial::input.clear();
    fakeMillis = 1000;
    fakeEpoch = 1789200000;
    Gps.begin();
    Telemetry.begin();
}
void gga(const char *latitude = "1048.0000", const char *quality = "1", const char *hdop = "1.00") {
    feed(std::string("GPGGA,120000.00,") + latitude + ",N,10648.0000,E," + quality + ",08," + hdop +
         ",10.0,M,0.0,M,,");
}
void fix(const char *latitude = "1048.0000", const char *knots = "5.0") {
    gga(latitude);
    feed(std::string("GPRMC,120000.00,A,") + latitude + ",N,10648.0000,E," + knots +
         ",90.0,120926,,,A");
}
JsonDocument last() {
    JsonDocument doc;
    assert(!Cloud.payloads.empty());
    assert(!deserializeJson(doc, Cloud.payloads.back()));
    return doc;
}
int main() {
    reset();
    Telemetry.tick();
    assert(Cloud.payloads.empty());
    fix();
    assert(Gps.hasQualityFix());
    Cloud.online = false;
    Telemetry.tick();
    assert(Telemetry.dropped() == 1);
    Cloud.online = true;
    Telemetry.tick();
    assert(Telemetry.published() == 1);
    auto d = last();
    assert(d["payload"]["positionProperties"].size() == 4);
    assert(d["payload"]["positionProperties"]["reason"] == "first_fix");
    assert(fabs(d["payload"]["location"]["lat"].as<double>() - 10.8) < 1e-6);
    assert(d["payload"]["accuracy"]["Horizontal"].as<double>() == 5.0);
    std::cout << "PASS initial no-fix, quality fix, retry, payload API contract\n";
    fakeMillis += 3000;
    feed("GPRMC,120003.00,V,,,,,,,120926,,,N");
    assert(!Gps.hasQualityFix());
    Telemetry.tick();
    assert(Cloud.payloads.size() == 1);
    gga("1048.0000", "0");
    assert(!Gps.hasQualityFix());
    fakeMillis += 3000;
    fix();
    assert(Gps.hasQualityFix());
    fakeMillis += GPS_MAX_FIX_AGE_MS + 1;
    assert(!Gps.hasQualityFix());
    std::cout << "PASS RMC invalid, GGA invalid, recovery, stale fix\n";
    reset();
    fix();
    Telemetry.tick();
    fakeMillis += 3000;
    fix("1048.0108", "0.3");
    Telemetry.tick();
    d = last();
    assert(fabs(d["payload"]["location"]["lat"].as<double>() - 10.80018) < 1e-6);
    assert(d["payload"]["positionProperties"]["status"] == "stationary");
    assert(d["payload"]["positionProperties"].size() == 3);
    fakeMillis += 60000;
    fix("1048.0108", "0");
    Telemetry.tick();
    d = last();
    assert(fabs(d["payload"]["location"]["lat"].as<double>() - 10.80018) < 1e-6);
    std::cout << "PASS short/slow movement and stationary sample retain measured position\n";
    reset();
    feed("GPGSA,A,3,01,02,03,04,,,,,,,,,1.0,1.0,1.0", true);
    assert(Gps.fixType() == 0);
    assert(Gps.snapshot().failed == 1);
    feed("GPGSA,A,3,01,02,03,04,,,,,,,,,1.0,1.0,1.0");
    assert(Gps.fixType() == 3);
    feed("GPGSV,1,1,02,06,40,100,40,09,30,120,35");
    feed("GLGSV,1,1,01,65,30,100,20");
    assert(Gps.satellitesInView() == 3 && Gps.satellitesTracked() == 3 && Gps.bestSnrDb() == 40);
    // Same GPS satellites on a second signal band must not be counted twice.
    feed("GPGSV,1,1,02,06,40,100,42,09,30,120,35,1");
    assert(Gps.satellitesTracked() == 3 && Gps.bestSnrDb() == 42);
    fakeMillis += GPS_DIAGNOSTIC_AGE_MS + 1;
    assert(Gps.satellitesTracked() == 0 && Gps.fixType() == 0 && !Gps.snapshot().gsvFresh);
    std::cout
        << "PASS checksum, constellation aggregation, signal deduplication, diagnostic expiry\n";
    reset();
    feed("GPGSV,2,1,05,01,40,100,40,02,30,120,35,03,30,120,35,04,30,120,35");
    assert(!Gps.snapshot().gsvFresh);
    feed("GPGSV,2,2,05,05,40,100,30");
    assert(Gps.satellitesTracked() == 5);
    reset();
    feed("GPGSV,2,2,05,05,40,100,30");
    assert(!Gps.snapshot().gsvFresh);
    HardwareSerial::input = "$broken" + frame("GPGSV,1,1,01,06,40,100,40");
    Gps.poll();
    assert(Gps.satellitesTracked() == 1);
    HardwareSerial::input =
        "$" + std::string(200, 'x') + "\r\n" + frame("GPGSV,1,1,01,06,40,100,30");
    Gps.poll();
    assert(Gps.bestSnrDb() == 30);
    std::cout << "PASS multipart sequencing, truncated/overlong line resynchronization\n";
    reset();
    fakeMillis += GPS_BAUD_PROBE_MS + 1;
    Gps.poll();
    assert(Gps.baud() == 38400);
    feed("GPGSV,1,1,00");
    assert(Gps.baudLocked());
    fakeMillis += GPS_NO_DATA_TIMEOUT_MS + 1;
    Gps.poll();
    assert(!Gps.baudLocked());
    fakeMillis += GPS_BAUD_PROBE_MS + 1;
    Gps.poll();
    assert(Gps.baud() == 115200);
    std::cout << "PASS baud probe, checksum lock, restart after prolonged invalid/silent input\n";
    reset();
    fakeEpoch = 0;
    gga();
    Telemetry.tick();
    assert(Cloud.payloads.empty());
    fix();
    Telemetry.tick();
    assert(Cloud.payloads.size() == 1);
    assert(last()["payload"]["timestamp"].as<int64_t>() > 1600000000LL);
    fakeMillis += 6000;
    Telemetry.publishNow("cloud_ping");
    assert(Cloud.topics.back() == "devices/audit-device/status");
    d = last();
    assert(d["gps"]["valid"] == false && d["lastKnown"]["ageS"].as<unsigned>() >= 6);
    assert(d["payload"].isNull());
    std::cout << "PASS missing clock suppressed, GPS UTC fallback, stale ping returns health\n";
    reset();
    gga("1048.0000", "1", "12.0");
    assert(!Gps.hasQualityFix());
    gga("9060.0000");
    assert(!Gps.hasQualityFix());
    fix();
    feed("GPGSA,A,3,01,02,03,04,,,,,,,,,99.99,99.99,99.99");
    Telemetry.tick();
    assert(last()["payload"]["accuracy"]["Horizontal"].as<double>() == 5.0);
    std::cout << "PASS bad HDOP/coordinates rejected; diagnostics cannot override fix accuracy\n";
    assert(parseDeviceCommand("{\"cmd\":\"ping\"}") == DeviceCommand::Ping);
    assert(parseDeviceCommand("{\"cmd\":\"reboot\"}") == DeviceCommand::Reboot);
    for (const char *text :
         {"{\"reboot\":false}", "{\"note\":\"reboot\"}", "broken", "[]", "{\"cmd\":true}"})
        assert(parseDeviceCommand(text) == DeviceCommand::Invalid);
    reset();
    fix();
    feed("GPGSA,A,1,,,,,,,,,,,,,99.99,99.99,99.99");
    assert(!Gps.hasQualityFix());
    feed("GPGSA,A,3,01,02,03,04,,,,,,,,,1.0,1.0,1.0");
    assert(Gps.hasQualityFix());
    std::cout << "PASS GSA no-solution invalidates recent coordinates and recovers\n";
    std::cout << "PASS command schema rejects substring/boolean/invalid JSON\n";
}
