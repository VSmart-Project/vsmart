import { View, Text, TextInput, StyleSheet } from 'react-native';

const BORDER = '#2D3548';
const TEXT = '#F1F5F9';
const MUTED = '#94A3B8';
const ERROR = '#F87171';

/**
 * FormField - Reusable form input with inline error handling
 * 
 * Features:
 * - Consistent styling across all forms
 * - Inline error messages below the field
 * - Error state visual feedback
 * - Support for multiline inputs
 * - Disabled state styling
 * 
 * @param {string} label - Field label
 * @param {string} value - Input value
 * @param {function} onChangeText - Change handler
 * @param {string} error - Error message (shows red border and message)
 * @param {string} placeholder - Placeholder text
 * @param {boolean} multiline - Enable multiline input
 * @param {number} height - Custom height for multiline
 * @param {boolean} editable - Enable/disable input
 * @param {object} inputProps - Additional TextInput props
 */
export default function FormField({
    label,
    value,
    onChangeText,
    error,
    placeholder,
    multiline = false,
    height,
    editable = true,
    ...inputProps
}) {
    return (
        <View style={s.container}>
            {label && <Text style={s.label}>{label}</Text>}
            <TextInput
                style={[
                    s.input,
                    multiline && { height: height || 120, textAlignVertical: 'top', paddingTop: 12 },
                    error && s.inputError,
                    !editable && s.inputDisabled,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={MUTED}
                multiline={multiline}
                editable={editable}
                {...inputProps}
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
        </View>
    );
}

const s = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: MUTED,
        marginBottom: 6,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        height: 48,
        paddingHorizontal: 14,
        fontSize: 15,
        color: TEXT,
        borderWidth: 1,
        borderColor: BORDER,
    },
    inputError: {
        borderColor: ERROR,
        borderWidth: 1.5,
    },
    inputDisabled: {
        opacity: 0.5,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    error: {
        color: ERROR,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
        marginLeft: 4,
    },
});
