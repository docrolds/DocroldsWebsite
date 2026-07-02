import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';

// Extended registration form data (includes optional fields not in context's RegisterFormData)
interface ExtendedRegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  stageName: string;
  phone: string;
}

export default function CustomerRegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useCustomerAuth();
  const toast = useToast();
  const [formData, setFormData] = useState<ExtendedRegisterFormData>({
    email: searchParams.get('email') || '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    stageName: '',
    phone: ''
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const customer = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      toast.success('Account Created!', `Welcome to Doc Rolds${customer.firstName ? `, ${customer.firstName}` : ''}`);
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      toast.error('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-v2">
      <div className="auth-container-v2">
        <div className="auth-card-v2 register">
          <div className="auth-header-v2">
            <div className="auth-icon">
              <i className="fas fa-user-plus"></i>
            </div>
            <h1>Create Account</h1>
            <p>Join the Doc Rolds community</p>
          </div>

          {error && (
            <div className="auth-error-v2" role="alert">
              <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-v2">
            <div className="form-field">
              <label htmlFor="email">Email *</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope"></i>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>
              <div className="form-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="stageName">Stage Name / Artist Name</label>
              <div className="input-with-icon">
                <i className="fas fa-microphone"></i>
                <input
                  type="text"
                  id="stageName"
                  name="stageName"
                  value={formData.stageName}
                  onChange={handleChange}
                  placeholder="Your artist name"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="phone">Phone</label>
              <div className="input-with-icon">
                <i className="fas fa-phone"></i>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password">Password *</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Confirm your password"
                  autoComplete="new-password"
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
                  Creating Account...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus" aria-hidden="true"></i>
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="auth-footer-v2">
            <p>
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </div>

          <div className="auth-benefits-v2">
            <h4>Benefits of creating an account:</h4>
            <ul>
              <li><i className="fas fa-check" aria-hidden="true"></i> Unlimited download access</li>
              <li><i className="fas fa-check" aria-hidden="true"></i> Save and organize your favorite beats</li>
              <li><i className="fas fa-check" aria-hidden="true"></i> Track your purchases</li>
              <li><i className="fas fa-check" aria-hidden="true"></i> Faster checkout</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
