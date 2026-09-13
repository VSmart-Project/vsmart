import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, StyleSheet,
    ImageBackground, ScrollView, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    cognitoSignIn, cognitoSignUp, cognitoConfirmSignUp,
    cognitoResendCode, AuthEvents,
} from '../src/utils/cognitoAuth';
import { useToast } from '../src/components/ui/Toast';

const ACCENT = '#7C3AED';
const NAVY = '#0F172A';

export default function LoginScreen() {
    const [view, setView] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const insets = useSafeAreaInsets();
    const toast = useToast();

    const handleLogin = async () => {
        if (!email || !password) return setErrorMsg('Please enter email and password');
        setLoading(true);
        setErrorMsg('');
        try {
            await cognitoSignIn(email.trim(), password);
            AuthEvents.emit('signedIn');
        } catch (error) {
            if (error.code === 'UserNotConfirmedException' || error.status === 403) {
                setErrorMsg('Account not verified.');
                return setView('otp');
            }
            if (error.code === 'NotAuthorizedException' || error.status === 401) {
                return setErrorMsg('Incorrect email or password.');
            }
            setErrorMsg(error.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) return setErrorMsg('Please fill all fields');
        if (password !== confirmPassword) return setErrorMsg('Passwords do not match');
        setLoading(true);
        setErrorMsg('');
        try {
            await cognitoSignUp(email.trim(), password);
            toast.success('Account Created', 'Please check your email for verification code');
            setView('otp');
        } catch (e) { setErrorMsg(e.message || 'Registration failed.'); }
        finally { setLoading(false); }
    };

    const handleVerify = async () => {
        if (!otpCode || otpCode.length < 6) return setErrorMsg('Enter a 6-digit code');
        setLoading(true);
        setErrorMsg('');
        try {
            await cognitoConfirmSignUp(email.trim(), otpCode);
            toast.success('Verified', 'Your account has been verified successfully');
            setView('login');
            setPassword('');
        } catch (e) { setErrorMsg(e.message || 'Verification failed.'); }
        finally { setLoading(false); }
    };

    const handleResend = async () => {
        try {
            await cognitoResendCode(email.trim());
            toast.info('Code Sent', 'A new verification code has been sent to your email');
        } catch (e) { setErrorMsg(e.message || 'Failed to resend code.'); }
    };

    const onSubmit = () => {
        if (view === 'login') handleLogin();
        else if (view === 'register') handleRegister();
        else handleVerify();
    };

    return (
        <ImageBackground source={require('../assets/background.png')} style={s.root} resizeMode="cover">
            <StatusBar barStyle="light-content" />
            <View style={s.overlay} />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) }]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Text */}
                    {/* <Text style={s.headerTitle}>{headerTitle}</Text> */}

                    {/* Dark Card */}
                    <View style={s.card}>
                        <Text style={s.cardTitle}>
                            {view === 'login' ? 'Login' : view === 'register' ? 'Sign up' : 'Verify'}
                        </Text>
                        {view === 'login' && (
                            <TouchableOpacity onPress={() => { setView('register'); setErrorMsg(''); }}>
                                <Text style={s.switchText}>
                                    Don&apos;t Have An Account? <Text style={s.switchLink}>Sign Up</Text>
                                </Text>
                            </TouchableOpacity>
                        )}
                        {view === 'register' && (
                            <TouchableOpacity onPress={() => { setView('login'); setErrorMsg(''); }}>
                                <Text style={s.switchText}>
                                    Already Have An Account? <Text style={s.switchLink}>Sign In</Text>
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Form Fields */}
                        {(view === 'login' || view === 'register') && (
                            <>
                                <View style={[s.inputRow, errorMsg && !email ? s.inputRowError : null]}>
                                    <Ionicons name="mail-outline" size={18} color="#64748B" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        placeholder="Enter your email address"
                                        placeholderTextColor="#4B5563"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={v => { setEmail(v); if (errorMsg) setErrorMsg(''); }}
                                    />
                                </View>

                                <View style={[s.inputRow, errorMsg && !password ? s.inputRowError : null]}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
                                    <TextInput
                                        style={s.input}
                                        placeholder="Password"
                                        placeholderTextColor="#4B5563"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={v => { setPassword(v); if (errorMsg) setErrorMsg(''); }}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                                        <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {view === 'register' && (
                            <View style={[s.inputRow, errorMsg && password !== confirmPassword ? s.inputRowError : null]}>
                                <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" style={s.inputIcon} />
                                <TextInput
                                    style={s.input}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#4B5563"
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={v => { setConfirmPassword(v); if (errorMsg) setErrorMsg(''); }}
                                />
                            </View>
                        )}

                        {errorMsg ? <Text style={s.fieldError}>{errorMsg}</Text> : null}

                        {view === 'otp' && (
                            <View style={{ alignItems: 'center', marginTop: 8 }}>
                            <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                                Verification code sent to {email}
                                </Text>
                                <View style={[s.inputRow, { width: 200, alignSelf: 'center' }]}>
                                    <TextInput
                                        style={[s.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8 }]}
                                        placeholder="000000"
                                        placeholderTextColor="#4B5563"
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        value={otpCode}
                                        onChangeText={t => { setOtpCode(t.replace(/\D/g, '')); if (errorMsg) setErrorMsg(''); }}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Remember Me / Forgot */}
                        {view === 'login' && (
                            <View style={s.rememberRow}>
                                <Text style={s.rememberText}>Remember Me</Text>
                                <TouchableOpacity>
                                    <Text style={s.forgotText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[s.btn, loading && s.btnDisabled]}
                            onPress={onSubmit}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={s.btnText}>
                                    {view === 'login' ? 'Login' : view === 'register' ? 'Sign Up' : 'Verify'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* OTP Actions */}
                        {view === 'otp' && (
                            <View style={{ alignItems: 'center', marginTop: 16 }}>
                                <TouchableOpacity onPress={handleResend}>
                                    <Text style={s.switchLink}>Resend Code</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setView('register'); setErrorMsg(''); }} style={{ marginTop: 12 }}>
                                    <Text style={{ color: '#64748B', fontSize: 13 }}>Go Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: NAVY },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,15,30,0.75)' },

    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    headerTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', lineHeight: 38, marginBottom: 24, paddingHorizontal: 4 },

    card: {
        backgroundColor: 'rgba(20,27,45,0.92)',
        borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    cardTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 4 },
    switchText: { color: '#94A3B8', fontSize: 13, marginBottom: 20 },
    switchLink: { color: ACCENT, fontWeight: '700' },

    fieldError: { color: '#F87171', fontSize: 12, fontWeight: '600', marginBottom: 10, marginLeft: 4 },

    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        height: 52, paddingHorizontal: 16,
        marginBottom: 14,
    },
    inputRowError: { borderColor: '#EF4444', borderWidth: 1.5 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: '#FFF', fontSize: 15 },
    eyeBtn: { padding: 4 },

    rememberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 2 },
    rememberText: { color: '#94A3B8', fontSize: 13 },
    forgotText: { color: ACCENT, fontSize: 13, fontWeight: '600' },

    btn: {
        backgroundColor: ACCENT, height: 54, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
