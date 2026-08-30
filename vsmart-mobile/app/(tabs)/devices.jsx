import { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, Modal, ScrollView,
    ActivityIndicator, StyleSheet, FlatList,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceApi, antitheftApi } from '../../src/api/deviceApi';
import { useLiveDevices } from '../../src/contexts/DeviceDataContext';
import { useToast } from '../../src/components/ui/Toast';
import { useScanner } from '../../src/hooks/useScanner';
import ConfirmModal from '../../src/components/ui/ConfirmModal';
const ACCENT_COLOR = '#7C3AED';

const TYPES = [
    { value: 'all', label: 'All', icon: 'apps' },
    { value: 'motorbike', label: 'Motorcycle', icon: 'bicycle' },
    { value: 'car', label: 'Car', icon: 'car-sport' },
    { value: 'truck', label: 'Truck', icon: 'bus' },
    { value: 'other', label: 'Other', icon: 'locate' },
];

const FORM_TYPES = TYPES.filter(t => t.value !== 'all');

export default function DevicesScreen() {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [modalVisible, setModalVisible] = useState(false);
    const [editDevice, setEditDevice] = useState(null);
    const [form, setForm] = useState({ deviceId: '', displayName: '', type: 'car' });
    const [formError, setFormError] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const { devices, loading, initialLoaded, refreshDevices } = useLiveDevices();

    // Scanner integration
    const { openScanner } = useScanner({
        onScanned: (value, field) => {
            setForm(prev => ({ ...prev, [field]: value }));
            setFormError('');
            // Reopen modal after scan
            setModalVisible(true);
            toast.success('Scanned', `Device ID: ${value}`);
        },
    });

    const handleOpenScanner = () => {
        // Close modal before opening scanner
        setModalVisible(false);
        // Small delay to ensure modal closes
        setTimeout(() => {
            openScanner('deviceId');
        }, 300);
    };

    const load = useCallback(async () => {
        try {
            await refreshDevices();
        } catch (_) {
            toast.error('Load Failed', 'Could not load devices');
        } finally { setRefreshing(false); }
    }, [refreshDevices, toast]);

    const filtered = devices.filter(d => {
        const matchSearch = (d.displayName || d.deviceId).toLowerCase().includes(search.toLowerCase());
        const matchType = activeFilter === 'all' || d.type === activeFilter;
        return matchSearch && matchType;
    });

    const openAdd = () => {
        setEditDevice(null);
        setForm({ deviceId: '', displayName: '', type: 'car' });
        setFormError('');
        setModalVisible(true);
    };

    const openEdit = useCallback((d) => {
        setEditDevice(d);
        setForm({ deviceId: d.deviceId, displayName: d.displayName || '', type: d.type || 'car' });
        setFormError('');
        setModalVisible(true);
    }, []);

    const handleSave = async () => {
        if (!form.deviceId.trim()) return setFormError('Device ID is required');
        setFormError('');
        try {
            if (editDevice) await deviceApi.update(editDevice.deviceId, form);
            else await deviceApi.create(form);
            setModalVisible(false);
            toast.success(editDevice ? 'Updated' : 'Created', `Device "${form.displayName || form.deviceId}" ${editDevice ? 'updated' : 'added'} successfully`);
            load();
        } catch (e) { setFormError(e.message || 'Could not save device'); }
    };

    const handleDelete = useCallback((d) => setDeleteTarget(d), []);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await deviceApi.delete(deleteTarget.deviceId);
            toast.success('Deleted', `"${deleteTarget.displayName || deleteTarget.deviceId}" removed`);
            load();
        } catch (_) {
            toast.error('Error', 'Could not delete device');
        } finally {
            setDeleteLoading(false);
            setDeleteTarget(null);
        }
    };

    const toggleAntitheft = useCallback(async (d) => {
        try {
            if (d.antitheftEnabled) await antitheftApi.disable(d.deviceId);
            else await antitheftApi.enable(d.deviceId);
            toast.success(d.antitheftEnabled ? 'Disarmed' : 'Armed', `Anti-theft ${d.antitheftEnabled ? 'disabled' : 'enabled'} for "${d.displayName || d.deviceId}"`);
            load();
        } catch (e) { toast.error('Error', e.message); }
    }, [load, toast]);

    const onlineCount = devices.filter(d => d.isOnline).length;
    const filterCounts = useCallback((value) => (
        value === 'all' ? devices.length : devices.filter(d => d.type === value).length
    ), [devices]);

    const renderDevice = useCallback(({ item: d }) => {
        const typeInfo = FORM_TYPES.find(t => t.value === d.type) || FORM_TYPES[3];
        return (
            <TouchableOpacity style={s.card} onPress={() => openEdit(d)} activeOpacity={0.7}>
                <View style={[s.cardIconWrap, { backgroundColor: d.isOnline ? '#D1FAE5' : '#F1F5F9' }]}>
                    <Ionicons name={typeInfo.icon} size={24} color={d.isOnline ? '#10B981' : '#94A3B8'} />
                </View>
                <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={1}>{d.displayName || d.deviceId}</Text>
                    <Text style={s.cardId} numberOfLines={1}>{d.deviceId}</Text>
                    <View style={s.cardTags}>
                        <View style={[s.tag, { backgroundColor: d.isOnline ? '#D1FAE5' : '#F1F5F9' }]}>
                            <View style={[s.tagDot, { backgroundColor: d.isOnline ? '#10B981' : '#94A3B8' }]} />
                            <Text style={[s.tagText, { color: d.isOnline ? '#10B981' : '#94A3B8' }]}>
                                {d.isOnline ? 'Online' : 'Offline'}
                            </Text>
                        </View>
                        {d.antitheftEnabled && (
                            <View style={[s.tag, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="shield" size={10} color="#EF4444" />
                                <Text style={[s.tagText, { color: '#EF4444', marginLeft: 3 }]}>Armed</Text>
                            </View>
                        )}
                        <View style={[s.tag, { backgroundColor: '#EDE9FE' }]}>
                            <Text style={[s.tagText, { color: '#7C3AED' }]}>{typeInfo.label}</Text>
                        </View>
                    </View>
                </View>
                <View style={s.cardRight}>
                    <TouchableOpacity style={s.actionIconBtn} onPress={() => toggleAntitheft(d)}>
                        <Ionicons name={d.antitheftEnabled ? 'shield' : 'shield-outline'} size={18} color={d.antitheftEnabled ? '#EF4444' : '#94A3B8'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionIconBtn} onPress={() => handleDelete(d)}>
                        <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    }, [openEdit, toggleAntitheft, handleDelete]);

    if (loading && !initialLoaded) {
        return <View style={s.center}><ActivityIndicator size="large" color={ACCENT_COLOR} /></View>;
    }

    return (
        <View style={s.container}>
            {/* Fixed Header */}
            <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <View>
                    <Text style={s.headerTitle}>My Devices</Text>
                    <Text style={s.headerSub}>{devices.length} device{devices.length !== 1 ? 's' : ''} · {onlineCount} online</Text>
                </View>
                <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                style={{ flex: 1 }}
                data={filtered}
                keyExtractor={(item) => item.deviceId}
                renderItem={renderDevice}
                contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                windowSize={8}
                maxToRenderPerBatch={12}
                updateCellsBatchingPeriod={60}
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                ListHeaderComponent={(
                    <View style={{ marginHorizontal: -16 }}>
                        {/* Search */}
                        <View style={s.searchWrap}>
                            <View style={s.searchBox}>
                                <Ionicons name="search-outline" size={18} color="#94A3B8" />
                                <TextInput
                                    style={s.searchInput}
                                    placeholder="Search devices..."
                                    placeholderTextColor="#94A3B8"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch('')}>
                                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Filter Chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                            {TYPES.map(t => {
                                const active = activeFilter === t.value;
                                const count = filterCounts(t.value);
                                return (
                                    <TouchableOpacity
                                        key={t.value}
                                        style={[s.filterChip, active && s.filterChipActive]}
                                        onPress={() => setActiveFilter(t.value)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name={t.icon} size={16} color={active ? '#FFF' : '#64748B'} />
                                        <Text style={[s.filterText, active && s.filterTextActive]}>{t.label}</Text>
                                        <View style={[s.filterBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                            <Text style={[s.filterBadgeText, active && { color: '#FFF' }]}>{count}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
                ListEmptyComponent={(
                    <View style={[s.empty, { marginHorizontal: 0 }]}>
                        <View style={s.emptyIconWrap}>
                            <Ionicons name="car-sport-outline" size={40} color="#94A3B8" />
                        </View>
                        <Text style={s.emptyTitle}>No devices found</Text>
                        <Text style={s.emptySub}>Try adjusting your search or filters</Text>
                    </View>
                )}
            />

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={s.modalOverlay}>
                        <View style={s.modal}>
                            <View style={s.modalHandle} />
                            <View style={s.modalHeader}>
                                <Text style={s.modalTitle}>{editDevice ? 'Edit Device' : 'Add New Device'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                                    <Ionicons name="close" size={20} color="#F1F5F9" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Text style={s.fieldLabel}>Device ID</Text>
                                <View style={s.fieldWithButton}>
                                    <TextInput
                                        style={[s.fieldInput, s.fieldInputWithButton, editDevice && { opacity: 0.5 }, formError ? s.fieldInputError : null]}
                                        value={form.deviceId}
                                        onChangeText={v => { setForm({ ...form, deviceId: v }); if (formError) setFormError(''); }}
                                        editable={!editDevice}
                                        placeholder="e.g. device-001"
                                        placeholderTextColor="#94A3B8"
                                    />
                                    {!editDevice && (
                                        <TouchableOpacity 
                                            style={s.scanBtn} 
                                            onPress={handleOpenScanner}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="qr-code" size={20} color="#7C3AED" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {formError ? <Text style={s.fieldError}>{formError}</Text> : null}
                                <Text style={s.fieldLabel}>Display Name</Text>
                                <TextInput
                                    style={s.fieldInput}
                                    value={form.displayName}
                                    onChangeText={v => setForm({ ...form, displayName: v })}
                                    placeholder="My Honda Civic"
                                    placeholderTextColor="#94A3B8"
                                />
                                <Text style={s.fieldLabel}>Vehicle Type</Text>
                                <View style={s.typeGrid}>
                                    {FORM_TYPES.map(t => {
                                        const active = form.type === t.value;
                                        return (
                                            <TouchableOpacity
                                                key={t.value}
                                                style={[s.typeOption, active && s.typeOptionActive]}
                                                onPress={() => setForm({ ...form, type: t.value })}
                                            >
                                                <Ionicons name={t.icon} size={22} color={active ? '#7C3AED' : '#94A3B8'} />
                                                <Text style={[s.typeOptLabel, active && { color: '#7C3AED' }]}>{t.label}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                                    <Text style={s.saveBtnText}>{editDevice ? 'Update Device' : 'Add Device'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Delete Confirm Modal */}
            <ConfirmModal
                visible={!!deleteTarget}
                icon="delete"
                title="Delete Device"
                message={`Are you sure you want to remove "${deleteTarget?.displayName || deleteTarget?.deviceId}"? This action cannot be undone.`}
                confirmText="Delete"
                confirmColor="#EF4444"
                loading={deleteLoading}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </View>
    );
}

const BG = '#0B0F1A';
const CARD = '#151A2A';
const BORDER = '#1E2536';
const TEXT = '#F1F5F9';
const MUTED = '#64748B';

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24, backgroundColor: '#161B2E', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT },
    headerSub: { fontSize: 13, color: MUTED, marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },

    searchWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: BORDER },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: TEXT },

    filterRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: CARD, gap: 6, borderWidth: 1, borderColor: BORDER },
    filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    filterText: { fontSize: 13, fontWeight: '600', color: MUTED },
    filterTextActive: { color: '#FFF' },
    filterBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 2 },
    filterBadgeText: { fontSize: 11, fontWeight: '700', color: MUTED },

    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
    cardIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cardBody: { flex: 1, marginLeft: 12 },
    cardName: { fontSize: 15, fontWeight: '700', color: TEXT },
    cardId: { fontSize: 11, color: MUTED, marginTop: 1 },
    cardTags: { flexDirection: 'row', marginTop: 6, gap: 6, flexWrap: 'wrap' },
    tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    tagDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    tagText: { fontSize: 11, fontWeight: '600' },
    cardRight: { gap: 6, marginLeft: 8 },
    actionIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

    empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
    emptySub: { fontSize: 13, color: MUTED, marginTop: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modal: { backgroundColor: '#1A1F2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2D3548', alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
    closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

    fieldLabel: { fontSize: 13, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 16 },
    fieldInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: TEXT, borderWidth: 1, borderColor: BORDER },
    fieldWithButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldInputWithButton: { flex: 1 },
    scanBtn: { 
        width: 48, 
        height: 48, 
        borderRadius: 12, 
        backgroundColor: 'rgba(124,58,237,0.15)', 
        alignItems: 'center', 
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
    },
    fieldInputError: { borderColor: '#EF4444', borderWidth: 1.5 },
    fieldError: { color: '#F87171', fontSize: 12, fontWeight: '600', marginTop: 4, marginLeft: 4 },
    typeGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
    typeOption: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER },
    typeOptionActive: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.15)' },
    typeOptLabel: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 4 },

    saveBtn: { backgroundColor: '#7C3AED', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
