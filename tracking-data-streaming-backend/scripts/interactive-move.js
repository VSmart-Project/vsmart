require('dotenv').config();
const readline = require('readline');
const { IoTClient, DescribeEndpointCommand } = require('@aws-sdk/client-iot');
const { IoTDataPlaneClient, PublishCommand } = require('@aws-sdk/client-iot-data-plane');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const region = process.env.AWS_REGION || 'us-east-1';
const iotClient = new IoTClient({ region });
const sqsClient = new SQSClient({ region });
const mqttTopic = process.env.IOT_LOCATION_TOPIC || 'location';
const geofenceQueueUrl =
    process.env.GEOFENCE_QUEUE_URL ||
    'https://sqs.us-east-1.amazonaws.com/145023123305/TrackingDATN-GeofenceEvents';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let iotDataClientPromise;
let activeDeviceId = process.env.TEST_DEVICE_ID || 'Vehicle-001';
let activeSpeed = process.env.TEST_DEVICE_SPEED || '10';
let autoMoveTimer = null;

const AUTO_MOVE_INTERVAL_MS = 2000;
const AUTO_MOVE_STEP = 0.0002;

const getIotDataClient = async () => {
    if (!iotDataClientPromise) {
        iotDataClientPromise = (async () => {
            const { endpointAddress } = await iotClient.send(
                new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' })
            );

            return new IoTDataPlaneClient({
                region,
                endpoint: `https://${endpointAddress}`,
            });
        })();
    }

    return iotDataClientPromise;
};

console.log('──────────────────────────────────────────────────────────────────');
console.log(` 🚗 INTERACTIVE DEVICE MOVER `);
console.log(` Target Device : ${activeDeviceId}`);
console.log(` Region        : ${region}`);
console.log(` MQTT Topic    : ${mqttTopic}`);
console.log(` Geofence Q    : ${geofenceQueueUrl}`);
console.log('──────────────────────────────────────────────────────────────────');
console.log('Commands:');
console.log('  move <lat> <lng>           Publish one telemetry point');
console.log('  device <deviceId>          Change active device');
console.log('  speed <value>              Change speed in payload');
console.log('  auto <lat> <lng> [count]   Auto-move from a start point');
console.log('  enter <geofenceId> [lng lat]  Send geofence ENTER test event');
console.log('  exitgf <geofenceId> [lng lat] Send geofence EXIT test event');
console.log('  stop                       Stop auto-move');
console.log('  status                     Show current state');
console.log('  help                       Show commands again');
console.log('Type "exit" to quit.\n');

const printStatus = () => {
    console.log('──────────────────────────────────────────────────────────────────');
    console.log(` Active device : ${activeDeviceId}`);
    console.log(` Active speed  : ${activeSpeed}`);
    console.log(` Auto-move     : ${autoMoveTimer ? 'running' : 'stopped'}`);
    console.log(` Geofence Q    : ${geofenceQueueUrl}`);
    console.log('──────────────────────────────────────────────────────────────────\n');
};

const parseLatLng = (latText, lngText) => {
    const lat = parseFloat(latText);
    const lng = parseFloat(lngText);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }

    return { lat, lng };
};

const publishTelemetry = async ({ lat, lng, speed = activeSpeed, deviceId = activeDeviceId }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
        payload: {
            deviceid: deviceId,
            timestamp,
            location: {
                lat,
                long: lng,
            },
            positionProperties: {
                speed: String(speed),
            },
        },
    };

    console.log(`⏳ Đang publish telemetry [Device: ${deviceId}] [Lng: ${lng}, Lat: ${lat}] lên IoT topic "${mqttTopic}"...`);
    console.log('📦 Payload:', JSON.stringify(payload));

    const client = await getIotDataClient();
    const command = new PublishCommand({
        topic: mqttTopic,
        payload: Buffer.from(JSON.stringify(payload)),
        qos: 0,
    });

    await client.send(command);
    console.log('✅ Publish telemetry thành công!');
    console.log(`   Kỳ vọng downstream: IoTMessageProcessor -> device.position.updated -> devices/${deviceId}/events\n`);
};

const sendGeofenceEvent = async ({
    action,
    geofenceId,
    deviceId = activeDeviceId,
    lng = 106.7864,
    lat = 10.8481,
}) => {
    const body = {
        detail: {
            DeviceId: deviceId,
            GeofenceId: geofenceId,
            EventType: action.toUpperCase(),
            Position: [lng, lat],
        },
    };

    console.log(`⏳ Đang gửi geofence ${action.toUpperCase()} [Device: ${deviceId}] [Geofence: ${geofenceId}]...`);
    console.log('📦 Message body:', JSON.stringify(body));

    const command = new SendMessageCommand({
        QueueUrl: geofenceQueueUrl,
        MessageBody: JSON.stringify(body),
    });

    const response = await sqsClient.send(command);
    console.log('✅ Send geofence test message thành công!');
    console.log(`   MessageId: ${response.MessageId}`);
    console.log(`   Kỳ vọng downstream: GeofenceEventConsumer -> geofence.${action.toLowerCase()} -> devices/${deviceId}/events\n`);
};

const stopAutoMove = () => {
    if (autoMoveTimer) {
        clearInterval(autoMoveTimer);
        autoMoveTimer = null;
        console.log('🛑 Auto-move đã dừng.\n');
    }
};

const startAutoMove = async ({ lat, lng, count }) => {
    stopAutoMove();

    let currentLat = lat;
    let currentLng = lng;
    let sentCount = 0;

    console.log(`▶️  Bắt đầu auto-move cho ${activeDeviceId} từ [${lat}, ${lng}] mỗi ${AUTO_MOVE_INTERVAL_MS}ms.`);
    console.log(`   Step: +${AUTO_MOVE_STEP} lat/lng | Count: ${count || 'infinite'}\n`);

    const tick = async () => {
        try {
            await publishTelemetry({
                lat: currentLat,
                lng: currentLng,
            });

            sentCount += 1;
            currentLat += AUTO_MOVE_STEP;
            currentLng += AUTO_MOVE_STEP;

            if (count && sentCount >= count) {
                stopAutoMove();
            }
        } catch (err) {
            console.error('❌ Auto-move publish lỗi:', err.message, '\n');
            stopAutoMove();
        }
    };

    await tick();
    autoMoveTimer = setInterval(() => {
        tick().catch((err) => {
            console.error('❌ Auto-move tick lỗi:', err.message, '\n');
            stopAutoMove();
        });
    }, AUTO_MOVE_INTERVAL_MS);
};

const showHelp = () => {
    console.log('Commands:');
    console.log('  move <lat> <lng>');
    console.log('  device <deviceId>');
    console.log('  speed <value>');
    console.log('  auto <lat> <lng> [count]');
    console.log('  enter <geofenceId> [lng lat]');
    console.log('  exitgf <geofenceId> [lng lat]');
    console.log('  stop');
    console.log('  status');
    console.log('  help');
    console.log('  exit\n');
};

const promptUser = () => {
    rl.question('📍 Command > ', async (input) => {
        const text = input.trim();
        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
            stopAutoMove();
            console.log('Goodbye!');
            rl.close();
            return;
        }

        if (!text) {
            promptUser();
            return;
        }

        const parts = text.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        const command = (parts[0] || '').toLowerCase();

        try {
            if (command === 'device') {
                if (!parts[1]) {
                    console.log('❌ Thiếu deviceId. Ví dụ: device Vehicle-001\n');
                } else {
                    activeDeviceId = parts[1];
                    console.log(`✅ Active device đổi thành: ${activeDeviceId}\n`);
                }
            } else if (command === 'speed') {
                if (!parts[1]) {
                    console.log('❌ Thiếu speed. Ví dụ: speed 25\n');
                } else {
                    activeSpeed = parts[1];
                    console.log(`✅ Active speed đổi thành: ${activeSpeed}\n`);
                }
            } else if (command === 'move') {
                const coords = parseLatLng(parts[1], parts[2]);
                if (!coords) {
                    console.log('❌ Cú pháp sai. Ví dụ: move 10.8481 106.7864\n');
                } else {
                    await publishTelemetry(coords);
                }
            } else if (command === 'auto') {
                const coords = parseLatLng(parts[1], parts[2]);
                const count = parts[3] ? parseInt(parts[3], 10) : null;
                if (!coords || (parts[3] && Number.isNaN(count))) {
                    console.log('❌ Cú pháp sai. Ví dụ: auto 10.8481 106.7864 10\n');
                } else {
                    await startAutoMove({ ...coords, count });
                }
            } else if (command === 'enter' || command === 'exitgf') {
                const geofenceId = parts[1];
                const lng = parts[2] ? Number(parts[2]) : 106.7864;
                const lat = parts[3] ? Number(parts[3]) : 10.8481;

                if (!geofenceId || Number.isNaN(lng) || Number.isNaN(lat)) {
                    console.log(`❌ Cú pháp sai. Ví dụ: ${command} home-zone 106.7864 10.8481\n`);
                } else {
                    await sendGeofenceEvent({
                        action: command === 'enter' ? 'enter' : 'exit',
                        geofenceId,
                        lng,
                        lat,
                    });
                }
            } else if (command === 'stop') {
                stopAutoMove();
            } else if (command === 'status') {
                printStatus();
            } else if (command === 'help') {
                showHelp();
            } else {
                // Backward-compatible shortcut: "<lat> <lng>" behaves like move.
                const coords = parseLatLng(parts[0], parts[1]);
                if (!coords) {
                    console.log('❌ Command không hợp lệ. Gõ "help" để xem hướng dẫn.\n');
                } else {
                    await publishTelemetry(coords);
                }
            }
        } catch (err) {
            console.error('❌ Lỗi:', err.message, '\n');
        }

        promptUser();
    });
};

printStatus();
promptUser();
