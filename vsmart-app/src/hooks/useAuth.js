import { useState, useEffect, useCallback } from 'react';
import { getCurrentSession, cognitoSignOut, AuthEvents } from '../utils/cognitoAuth';

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    const checkAuth = useCallback(async () => {
        try {
            const session = await getCurrentSession();
            setIsAuthenticated(session.isValid);
        } catch {
            setIsAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
        return AuthEvents.subscribe((event) => {
            if (event === 'signedIn') setIsAuthenticated(true);
            else if (event === 'signedOut') setIsAuthenticated(false);
        });
    }, [checkAuth]);

    const logout = () => {
        cognitoSignOut();
        AuthEvents.emit('signedOut');
    };

    return { isAuthenticated, logout, checkAuth };
}
