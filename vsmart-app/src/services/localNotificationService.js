import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions() {
    if (!Device.isDevice) {
        console.log('Must use physical device for notifications');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return false;
    }

    // Setup Android notification channels
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('security', {
            name: 'Security Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#EF4444',
            sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('connection', {
            name: 'Connection Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FBBF24',
        });
    }

    return true;
}

/**
 * Schedule a local notification immediately
 */
export async function showLocalNotification({ title, body, data = {}, category = 'security' }) {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
                priority: category === 'security' ? 'high' : 'default',
                ...(Platform.OS === 'android' && { channelId: category }),
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        console.error('Error showing local notification:', error);
    }
}

/**
 * Show anti-theft alert notification
 */
export async function showAntitheftAlert(deviceName, message) {
    await showLocalNotification({
        title: '🚨 Anti-theft Alert',
        body: `${deviceName}: ${message}`,
        data: {
            type: 'antitheft',
            deviceName,
        },
        category: 'security',
    });
}

/**
 * Show geofence breach notification
 */
export async function showGeofenceAlert(deviceName, geofenceName, eventType) {
    await showLocalNotification({
        title: '⚠️ Geofence Alert',
        body: `${deviceName} ${eventType === 'ENTER' ? 'entered' : 'left'} ${geofenceName}`,
        data: {
            type: 'geofence',
            deviceName,
            geofenceName,
            eventType,
        },
        category: 'security',
    });
}

/**
 * Show device offline notification
 */
export async function showDeviceOfflineAlert(deviceName) {
    await showLocalNotification({
        title: '📡 Connection Lost',
        body: `${deviceName} went offline`,
        data: {
            type: 'offline',
            deviceName,
        },
        category: 'connection',
    });
}

/**
 * Show device online notification
 */
export async function showDeviceOnlineAlert(deviceName) {
    await showLocalNotification({
        title: '✅ Device Reconnected',
        body: `${deviceName} is back online`,
        data: {
            type: 'online',
            deviceName,
        },
        category: 'connection',
    });
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
}

/**
 * Get badge count
 */
export async function getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
}
