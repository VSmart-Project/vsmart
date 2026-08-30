import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../src/hooks/useAuth';
import { ToastProvider, useToast } from '../src/components/ui/Toast';
import { DeviceDataProvider } from '../src/contexts/DeviceDataContext';
import { GeofenceDataProvider } from '../src/contexts/GeofenceDataContext';
import { useSystemNotifications } from '../src/hooks/useSystemNotifications';

let _setOnboardingDone = null;
export function markOnboardingDone() {
    if (_setOnboardingDone) _setOnboardingDone(true);
}

function NotificationEffects({ isAuthenticated }) {
    const toast = useToast();
    useSystemNotifications(isAuthenticated, toast);
    return null;
}

export default function RootLayout() {
    const { isAuthenticated } = useAuth();
    const [onboardingDone, setOnboardingDone] = useState(false);
    const segments = useSegments();
    const navigationState = useRootNavigationState();

    useEffect(() => { _setOnboardingDone = setOnboardingDone; }, []);

    useEffect(() => {
        if (isAuthenticated === null || !navigationState?.key) return;

        const seg = segments[0];

        if (!onboardingDone && seg !== 'onboarding') {
            router.replace('/onboarding');
        } else if (onboardingDone && !isAuthenticated && seg !== 'login') {
            router.replace('/login');
        } else if (onboardingDone && isAuthenticated && (seg === 'login' || seg === 'onboarding')) {
            router.replace('/');
        }
    }, [isAuthenticated, onboardingDone, segments, navigationState?.key]);

    if (isAuthenticated === null) {
        return (
            <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#7C3AED" />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <ToastProvider>
                <DeviceDataProvider isAuthenticated={isAuthenticated}>
                    <GeofenceDataProvider isAuthenticated={isAuthenticated}>
                        <NotificationEffects isAuthenticated={isAuthenticated} />
                        <StatusBar style="light" />
                        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                            <Stack.Screen name="onboarding" />
                            <Stack.Screen name="login" />
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="map" options={{ animation: 'slide_from_bottom' }} />
                            <Stack.Screen name="geofence-draw" options={{ animation: 'slide_from_bottom' }} />
                            <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
                            <Stack.Screen name="notification-test" options={{ animation: 'slide_from_right' }} />
                        </Stack>
                    </GeofenceDataProvider>
                </DeviceDataProvider>
            </ToastProvider>
        </SafeAreaProvider>
    );
}
