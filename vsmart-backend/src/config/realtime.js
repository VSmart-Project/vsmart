const toBoolean = (value, defaultValue = false) => {
    if (value == null || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toNumber = (value, defaultValue) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
};

const realtimeConfig = {
    enabled: toBoolean(process.env.REALTIME_ENABLED, false),
    publishEvents: toBoolean(process.env.REALTIME_PUBLISH_EVENTS, false),
    allowClientSubscribe: toBoolean(process.env.REALTIME_ALLOW_CLIENT_SUBSCRIBE, false),
    transport: process.env.REALTIME_TRANSPORT || 'aws-iot-mqtt',
    appEventsTopicTemplate: process.env.REALTIME_APP_EVENTS_TOPIC_TEMPLATE || 'users/{userId}/events',
    rawTelemetryTopicTemplate: process.env.REALTIME_RAW_TELEMETRY_TOPIC_TEMPLATE || 'devices/{deviceId}/telemetry',
        debugDeviceEventsTopicTemplate: process.env.REALTIME_DEBUG_DEVICE_EVENTS_TOPIC_TEMPLATE || 'devices/{deviceId}/events',
    fallbackPollIntervalMs: toNumber(process.env.REALTIME_FALLBACK_POLL_INTERVAL_MS, 30000),
};

module.exports = {
    realtimeConfig,
};