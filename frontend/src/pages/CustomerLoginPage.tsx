import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCustomerAuth, Customer } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

// API response interfaces
interface UnifiedLoginResponse {
  token: string;
  role: 'admin' | 'customer';
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  customer?: Customer;
  message?: string;
}

export default function CustomerLoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken: customerLoginWithToken } = useCustomerAuth();
  const toast = useToast();
  const [email, setEmail] = useState<string>(searchParams.get('email') || '');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use unified login endpoint
      const res = await fetch(`${API_URL}/auth/unified-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data: UnifiedLoginResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Handle based on role returned
      if (data.role === 'admin' && data.user) {
        // Admin login - store directly to localStorage since we're outside AdminAuthProvider
        // The AdminAuthProvider will pick these up when we navigate to /admin
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        toast.success('Welcome back!', `Logged in as ${data.user.username}`);
        // Redirect to React admin dashboard
        window.location.href = '/admin';
      } else if (data.customer) {
        // Customer login - store customer credentials and redirect to customer area
        customerLoginWithToken(data.token, data.customer);
        toast.success('Welcome back!', data.customer.firstName ? `Good to see you, ${data.customer.firstName}` : 'Login successful');
        navigate(returnTo);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast.error('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-v2">
      <div className="auth-container-v2">
        <div className="auth-card-v2">
          <div className="auth-header-v2">
            <div className="auth-icon">
              <i className="fas fa-user"></i>
            </div>
            <h1>Sign In</h1>
            <p>Welcome back to Doc Rolds</p>
          </div>

          {error && (
            <div className="auth-error-v2" role="alert">
              <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-v2">
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope"></i>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  Signing in...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt" aria-hidden="true"></i>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-footer-v2">
            <p>
              Don't have an account?{' '}
              <Link to="/register">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
