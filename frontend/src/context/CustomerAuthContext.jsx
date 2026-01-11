import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const CustomerAuthContext = createContext();

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    console.warn('useCustomerAuth called outside of CustomerAuthProvider, returning fallback');
    return {
      customer: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      isImpersonating: false,
      login: async () => { throw new Error('Not in auth context'); },
      register: async () => { throw new Error('Not in auth context'); },
      logout: () => {},
      updateProfile: async () => { throw new Error('Not in auth context'); },
      uploadProfilePicture: async () => { throw new Error('Not in auth context'); },
      changePassword: async () => { throw new Error('Not in auth context'); },
      refreshProfile: async () => {},
    };
  }
  return context;
}

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('customerToken'));
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

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

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/customers/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
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

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('customerToken', data.token);
    setToken(data.token);
    setCustomer(data.customer);
    return data.customer;
  };

  const register = async (formData) => {
    const res = await fetch(`${API_URL}/customers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    localStorage.setItem('customerToken', data.token);
    setToken(data.token);
    setCustomer(data.customer);
    return data.customer;
  };

  const logout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('isImpersonating');
    setToken(null);
    setCustomer(null);
    setIsImpersonating(false);
  };

  const updateProfile = async (updates) => {
    const res = await fetch(`${API_URL}/customers/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Update failed');
    }

    setCustomer(data);
    return data;
  };

  const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const res = await fetch(`${API_URL}/customers/me/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Upload failed');
    }

    setCustomer(prev => ({ ...prev, profilePicture: data.profilePicture }));
    return data.profilePicture;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await fetch(`${API_URL}/customers/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Password change failed');
    }

    return true;
  };

  const value = {
    customer,
    token,
    loading,
    isAuthenticated: !!customer,
    isImpersonating,
    login,
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
