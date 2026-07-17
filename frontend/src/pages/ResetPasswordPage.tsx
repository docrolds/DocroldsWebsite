import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';

interface ResetPasswordResponse {
  message: string;
}

export default function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/customers/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data: ResetPasswordResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page-v2">
        <div className="auth-container-v2">
          <div className="auth-card-v2">
            <div className="auth-header-v2">
              <div className="auth-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h1>Invalid Link</h1>
              <p>This password reset link is missing or malformed.</p>
            </div>
            <div className="auth-footer-v2">
              <p>
                <Link to="/forgot-password">Request a new reset link</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-v2">
      <div className="auth-container-v2">
        <div className="auth-card-v2">
          <div className="auth-header-v2">
            <div className="auth-icon">
              <i className="fas fa-key"></i>
            </div>
            <h1>Set New Password</h1>
            <p>Choose a new password for your account</p>
          </div>

          {success ? (
            <div className="auth-success-v2" role="status">
              <i className="fas fa-check-circle" aria-hidden="true"></i>
              <p>Password reset! Redirecting you to sign in...</p>
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
                  <label htmlFor="newPassword">New Password</label>
                  <div className="input-with-icon">
                    <i className="fas fa-lock"></i>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-with-icon">
                    <i className="fas fa-lock"></i>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
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
                      Resetting...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check" aria-hidden="true"></i>
                      Reset Password
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer-v2">
            <p>
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
