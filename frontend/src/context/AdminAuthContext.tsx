import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../config';

// Admin user interface
export interface AdminUser {
  id: string | number;
  username: string;
  email: string;
  role: 'admin' | 'superadmin' | 'moderator' | string;
}

// Login response from API
interface LoginResponse {
  token: string;
  user: AdminUser;
  message?: string;
}

// Context value interface with all functions and state
export interface AdminAuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<AdminUser>;
  loginWithToken: (token: string, userData: AdminUser) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

// Props for the provider component
interface AdminAuthProviderProps {
  children: ReactNode;
}

// Create context with undefined as default (will be checked in hook)
const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

// Custom hook with proper null handling
export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    console.warn('useAdminAuth called outside of AdminAuthProvider, returning fallback');
    return {
      admin: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      login: async (): Promise<AdminUser> => { throw new Error('Not in auth context'); },
      loginWithToken: (): void => { throw new Error('Not in auth context'); },
      logout: (): void => {},
      refreshProfile: async (): Promise<void> => {},
    };
  }
  return context;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps): JSX.Element {
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const stored = localStorage.getItem('adminUser');
    if (stored) {
      try {
        return JSON.parse(stored) as AdminUser;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('adminToken'));
  const [loading, setLoading] = useState<boolean>(true);

  // Validate token on mount by making a simple API call
  useEffect(() => {
    if (token && admin) {
      validateToken();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateToken = async (): Promise<void> => {
    try {
      // Use the auth/users endpoint to validate the token
      const res = await fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        // Token invalid, clear it
        logout();
      }
    } catch (error: unknown) {
      console.error('Failed to validate admin token:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<AdminUser> => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data: LoginResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUser', JSON.stringify(data.user));
    setToken(data.token);
    setAdmin(data.user);
    return data.user;
  };

  // Login with token directly (used by unified login)
  const loginWithToken = (newToken: string, userData: AdminUser): void => {
    localStorage.setItem('adminToken', newToken);
    localStorage.setItem('adminUser', JSON.stringify(userData));
    setToken(newToken);
    setAdmin(userData);
  };

  const logout = (): void => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setToken(null);
    setAdmin(null);
  };

  const value: AdminAuthContextValue = {
    admin,
    token,
    loading,
    isAuthenticated: !!admin,
    login,
    loginWithToken,
    logout,
    refreshProfile: validateToken
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}
