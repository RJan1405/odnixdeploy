import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/services/apiClient';
import { User } from '@/services/api';
import { getMediaUrl } from '@/config/api.config';

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    clearError: () => void;
}

interface RegisterData {
    username: string;
    email: string;
    password: string;
    password_confirm: string;
}

interface LoginResponse {
    success: boolean;
    user?: User;
    error?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if user is already authenticated on mount
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            setIsLoading(true);
            // Try to get current user profile
            const response = await apiClient.get<any>('/api/profile/');
            if (response.user) {
                // Transform snake_case to camelCase
                setUser({
                    id: response.user.id?.toString() || '',
                    username: response.user.username || '',
                    displayName: response.user.display_name || response.user.username || '',
                    avatar: getMediaUrl(response.user.avatar || response.user.profile_picture || ''),
                    isOnline: response.user.is_online || false,
                    isVerified: response.user.is_verified || false,
                });
            }
        } catch (error) {
            // User is not authenticated
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        try {
            setError(null);
            setIsLoading(true);

            const response = await apiClient.post<any>('/api/login/', {
                username,
                password,
            });

            if (response.success && response.user) {
                // Transform snake_case to camelCase
                setUser({
                    id: response.user.id?.toString() || '',
                    username: response.user.username || '',
                    displayName: response.user.display_name || response.user.username || '',
                    avatar: getMediaUrl(response.user.avatar || response.user.profile_picture || ''),
                    isOnline: response.user.is_online || false,
                    isVerified: response.user.is_verified || false,
                });
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            setError(null);
            await apiClient.post('/api/logout/');
            setUser(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Logout failed';
            setError(errorMessage);
            throw err;
        }
    };

    const register = async (data: RegisterData) => {
        try {
            setError(null);
            setIsLoading(true);

            await apiClient.post('/api/register/', data);

            // After successful registration, you might want to auto-login
            // or redirect to email verification page
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = () => {
        setError(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                register,
                isAuthenticated: !!user,
                isLoading,
                error,
                clearError,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
