import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';

interface ForgotPasswordResponse {
  message: string;
}

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/customers/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data: ForgotPasswordResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
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
              <i className="fas fa-key"></i>
            </div>
            <h1>Reset Password</h1>
            <p>Enter your email and we'll send you a reset link</p>
          </div>

          {submitted ? (
            <div className="auth-success-v2" role="status">
              <i className="fas fa-check-circle" aria-hidden="true"></i>
              <p>If an account exists for that email, a reset link has been sent. Check your inbox.</p>
            </div>
          ) : (
            <>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="auth-submit-btn"
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane" aria-hidden="true"></i>
                      Send Reset Link
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer-v2">
            <p>
              Remembered your password? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
