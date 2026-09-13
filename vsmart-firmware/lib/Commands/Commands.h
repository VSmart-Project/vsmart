#pragma once
#include <ArduinoJson.h>
#include <cstring>
enum class DeviceCommand { Invalid, Ping, Reboot };
inline DeviceCommand parseDeviceCommand(const char *payload) {
    JsonDocument doc;
    if (deserializeJson(doc, payload) || !doc.is<JsonObject>())
        return DeviceCommand::Invalid;
    const char *command = doc["cmd"] | "";
    if (!strcmp(command, "ping"))
        return DeviceCommand::Ping;
    if (!strcmp(command, "reboot"))
        return DeviceCommand::Reboot;
    return DeviceCommand::Invalid;
}
