import { Tabs } from 'expo-router';
import CustomTabBar from '../../src/components/ui/TabBar';

export default function TabLayout() {
    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="devices" />
            <Tabs.Screen name="geofences" />
            <Tabs.Screen name="settings" />
        </Tabs>
    );
}
