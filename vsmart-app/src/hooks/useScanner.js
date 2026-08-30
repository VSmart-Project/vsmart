import { useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

/**
 * Hook to handle scanned values from the scanner screen
 * 
 * Usage:
 * const { openScanner } = useScanner({
 *   onScanned: (value, field) => {
 *     setForm({ ...form, [field]: value });
 *   }
 * });
 * 
 * // Open scanner
 * openScanner('deviceId');
 */
export function useScanner({ onScanned }) {
    const params = useLocalSearchParams();

    useEffect(() => {
        if (params.scannedValue && params.scannedField) {
            // Call the callback with scanned value
            onScanned(params.scannedValue, params.scannedField);
            
            // Clear the params to prevent re-triggering
            router.setParams({ 
                scannedValue: undefined, 
                scannedField: undefined,
                scannedType: undefined,
            });
        }
    }, [onScanned, params.scannedField, params.scannedValue]);

    const openScanner = (field = 'deviceId') => {
        router.push({
            pathname: '/scan',
            params: {
                returnTo: 'current',
                field,
            },
        });
    };

    return { openScanner };
}
