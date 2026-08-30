import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../src/components/ui/Toast';

const BG = '#0B0F1A';
const TEXT = '#F1F5F9';
const MUTED = '#94A3B8';
const ACCENT = '#7C3AED';

export default function ScanScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const toast = useToast();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [flashEnabled, setFlashEnabled] = useState(false);

    // Request permission on mount if not granted
    useEffect(() => {
        if (permission && !permission.granted && permission.canAskAgain) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const handleBarCodeScanned = ({ type, data }) => {
        if (scanned) return;
        
        setScanned(true);
        
        // Normalize scanned value
        const normalized = normalizeScannedValue(data);
        
        // Validate
        const validation = validateScannedValue(normalized);
        
        if (!validation.valid) {
            // Show error toast and navigate back
            toast.error('Invalid Code', validation.error);
            setTimeout(() => {
                handleClose();
            }, 1500);
            return;
        }
        
        // Navigate back with scanned value
        handleClose(normalized, params.field || 'deviceId', type);
    };

    const handleClose = (scannedValue, scannedField, scannedType) => {
        // Navigate back with params if we have scanned data
        if (scannedValue) {
            router.navigate({
                pathname: '/(tabs)/devices',
                params: {
                    scannedValue,
                    scannedField,
                    scannedType,
                }
            });
        } else {
            // Just go back without params
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/devices');
            }
        }
    };

    const toggleFlash = () => {
        setFlashEnabled(!flashEnabled);
    };

    // Permission not determined yet
    if (!permission) {
        return (
            <View style={s.container}>
                <View style={s.loadingContainer}>
                    <Text style={s.loadingText}>Loading camera...</Text>
                </View>
            </View>
        );
    }

    // Permission denied
    if (!permission.granted) {
        return (
            <View style={s.container}>
                <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                        <Ionicons name="close" size={24} color={TEXT} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Camera Access</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={s.permissionContainer}>
                    <View style={s.permissionIconWrap}>
                        <Ionicons name="camera-outline" size={48} color={ACCENT} />
                    </View>
                    <Text style={s.permissionTitle}>Camera Permission Required</Text>
                    <Text style={s.permissionMessage}>
                        VSmart needs camera access to scan QR codes and barcodes for device identification.
                    </Text>
                    
                    {permission.canAskAgain ? (
                        <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
                            <Ionicons name="camera" size={20} color="#FFF" />
                            <Text style={s.permissionBtnText}>Grant Camera Access</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={s.permissionDenied}>
                            <Text style={s.permissionDeniedText}>
                                Camera access was denied. Please enable it in your device settings.
                            </Text>
                            <TouchableOpacity style={s.settingsBtn} onPress={handleClose}>
                                <Text style={s.settingsBtnText}>Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // Camera ready
    return (
        <View style={s.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: [
                        'qr',
                        'ean13',
                        'ean8',
                        'code128',
                        'code39',
                        'code93',
                        'codabar',
                        'itf14',
                        'upc_a',
                        'upc_e',
                        'pdf417',
                        'aztec',
                        'datamatrix',
                    ],
                }}
                enableTorch={flashEnabled}
            >
                {/* Header */}
                <View style={[s.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
                        <Ionicons name="close" size={24} color={TEXT} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Scan Code</Text>
                    <TouchableOpacity style={s.flashBtn} onPress={toggleFlash}>
                        <Ionicons 
                            name={flashEnabled ? 'flash' : 'flash-off'} 
                            size={24} 
                            color={flashEnabled ? ACCENT : TEXT} 
                        />
                    </TouchableOpacity>
                </View>

                {/* Scanning Frame */}
                <View style={s.scannerContainer}>
                    <View style={s.scannerFrame}>
                        <View style={[s.corner, s.cornerTopLeft]} />
                        <View style={[s.corner, s.cornerTopRight]} />
                        <View style={[s.corner, s.cornerBottomLeft]} />
                        <View style={[s.corner, s.cornerBottomRight]} />
                    </View>
                    <Text style={s.scannerText}>
                        Position the QR code or barcode within the frame
                    </Text>
                </View>

                {/* Instructions */}
                <View style={[s.footer, { paddingBottom: insets.bottom + 20 }]}>
                    <View style={s.instructionCard}>
                        <View style={s.instructionRow}>
                            <Ionicons name="qr-code-outline" size={20} color={ACCENT} />
                            <Text style={s.instructionText}>QR Code</Text>
                        </View>
                        <View style={s.instructionRow}>
                            <Ionicons name="barcode-outline" size={20} color={ACCENT} />
                            <Text style={s.instructionText}>Barcode</Text>
                        </View>
                        <View style={s.instructionRow}>
                            <Ionicons name="phone-portrait-outline" size={20} color={ACCENT} />
                            <Text style={s.instructionText}>IMEI</Text>
                        </View>
                    </View>
                </View>
            </CameraView>
        </View>
    );
}

/**
 * Normalize scanned value
 * - Trim whitespace
 * - Remove spaces
 * - Convert to uppercase for consistency
 */
function normalizeScannedValue(value) {
    if (!value) return '';
    return value.trim().replace(/\s+/g, '').toUpperCase();
}

/**
 * Validate scanned value
 * - Check length (3-50 characters)
 * - Check allowed characters (alphanumeric, dash, underscore)
 */
function validateScannedValue(value) {
    if (!value || value.length === 0) {
        return { valid: false, error: 'Scanned code is empty' };
    }

    if (value.length < 3) {
        return { valid: false, error: 'Code is too short (minimum 3 characters)' };
    }

    if (value.length > 50) {
        return { valid: false, error: 'Code is too long (maximum 50 characters)' };
    }

    // Allow alphanumeric, dash, underscore, and colon (for some barcode formats)
    const allowedPattern = /^[A-Z0-9\-_:]+$/;
    if (!allowedPattern.test(value)) {
        return { 
            valid: false, 
            error: 'Code contains invalid characters. Only letters, numbers, dash, and underscore are allowed.' 
        };
    }

    return { valid: true };
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 15,
        color: MUTED,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: 'rgba(11, 15, 26, 0.9)',
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: TEXT,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flashBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 280,
        height: 280,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: ACCENT,
    },
    cornerTopLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 8,
    },
    cornerTopRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 8,
    },
    cornerBottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 8,
    },
    cornerBottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 8,
    },
    scannerText: {
        marginTop: 32,
        fontSize: 14,
        color: TEXT,
        textAlign: 'center',
        paddingHorizontal: 40,
        backgroundColor: 'rgba(11, 15, 26, 0.8)',
        paddingVertical: 12,
        borderRadius: 12,
    },
    footer: {
        paddingHorizontal: 20,
        backgroundColor: 'rgba(11, 15, 26, 0.9)',
    },
    instructionCard: {
        backgroundColor: 'rgba(21, 26, 42, 0.95)',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.3)',
    },
    instructionRow: {
        alignItems: 'center',
        gap: 6,
    },
    instructionText: {
        fontSize: 12,
        color: MUTED,
        fontWeight: '600',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    permissionIconWrap: {
        width: 96,
        height: 96,
        borderRadius: 24,
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    permissionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: TEXT,
        textAlign: 'center',
        marginBottom: 12,
    },
    permissionMessage: {
        fontSize: 15,
        color: MUTED,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    permissionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ACCENT,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    permissionBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    permissionDenied: {
        alignItems: 'center',
    },
    permissionDeniedText: {
        fontSize: 14,
        color: MUTED,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    settingsBtn: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    settingsBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: TEXT,
    },
});
