import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACKEND_URL, COGNITO } from '../../src/configuration';
import { useAuth } from '../../src/hooks/useAuth';
import { useToast } from '../../src/components/ui/Toast';
import ConfirmModal from '../../src/components/ui/ConfirmModal';

const BG = '#0B0F1A';
const CARD = '#151A2A';
const BORDER = '#1E2536';
const TEXT = '#F1F5F9';
const MUTED = '#64748B';

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { logout } = useAuth();
    const toast = useToast();
    const [showLogout, setShowLogout] = useState(false);

    const handleLogout = () => setShowLogout(true);

    const confirmLogout = async () => {
        setShowLogout(false);
        toast.info('Signed Out', 'You have been signed out successfully');
        setTimeout(logout, 300);
    };

    const sections = [
        {
            title: 'TESTING',
            items: [
                { 
                    icon: 'notifications-outline', 
                    label: 'Test Notifications', 
                    value: 'Demo', 
                    color: '#7C3AED',
                    onPress: () => router.push('/notification-test'),
                },
            ],
        },
        {
            title: 'AWS CONFIGURATION',
            items: [
                { icon: 'globe-outline', label: 'Region', value: COGNITO.REGION, color: '#A78BFA' },
                { icon: 'people-outline', label: 'User Pool', value: COGNITO.USER_POOL_ID, color: '#818CF8' },
                { icon: 'server-outline', label: 'Backend', value: BACKEND_URL, color: '#60A5FA' },
            ],
        },
        {
            title: 'APPLICATION',
            items: [
                { icon: 'information-circle-outline', label: 'Version', value: '1.0.0', color: '#34D399' },
                { icon: 'sync-outline', label: 'Sync Status', value: 'Connected', color: '#34D399' },
                { icon: 'shield-checkmark-outline', label: 'Security', value: 'ATS Enabled', color: '#FBBF24' },
            ],
        },
    ];

    return (
        <View style={s.container}>
            <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <Text style={s.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View style={s.profileCard}>
                    <View style={s.avatar}>
                        <Ionicons name="person" size={28} color="#A78BFA" />
                    </View>
                    <View style={{ marginLeft: 14, flex: 1 }}>
                        <Text style={s.profileName}>Administrator</Text>
                        <Text style={s.profileSub}>VSmart Tracking System</Text>
                    </View>
                    <TouchableOpacity style={s.editBtn}>
                        <Ionicons name="create-outline" size={16} color="#A78BFA" />
                    </TouchableOpacity>
                </View>

                {sections.map(section => (
                    <View key={section.title}>
                        <Text style={s.sectionTitle}>{section.title}</Text>
                        <View style={s.sectionCard}>
                            {section.items.map((item, idx) => (
                                <TouchableOpacity 
                                    key={item.label} 
                                    style={[s.row, idx < section.items.length - 1 && s.rowBorder]}
                                    onPress={item.onPress}
                                    disabled={!item.onPress}
                                    activeOpacity={item.onPress ? 0.7 : 1}
                                >
                                    <View style={[s.iconWrap, { backgroundColor: `${item.color}15` }]}>
                                        <Ionicons name={item.icon} size={18} color={item.color} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={s.rowLabel}>{item.label}</Text>
                                        <Text style={s.rowValue} numberOfLines={1}>{item.value}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#2D3548" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                    <Ionicons name="log-out-outline" size={20} color="#FFF" />
                    <Text style={s.logoutText}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>

            <ConfirmModal
                visible={showLogout}
                icon="logout"
                title="Sign Out"
                message="Are you sure you want to sign out? You will need to log in again."
                confirmText="Sign Out"
                confirmColor="#EF4444"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogout(false)}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: { paddingHorizontal: 20, paddingBottom: 24, backgroundColor: '#161B2E', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT },

    profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 18, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: BORDER },
    avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
    profileName: { fontSize: 17, fontWeight: '700', color: TEXT },
    profileSub: { fontSize: 13, color: MUTED, marginTop: 2 },
    editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },

    sectionTitle: { fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1, marginBottom: 10, marginLeft: 4, marginTop: 8 },
    sectionCard: { backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: BORDER },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    rowBorder: { borderBottomWidth: 1, borderColor: BORDER },
    iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 11, color: MUTED, fontWeight: '500' },
    rowValue: { fontSize: 14, color: TEXT, fontWeight: '600', marginTop: 1 },

    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', height: 52, borderRadius: 14, gap: 8, marginTop: 8 },
    logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    footer: { textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 20, lineHeight: 18 },
});
