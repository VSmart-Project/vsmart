import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const TABS = [
    { name: 'index', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
    { name: 'devices', label: 'Devices', icon: 'car-sport', iconOutline: 'car-sport-outline' },
    { name: '__map__', label: 'Map', icon: 'navigate', special: true },
    { name: 'geofences', label: 'Zones', icon: 'location', iconOutline: 'location-outline' },
    { name: 'settings', label: 'Settings', icon: 'settings', iconOutline: 'settings-outline' },
];

function TabItem({ tab, isFocused, onPress }) {
    const scale = useSharedValue(1);
    const bgOpacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(isFocused ? 1.05 : 1, { damping: 15, stiffness: 200 });
        bgOpacity.value = withSpring(isFocused ? 1 : 0, { damping: 15, stiffness: 200 });
    }, [bgOpacity, isFocused, scale]);

    const iconWrapStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        backgroundColor: `rgba(167, 139, 250, ${bgOpacity.value * 0.15})`,
    }));

    return (
        <TouchableOpacity style={s.tab} onPress={onPress} activeOpacity={0.7}>
            <Animated.View style={[s.iconWrap, iconWrapStyle]}>
                <Ionicons
                    name={isFocused ? tab.icon : tab.iconOutline}
                    size={20}
                    color={isFocused ? '#A78BFA' : '#64748B'}
                />
            </Animated.View>
            <Text style={[s.label, isFocused && s.labelActive]} numberOfLines={1}>
                {tab.label}
            </Text>
        </TouchableOpacity>
    );
}

function MapButton() {
    return (
        <TouchableOpacity style={s.mapBtn} onPress={() => router.push('/map')} activeOpacity={0.8}>
            <View style={s.mapBtnInner}>
                <Ionicons name="navigate" size={24} color="#FFF" />
            </View>
            <Text style={s.mapLabel}>Map</Text>
        </TouchableOpacity>
    );
}

export default function CustomTabBar({ state, navigation }) {
    const insets = useSafeAreaInsets();

    const items = [];
    const routes = state.routes;

    routes.forEach((route, index) => {
        const tabDef = TABS.find(t => t.name === route.name);
        if (!tabDef) return;
        const isFocused = state.index === index;

        const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
            }
        };

        if (route.name === 'geofences') {
            items.push(<MapButton key="__map__" />);
        }

        items.push(<TabItem key={route.key} tab={tabDef} isFocused={isFocused} onPress={onPress} />);
    });

    return (
        <View style={[s.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {items}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingTop: 6,
        borderTopWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748B',
    },
    labelActive: {
        color: '#A78BFA',
        fontWeight: '700',
    },
    mapBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -22,
        width: 64,
    },
    mapBtnInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    mapLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#A78BFA',
        marginTop: 3,
    },
});
