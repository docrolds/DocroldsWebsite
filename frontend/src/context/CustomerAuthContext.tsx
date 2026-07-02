import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_URL } from '../config';

// Customer interface representing the user data
export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Registration form data interface
export interface RegisterFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Profile update data interface
export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
}

// API response interfaces
interface LoginResponse {
  token: string;
  customer: Customer;
  message?: string;
}

interface RegisterResponse {
  token: string;
  customer: Customer;
  message?: string;
}

interface ProfilePictureResponse {
  profilePicture: string;
  message?: string;
}

interface ApiErrorResponse {
  message: string;
}

// Context value interface with all functions and state
export interface CustomerAuthContextValue {
  customer: Customer | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<Customer>;
  loginWithToken: (token: string, customerData: Customer) => void;
  register: (formData: RegisterFormData) => Promise<Customer>;
  logout: () => void;
  updateProfile: (updates: ProfileUpdateData) => Promise<Customer>;
  uploadProfilePicture: (file: File) => Promise<string>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

// Props interface for the provider component
interface CustomerAuthProviderProps {
  children: ReactNode;
}

// Create context with undefined default (will be checked in hook)
const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

// Fallback context value for when hook is used outside provider
const createFallbackContext = (): CustomerAuthContextValue => ({
  customer: null,
  token: null,
  loading: false,
  isAuthenticated: false,
  isImpersonating: false,
  login: async (): Promise<Customer> => { throw new Error('Not in auth context'); },
  loginWithToken: (): void => { throw new Error('Not in auth context'); },
  register: async (): Promise<Customer> => { throw new Error('Not in auth context'); },
  logout: (): void => {},
  updateProfile: async (): Promise<Customer> => { throw new Error('Not in auth context'); },
  uploadProfilePicture: async (): Promise<string> => { throw new Error('Not in auth context'); },
  changePassword: async (): Promise<boolean> => { throw new Error('Not in auth context'); },
  refreshProfile: async (): Promise<void> => {},
});

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    console.warn('useCustomerAuth called outside of CustomerAuthProvider, returning fallback');
    return createFallbackContext();
  }
  return context;
}

export function CustomerAuthProvider({ children }: CustomerAuthProviderProps): JSX.Element {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('customerToken'));
  const [loading, setLoading] = useState<boolean>(true);
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);

  // Check for impersonation token on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const impersonateToken = urlParams.get('impersonate');

    if (impersonateToken) {
      // Clear the URL parameter without reloading
      window.history.replaceState({}, document.title, window.location.pathname);

      // Set the impersonation token
      localStorage.setItem('customerToken', impersonateToken);
      localStorage.setItem('isImpersonating', 'true');
      setToken(impersonateToken);
      setIsImpersonating(true);
    } else {
      // Check if we're already in impersonation mode
      const impersonating = localStorage.getItem('isImpersonating') === 'true';
      setIsImpersonating(impersonating);
    }
  }, []);

  // Fetch customer profile on mount if token exists
  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/customers/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data: Customer = await res.json();
        setCustomer(data);
      } else {
        // Token invalid, clear it
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<Customer> => {
    const res = await fetch(`${API_URL}/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data: LoginResponse | ApiErrorResponse = await res.json();

    if (!res.ok) {
      throw new Error((data as ApiErrorResponse).message || 'Login failed');
    }

    const loginData = data as LoginResponse;
    localStorage.setItem('customerToken', loginData.token);
    setToken(loginData.token);
    setCustomer(loginData.customer);
    return loginData.customer;
  };

  // Login with token directly (used by unified login)
  const loginWithToken = (newToken: string, customerData: Customer): void => {
    localStorage.setItem('customerToken', newToken);
    setToken(newToken);
    setCustomer(customerData);
  };

  const register = async (formData: RegisterFormData): Promise<Customer> => {
    const res = await fetch(`${API_URL}/customers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data: RegisterResponse | ApiErrorResponse = await res.json();

    if (!res.ok) {
      throw new Error((data as ApiErrorResponse).message || 'Registration failed');
    }

    const registerData = data as RegisterResponse;
    localStorage.setItem('customerToken', registerData.token);
    setToken(registerData.token);
    setCustomer(registerData.customer);
    return registerData.customer;
  };

  const logout = (): void => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('isImpersonating');
    setToken(null);
    setCustomer(null);
    setIsImpersonating(false);
  };

  const updateProfile = async (updates: ProfileUpdateData): Promise<Customer> => {
    const res = await fetch(`${API_URL}/customers/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    const data: Customer | ApiErrorResponse = await res.json();

    if (!res.ok) {
      throw new Error((data as ApiErrorResponse).message || 'Update failed');
    }

    const updatedCustomer = data as Customer;
    setCustomer(updatedCustomer);
    return updatedCustomer;
  };

  const uploadProfilePicture = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const res = await fetch(`${API_URL}/customers/me/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data: ProfilePictureResponse | ApiErrorResponse = await res.json();

    if (!res.ok) {
      throw new Error((data as ApiErrorResponse).message || 'Upload failed');
    }

    const pictureData = data as ProfilePictureResponse;
    setCustomer((prev: Customer | null) =>
      prev ? { ...prev, profilePicture: pictureData.profilePicture } : null
    );
    return pictureData.profilePicture;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    const res = await fetch(`${API_URL}/customers/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data: { message?: string } = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Password change failed');
    }

    return true;
  };

  const value: CustomerAuthContextValue = {
    customer,
    token,
    loading,
    isAuthenticated: !!customer,
    isImpersonating,
    login,
    loginWithToken,
    register,
    logout,
    updateProfile,
    uploadProfilePicture,
    changePassword,
    refreshProfile: fetchProfile
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}
