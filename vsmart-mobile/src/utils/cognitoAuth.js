import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL } from '../configuration';

const TOKEN_KEY = 'auth_tokens';

const _listeners = new Set();

export const AuthEvents = {
    subscribe(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },
    emit(event) { _listeners.forEach(fn => fn(event)); },
};

async function authFetch(path, body) {
    const res = await fetch(`${BACKEND_URL}/api/auth${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.message || `HTTP ${res.status}`);
        err.code = data.code;
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function cognitoSignIn(email, password) {
    const data = await authFetch('/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify({
        idToken: data.idToken,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    }));
    return data;
}

export async function cognitoSignUp(email, password) {
    return authFetch('/register', { email, password });
}

export async function cognitoConfirmSignUp(email, code) {
    return authFetch('/confirm', { email, code });
}

export async function cognitoResendCode(email) {
    return authFetch('/resend-code', { email });
}

export async function cognitoSignOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getCurrentSession() {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) throw new Error('No current session');
    const tokens = JSON.parse(raw);
    return {
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isValid: tokens.expiresAt > Date.now(),
    };
}
