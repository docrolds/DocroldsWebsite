import { useState, useEffect, useRef } from 'react';
import { useCustomerAuth, Customer } from '../context/CustomerAuthContext';

const TIMEOUT_MS = 10000; // 10 second timeout

// Props interface for the AuthPromptModal component
interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
  onError?: (message: string) => void;
}

// Form data interfaces
interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

type TabType = 'login' | 'register';

export default function AuthPromptModal({ isOpen, onClose, onSuccess, onError }: AuthPromptModalProps): JSX.Element | null {
  const { login, register } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Login form state
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: ''
  });

  // Register form state
  const [registerData, setRegisterData] = useState<RegisterFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('');
      setLoading(false);
      setActiveTab('login');
      setLoginData({ email: '', password: '' });
      setRegisterData({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === modalRef.current && !loading) {
      onClose();
    }
  };

  // Handle login form change
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setLoginData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  // Handle register form change
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setRegisterData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  // Handle login submit
  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Request timed out. Please try again.');
      if (onError) onError('Request timed out');
    }, TIMEOUT_MS);

    try {
      const customer = await login(loginData.email, loginData.password);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      if (onSuccess) onSuccess(customer);
      onClose();
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Invalid email or password';
      setError(message);
      if (onError) onError(message);
    }
  };

  // Handle register submit
  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    // Validation
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Request timed out. Please try again.');
      if (onError) onError('Request timed out');
    }, TIMEOUT_MS);

    try {
      const customer = await register({
        email: registerData.email,
        password: registerData.password,
        firstName: registerData.firstName,
        lastName: registerData.lastName
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      if (onSuccess) onSuccess(customer);
      onClose();
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      if (onError) onError(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="auth-prompt-overlay"
      ref={modalRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
    >
      <div className="auth-prompt-modal">
        {/* Close button */}
        <button
          className="auth-prompt-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Header */}
        <div className="auth-prompt-header">
          <div className="auth-prompt-icon">
            <i className="fas fa-heart"></i>
          </div>
          <h2 id="auth-prompt-title">Sign in to continue</h2>
          <p>Create an account or sign in to like beats and save them to your collection.</p>
        </div>

        {/* Tabs */}
        <div className="auth-prompt-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'login'}
            className={`auth-prompt-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(''); }}
            disabled={loading}
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'register'}
            className={`auth-prompt-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(''); }}
            disabled={loading}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="auth-prompt-error" role="alert">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-prompt-form">
            <div className="form-field">
              <label htmlFor="login-email">Email</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope"></i>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  required
                  placeholder="your@email.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-prompt-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Signing in...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  Sign In
                </>
              )}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-prompt-form">
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="register-firstName">First Name</label>
                <input
                  type="text"
                  id="register-firstName"
                  name="firstName"
                  value={registerData.firstName}
                  onChange={handleRegisterChange}
                  placeholder="John"
                  autoComplete="given-name"
                  disabled={loading}
                />
              </div>
              <div className="form-field">
                <label htmlFor="register-lastName">Last Name</label>
                <input
                  type="text"
                  id="register-lastName"
                  name="lastName"
                  value={registerData.lastName}
                  onChange={handleRegisterChange}
                  placeholder="Doe"
                  autoComplete="family-name"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="register-email">Email *</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope"></i>
                <input
                  type="email"
                  id="register-email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  required
                  placeholder="your@email.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="register-password">Password *</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="register-password"
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  required
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="register-confirmPassword">Confirm Password *</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="register-confirmPassword"
                  name="confirmPassword"
                  value={registerData.confirmPassword}
                  onChange={handleRegisterChange}
                  required
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-prompt-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Creating Account...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus"></i>
                  Create Account
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
