import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const toast = useToast();
  const hasShownToast = useRef(false);
  const hasCleared = useRef(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollInterval = useRef(null);

  const isSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    // Clear cart on successful checkout return (only once)
    if (isSuccess && !hasCleared.current) {
      hasCleared.current = true;
      clearCart();
    }
    fetchOrder();

    // Poll for payment status updates if pending
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [orderNumber, isSuccess]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderNumber}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Order not found');
      }

      setOrder(data);

      // If payment is still pending and we came from success, poll for updates
      if (data.paymentStatus === 'PENDING' && isSuccess && !pollInterval.current) {
        pollInterval.current = setInterval(async () => {
          try {
            const res = await fetch(`${API_URL}/orders/${orderNumber}`);
            const updated = await res.json();
            if (updated.paymentStatus === 'PAID') {
              setOrder(updated);
              clearInterval(pollInterval.current);
              pollInterval.current = null;
              if (!hasShownToast.current) {
                hasShownToast.current = true;
                toast.success('Payment Confirmed!', 'Your beats are ready to download');
              }
            }
          } catch (e) {
            // Silent fail on poll
          }
        }, 3000);
      } else if (data.paymentStatus === 'PAID' && !hasShownToast.current) {
        hasShownToast.current = true;
        toast.success('Order Complete!', 'Your beats are ready to download');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="order-confirmation-page">
        <div className="order-loading">
          <div className="order-spinner"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-confirmation-page">
        <div className="order-container">
          <div className="order-error">
            <div className="error-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h1>Order Not Found</h1>
            <p>{error}</p>
            <Link to="/beats" className="btn-primary">
              <i className="fas fa-arrow-left"></i>
              Back to Beats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isPending = order.paymentStatus === 'PENDING';

  return (
    <div className="order-confirmation-page">
      <div className="order-container">
        {/* Status Header */}
        <div className="order-status-header">
          {isPaid ? (
            <>
              <div className="status-icon success">
                <i className="fas fa-check"></i>
              </div>
              <h1>Order Confirmed!</h1>
              <p>Thank you for your purchase. Your beats are ready to download.</p>
            </>
          ) : isPending && isSuccess ? (
            <>
              <div className="status-icon pending">
                <i className="fas fa-spinner fa-spin"></i>
              </div>
              <h1>Confirming Payment...</h1>
              <p>Please wait while we confirm your payment with Stripe.</p>
            </>
          ) : (
            <>
              <div className="status-icon pending">
                <i className="fas fa-clock"></i>
              </div>
              <h1>Payment Pending</h1>
              <p>Complete your payment to access your beats.</p>
            </>
          )}
        </div>

        {/* Order Card */}
        <div className="order-card">
          <div className="order-card-header">
            <div className="order-meta">
              <h2>Order #{order.orderNumber}</h2>
              <span className="order-date">
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <span className={`status-badge ${order.paymentStatus.toLowerCase()}`}>
              {order.paymentStatus}
            </span>
          </div>

          {/* Items List */}
          <div className="order-items">
            {order.items.map((item, index) => (
              <div key={index} className="order-item">
                <div className="item-cover">
                  {item.beat.coverArt ? (
                    <img src={item.beat.coverArt} alt={item.beat.title} />
                  ) : (
                    <div className="item-cover-placeholder">
                      <i className="fas fa-music"></i>
                    </div>
                  )}
                </div>
                <div className="item-details">
                  <h3>{item.beat.title}</h3>
                  <p className="item-license">
                    <Link
                      to={`/licenses?type=${item.licenseType?.toLowerCase() || 'standard'}`}
                      className="license-link"
                      title="View license terms"
                    >
                      {item.licenseName}
                      <i className="fas fa-external-link-alt"></i>
                    </Link>
                  </p>
                  <div className="item-meta">
                    <span>{item.beat.bpm} BPM</span>
                    <span>{item.beat.key}</span>
                    {item.beat.genre && <span>{item.beat.genre}</span>}
                  </div>
                </div>
                <div className="item-price">${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Order Total */}
          <div className="order-total">
            <span>Total</span>
            <span className="total-amount">${order.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Download Section */}
        {isPaid && (
          <div className="download-section">
            <div className="download-header">
              <i className="fas fa-download"></i>
              <div>
                <h3>Your Downloads Are Ready</h3>
                <p>Click below to download your purchased beats</p>
              </div>
            </div>
            <Link to={`/download/${order.downloadToken}`} className="download-button">
              <i className="fas fa-cloud-download-alt"></i>
              Download All Files
            </Link>
            {order.customer?.isGuest && order.downloadExpiresAt && (
              <div className="expiry-notice">
                <i className="fas fa-exclamation-triangle"></i>
                <span>
                  Download link expires {new Date(order.downloadExpiresAt).toLocaleDateString()}.
                  Create an account for unlimited access.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Processing Notice */}
        {isPending && isSuccess && (
          <div className="processing-notice">
            <div className="processing-animation">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <p>This usually takes just a few seconds. The page will update automatically.</p>
          </div>
        )}

        {/* Guest Account Prompt */}
        {isPaid && order.customer?.isGuest && !isAuthenticated && (
          <div className="account-prompt">
            <div className="prompt-icon">
              <i className="fas fa-user-plus"></i>
            </div>
            <div className="prompt-content">
              <h3>Create Your Account</h3>
              <p>Get unlimited access to your purchased beats, track your orders, and faster checkout.</p>
            </div>
            <Link
              to={`/register?email=${encodeURIComponent(order.customer.email)}`}
              className="btn-secondary"
            >
              Create Account
            </Link>
          </div>
        )}

        {/* Email Confirmation */}
        <div className="email-notice">
          <i className="fas fa-envelope"></i>
          <p>
            {isPaid ? 'A receipt has been sent to ' : 'Order details will be sent to '}
            <strong>{order.customer?.email}</strong>
          </p>
        </div>

        {/* Actions */}
        <div className="order-actions">
          <Link to="/beats" className="action-link">
            <i className="fas fa-arrow-left"></i>
            Continue Shopping
          </Link>
          {isAuthenticated && (
            <Link to="/dashboard" className="action-link">
              <i className="fas fa-th-large"></i>
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
