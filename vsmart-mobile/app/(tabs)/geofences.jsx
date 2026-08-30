import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, Modal, ScrollView,
    ActivityIndicator, StyleSheet, FlatList,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { geofenceApi } from '../../src/api/deviceApi';
import { useToast } from '../../src/components/ui/Toast';
import ConfirmModal from '../../src/components/ui/ConfirmModal';
const ACCENT = '#7C3AED';

const TEMPLATES = {
    hanoi: { name: 'Hanoi Center', coords: [[105.804,21.028],[105.806,21.028],[105.806,21.030],[105.804,21.030],[105.804,21.028]] },
    hcm: { name: 'HCMC Center', coords: [[106.628,10.822],[106.632,10.822],[106.632,10.826],[106.628,10.826],[106.628,10.822]] },
    small: { name: 'Small Zone', coords: [[105.804,21.028],[105.805,21.028],[105.805,21.029],[105.804,21.029],[105.804,21.028]] },
};

export default function GeofencesScreen() {
    const insets = useSafeAreaInsets();
    const toast = useToast();
    const [geofences, setGeofences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [viewGf, setViewGf] = useState(null);
    const [search, setSearch] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchGeo = useCallback(async () => {
        try {
            const r = await geofenceApi.list();
            setGeofences(r.Entries || []);
        } catch (_) {}
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchGeo(); }, [fetchGeo]);

    const filtered = geofences.filter(g => g.GeofenceId.toLowerCase().includes(search.toLowerCase()));
    const toggle = useCallback(
        id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]),
        []
    );
    const selectAll = () => setSelectedIds(selectedIds.length === geofences.length ? [] : geofences.map(g => g.GeofenceId));

    const renderGeofence = useCallback(({ item: gf }) => {
        const sel = selectedIds.includes(gf.GeofenceId);
        const points = gf.Geometry?.Polygon?.[0]?.length || 0;
        return (
            <TouchableOpacity style={[s.card, sel && s.cardSelected]} onPress={() => toggle(gf.GeofenceId)} activeOpacity={0.7}>
                <TouchableOpacity style={[s.checkbox, sel && s.checkboxActive]} onPress={() => toggle(gf.GeofenceId)}>
                    {sel && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </TouchableOpacity>
                <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={1}>{gf.GeofenceId}</Text>
                    <View style={s.cardMeta}>
                        <View style={s.metaItem}>
                            <Ionicons name="navigate-outline" size={12} color="#94A3B8" />
                            <Text style={s.metaText}>{points} points</Text>
                        </View>
                        <View style={s.metaDot} />
                        <View style={s.metaItem}>
                            <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                            <Text style={s.metaText}>{new Date(gf.CreateTime).toLocaleDateString()}</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity style={s.viewBtn} onPress={() => setViewGf(gf)}>
                    <Ionicons name="eye-outline" size={18} color="#7C3AED" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }, [selectedIds, toggle]);

    const deleteSelected = () => {
        if (!selectedIds.length) return toast.warning('No Selection', 'Select geofences to delete');
        setShowDeleteConfirm(true);
    };

    const confirmDeleteSelected = async () => {
        setDeleteLoading(true);
        try {
            await geofenceApi.delete(selectedIds);
            toast.success('Deleted', `${selectedIds.length} geofence${selectedIds.length > 1 ? 's' : ''} removed`);
            setSelectedIds([]);
            fetchGeo();
        } catch (e) {
            toast.error('Delete Failed', e.message);
        } finally {
            setDeleteLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    if (loading) return <View style={s.center}><ActivityIndicator size="large" color={ACCENT} /></View>;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                <View>
                    <Text style={s.headerTitle}>Geofences</Text>
                    <Text style={s.headerSub}>{geofences.length} zone{geofences.length !== 1 ? 's' : ''} configured</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={s.headerIconBtn} onPress={() => router.push('/geofence-draw')}>
                        <Ionicons name="map-outline" size={18} color="#A78BFA" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.headerIconBtn, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)}>
                        <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats Row */}
            <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                    <Ionicons name="layers-outline" size={20} color="#A78BFA" />
                    <Text style={[s.statNum, { color: '#A78BFA' }]}>{geofences.length}</Text>
                    <Text style={[s.statLabel, { color: '#A78BFA' }]}>Total</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#34D399" />
                    <Text style={[s.statNum, { color: '#34D399' }]}>{geofences.length}</Text>
                    <Text style={[s.statLabel, { color: '#34D399' }]}>Active</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                    <Ionicons name="checkmark-done-outline" size={20} color="#FBBF24" />
                    <Text style={[s.statNum, { color: '#FBBF24' }]}>{selectedIds.length}</Text>
                    <Text style={[s.statLabel, { color: '#FBBF24' }]}>Selected</Text>
                </View>
            </View>

            <FlatList
                style={{ flex: 1 }}
                data={filtered}
                keyExtractor={(item) => item.GeofenceId}
                renderItem={renderGeofence}
                contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 16, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                windowSize={8}
                maxToRenderPerBatch={12}
                updateCellsBatchingPeriod={60}
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchGeo(); }}
                ListHeaderComponent={(
                    <View style={{ marginHorizontal: -16 }}>
                        {/* Search */}
                        <View style={s.searchWrap}>
                            <View style={s.searchBox}>
                                <Ionicons name="search-outline" size={16} color="#64748B" />
                                <TextInput
                                    style={s.searchInput}
                                    placeholder="Search geofences..."
                                    placeholderTextColor="#64748B"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch('')}>
                                        <Ionicons name="close-circle" size={16} color="#64748B" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Action Bar */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionBar}>
                            <TouchableOpacity style={s.toolBtn} onPress={selectAll}>
                                <Ionicons name="checkmark-done" size={15} color="#A78BFA" />
                                <Text style={s.toolText}>{selectedIds.length === geofences.length ? 'Deselect' : 'Select All'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.toolBtn, selectedIds.length > 0 && s.toolBtnDanger]} onPress={deleteSelected} disabled={!selectedIds.length}>
                                <Ionicons name="trash-outline" size={15} color={selectedIds.length ? '#F87171' : '#475569'} />
                                {selectedIds.length > 0 && <Text style={[s.toolText, { color: '#F87171' }]}>{selectedIds.length}</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}
                ListEmptyComponent={(
                    <View style={[s.empty, { marginHorizontal: 0 }]}>
                        <View style={s.emptyIconWrap}>
                            <Ionicons name="location-outline" size={40} color="#94A3B8" />
                        </View>
                        <Text style={s.emptyTitle}>No geofences yet</Text>
                        <Text style={s.emptySub}>Create your first geofence zone</Text>
                        <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/geofence-draw')}>
                            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                            <Text style={s.emptyBtnText}>Draw on Map</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />

            {showAdd && <AddModal toast={toast} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); fetchGeo(); }} />}
            {viewGf && <ViewModal gf={viewGf} onClose={() => setViewGf(null)} />}

            <ConfirmModal
                visible={showDeleteConfirm}
                icon="delete"
                title="Delete Geofences"
                message={`Are you sure you want to remove ${selectedIds.length} geofence${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`}
                confirmText="Delete"
                confirmColor="#EF4444"
                loading={deleteLoading}
                onConfirm={confirmDeleteSelected}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </View>
    );
}

function AddModal({ toast, onClose, onDone }) {
    const [name, setName] = useState('');
    const [coords, setCoords] = useState('');
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('manual');
    const [errors, setErrors] = useState({});

    const save = async () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Zone name is required';
        if (!coords.trim()) errs.coords = 'Coordinates are required';
        if (Object.keys(errs).length) return setErrors(errs);

        setErrors({});
        setSaving(true);
        try {
            const arr = JSON.parse(coords);
            if (!Array.isArray(arr) || arr.length < 3) {
                setErrors({ coords: 'Need at least 3 coordinate points' });
                setSaving(false);
                return;
            }
            const first = arr[0];
            const last = arr[arr.length - 1];
            const polygon = first[0] === last[0] && first[1] === last[1] ? arr : [...arr, [...first]];
            await geofenceApi.put(name.trim(), polygon);
            toast.success('Created', `Geofence "${name}" created successfully`);
            onDone();
        } catch (e) {
            setErrors({ coords: e.message });
        } finally { setSaving(false); }
    };

    return (
        <Modal visible transparent animationType="slide">
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={s.modalOverlay}>
                    <View style={s.modal}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>New Geofence</Text>
                            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                                <Ionicons name="close" size={20} color="#F1F5F9" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={s.fieldLabel}>Zone Name</Text>
                            <TextInput
                                style={[s.fieldInput, errors.name ? s.fieldInputError : null]}
                                placeholder="e.g. Warehouse-A"
                                placeholderTextColor="#94A3B8"
                                value={name}
                                onChangeText={v => { setName(v); setErrors(p => ({ ...p, name: '' })); }}
                            />
                            {errors.name ? <Text style={s.fieldError}>{errors.name}</Text> : null}

                            <View style={s.tabRow}>
                                {['manual', 'template'].map(t => (
                                    <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                                        <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'manual' ? 'Manual Input' : 'Templates'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {tab === 'template' && (
                                <View style={s.templatesWrap}>
                                    {Object.entries(TEMPLATES).map(([k, v]) => (
                                        <TouchableOpacity key={k} style={s.templateChip} onPress={() => { setCoords(JSON.stringify(v.coords, null, 2)); setErrors(p => ({ ...p, coords: '' })); }}>
                                            <Ionicons name="location" size={14} color="#7C3AED" />
                                            <Text style={s.templateText}>{v.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <Text style={s.fieldLabel}>Coordinates (JSON)</Text>
                            <TextInput
                                style={[s.fieldInput, { height: 120, textAlignVertical: 'top', paddingTop: 12 }, errors.coords ? s.fieldInputError : null]}
                                multiline
                                placeholder="[[105.8, 21.0], ...]"
                                placeholderTextColor="#94A3B8"
                                value={coords}
                                onChangeText={v => { setCoords(v); setErrors(p => ({ ...p, coords: '' })); }}
                            />
                            {errors.coords ? <Text style={s.fieldError}>{errors.coords}</Text> : null}

                            <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.8}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.saveBtnText}>Create Geofence</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function ViewModal({ gf, onClose }) {
    return (
        <Modal visible transparent animationType="fade">
            <View style={[s.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
                <View style={[s.modal, { borderRadius: 24 }]}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>{gf.GeofenceId}</Text>
                        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={20} color="#F1F5F9" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={s.detailRow}>
                            <Ionicons name="time-outline" size={16} color="#64748B" />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={s.detailLabel}>Created</Text>
                                <Text style={s.detailValue}>{new Date(gf.CreateTime).toLocaleString()}</Text>
                            </View>
                        </View>
                        <View style={s.detailRow}>
                            <Ionicons name="refresh-outline" size={16} color="#64748B" />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={s.detailLabel}>Updated</Text>
                                <Text style={s.detailValue}>{new Date(gf.UpdateTime).toLocaleString()}</Text>
                            </View>
                        </View>
                        <Text style={[s.fieldLabel, { marginTop: 16 }]}>Coordinates</Text>
                        <View style={s.codeBlock}>
                            <Text style={s.codeText}>{JSON.stringify(gf.Geometry?.Polygon, null, 2)}</Text>
                        </View>
                    </ScrollView>
                    <TouchableOpacity style={s.saveBtn} onPress={onClose} activeOpacity={0.8}>
                        <Text style={s.saveBtnText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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
    headerIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },

    statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, gap: 10 },
    statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: BORDER },
    statNum: { fontSize: 20, fontWeight: '800' },
    statLabel: { fontSize: 11, fontWeight: '600' },

    searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: BORDER },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: TEXT },
    actionBar: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    toolBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: CARD, gap: 6, borderWidth: 1, borderColor: BORDER },
    toolBtnDanger: { borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' },
    toolText: { fontSize: 12, fontWeight: '600', color: MUTED },

    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: BORDER },
    cardSelected: { borderColor: '#7C3AED', backgroundColor: 'rgba(124,58,237,0.1)' },
    checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#2D3548', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkboxActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    cardBody: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: '700', color: TEXT },
    cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 12, color: MUTED },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#2D3548', marginHorizontal: 8 },
    viewBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },

    empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
    emptySub: { fontSize: 13, color: MUTED, marginTop: 4 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 6, marginTop: 20 },
    emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modal: { backgroundColor: '#1A1F2E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '85%' },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2D3548', alignSelf: 'center', marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: TEXT },
    closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

    fieldLabel: { fontSize: 13, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 14 },
    fieldInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: TEXT, borderWidth: 1, borderColor: BORDER },
    fieldInputError: { borderColor: '#EF4444', borderWidth: 1.5 },
    fieldError: { color: '#F87171', fontSize: 12, fontWeight: '600', marginTop: 4, marginLeft: 4 },
    tabRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: CARD },
    tabActive: { backgroundColor: '#7C3AED' },
    tabText: { fontWeight: '600', fontSize: 13, color: MUTED },
    tabTextActive: { color: '#FFF' },
    templatesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    templateChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
    templateText: { fontSize: 13, fontWeight: '600', color: '#A78BFA' },

    saveBtn: { backgroundColor: '#7C3AED', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderColor: BORDER },
    detailLabel: { fontSize: 12, color: MUTED, fontWeight: '500' },
    detailValue: { fontSize: 14, color: TEXT, fontWeight: '600', marginTop: 1 },
    codeBlock: { backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
    codeText: { fontSize: 11, fontFamily: 'monospace', color: MUTED, lineHeight: 17 },
});
