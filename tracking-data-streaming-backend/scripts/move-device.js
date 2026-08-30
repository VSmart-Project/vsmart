require('dotenv').config();
const { LocationClient, BatchUpdateDevicePositionCommand } = require('@aws-sdk/client-location');

async function moveDevice() {
    const client = new LocationClient({ region: process.env.AWS_REGION || 'us-east-1' });

    // Base coordinates around 10.848073, 106.786433
    // Move it slightly by ~100m outside the 10m radius.
    // 1 degree lat is ~111km. 100m is ~0.0009.
    const newLng = 106.786433 + 0.001; // Longitude
    const newLat = 10.848073 + 0.001;  // Latitude

    console.log(`Sending new position for Vehicle-001: [${newLng}, ${newLat}]`);

    const command = new BatchUpdateDevicePositionCommand({
        TrackerName: process.env.LOCATION_TRACKER_NAME || 'TrackingDATN-Tracker',
        Updates: [
            {
                DeviceId: 'Vehicle-001',
                Position: [newLng, newLat],
                SampleTime: new Date(),
            },
        ],
    });

    try {
        const res = await client.send(command);
        console.log('Position update success:', res);
    } catch (err) {
        console.error('Position update failed:', err);
    }
}

moveDevice();
