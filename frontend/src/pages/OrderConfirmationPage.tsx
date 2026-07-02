import { useState, useEffect, useRef, ReactNode } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

// ============================================
// Type Definitions
// ============================================

interface OrderBeat {
  id: string | number;
  title: string;
  coverArt?: string;
  bpm?: number;
  key?: string;
  genre?: string;
}

interface OrderItem {
  beat: OrderBeat;
  licenseType?: string;
  licenseName: string;
  price: number;
}

interface OrderCustomer {
  email: string;
  isGuest?: boolean;
}

type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

interface Order {
  orderNumber: string;
  paymentStatus: PaymentStatus;
  downloadToken: string;
  downloadExpiresAt?: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  customer?: OrderCustomer;
}

interface OrderApiResponse extends Order {
  message?: string;
}

// ============================================
// OrderConfirmationPage Component
// ============================================

export default function OrderConfirmationPage(): ReactNode {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { isAuthenticated } = useCustomerAuth();
  const toast = useToast();
  const hasShownToast = useRef<boolean>(false);
  const hasCleared = useRef<boolean>(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchOrder = async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderNumber}`);
      const data: OrderApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Order not found');
      }

      setOrder(data);

      // If payment is still pending and we came from success, poll for updates
      if (data.paymentStatus === 'PENDING' && isSuccess && !pollInterval.current) {
        pollInterval.current = setInterval(async () => {
          try {
            const res = await fetch(`${API_URL}/orders/${orderNumber}`);
            const updated: OrderApiResponse = await res.json();
            if (updated.paymentStatus === 'PAID') {
              setOrder(updated);
              if (pollInterval.current) {
                clearInterval(pollInterval.current);
                pollInterval.current = null;
              }
              if (!hasShownToast.current) {
                hasShownToast.current = true;
                toast.success('Payment Confirmed!', 'Your beats are ready to download');
              }
            }
          } catch {
            // Silent fail on poll
          }
        }, 3000);
      } else if (data.paymentStatus === 'PAID' && !hasShownToast.current) {
        hasShownToast.current = true;
        toast.success('Order Complete!', 'Your beats are ready to download');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page-v2">
        <div className="order-loading-v2">
          <div className="order-spinner-v2"></div>
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-page-v2">
        <div className="order-container-v2">
          <div className="order-error-card-v2">
            <div className="order-error-icon">
              <i className="fas fa-exclamation-circle"></i>
            </div>
            <h1>Order Not Found</h1>
            <p>{error}</p>
            <Link to="/beats" className="order-btn-primary">
              <i className="fas fa-arrow-left"></i>
              Back to Beats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isPending = order.paymentStatus === 'PENDING';

  return (
    <div className="order-page-v2">
      <div className="order-container-v2">
        {/* Status Header */}
        <div className="order-status-header-v2">
          {isPaid ? (
            <>
              <div className="order-status-icon success">
                <i className="fas fa-check-circle"></i>
              </div>
              <h1>Order Confirmed!</h1>
              <p>Thank you for your purchase. Your beats are ready to download.</p>
            </>
          ) : isPending && isSuccess ? (
            <>
              <div className="order-status-icon pending">
                <i className="fas fa-spinner fa-spin"></i>
              </div>
              <h1>Confirming Payment...</h1>
              <p>Please wait while we confirm your payment.</p>
            </>
          ) : (
            <>
              <div className="order-status-icon pending">
                <i className="fas fa-clock"></i>
              </div>
              <h1>Payment Pending</h1>
              <p>Complete your payment to access your beats.</p>
            </>
          )}
        </div>

        {/* Download Section - Prominent when paid */}
        {isPaid && (
          <div className="order-download-card-v2">
            <div className="order-download-header">
              <div className="order-download-icon">
                <i className="fas fa-cloud-download-alt"></i>
              </div>
              <div className="order-download-info">
                <h3>Your Downloads Are Ready</h3>
                <p>Click below to download your purchased beats</p>
              </div>
            </div>
            <Link to={`/download/${order.downloadToken}`} className="order-download-btn">
              <i className="fas fa-download"></i>
              Download All Files
            </Link>
            {order.customer?.isGuest && order.downloadExpiresAt && (
              <div className="order-expiry-notice">
                <i className="fas fa-info-circle"></i>
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
          <div className="order-processing-card-v2">
            <div className="order-processing-animation">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <p>This usually takes just a few seconds. The page will update automatically.</p>
          </div>
        )}

        {/* Order Details Card */}
        <div className="order-details-card-v2">
          <div className="order-card-header-v2">
            <div className="order-card-title">
              <h2>
                <i className="fas fa-receipt"></i>
                Order Details
              </h2>
              <span className="order-number-badge">#{order.orderNumber}</span>
            </div>
            <div className="order-card-meta">
              <span className={`order-status-badge ${order.paymentStatus.toLowerCase()}`}>
                <i className={`fas ${isPaid ? 'fa-check' : 'fa-clock'}`}></i>
                {order.paymentStatus}
              </span>
              <span className="order-date-v2">
                <i className="fas fa-calendar"></i>
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          {/* Items List */}
          <div className="order-items-v2">
            {order.items.map((item: OrderItem, index: number) => (
              <div key={index} className="order-item-v2">
                <div className="order-item-cover">
                  {item.beat.coverArt ? (
                    <img src={item.beat.coverArt} alt={item.beat.title} />
                  ) : (
                    <div className="order-item-cover-placeholder">
                      <i className="fas fa-music"></i>
                    </div>
                  )}
                </div>
                <div className="order-item-info">
                  <h4>{item.beat.title}</h4>
                  <div className="order-item-license">
                    <Link
                      to={`/licenses?type=${item.licenseType?.toLowerCase() || 'standard'}`}
                      className="order-license-link"
                    >
                      <i className="fas fa-file-contract"></i>
                      {item.licenseName}
                    </Link>
                  </div>
                  <div className="order-item-meta">
                    <span><i className="fas fa-drum"></i> {item.beat.bpm} BPM</span>
                    <span><i className="fas fa-music"></i> {item.beat.key}</span>
                    {item.beat.genre && <span><i className="fas fa-tag"></i> {item.beat.genre}</span>}
                  </div>
                </div>
                <div className="order-item-price">${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="order-summary-v2">
            <div className="order-summary-row">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="order-summary-row total">
              <span>Total</span>
              <span className="order-total-amount">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Guest Account Prompt */}
        {isPaid && order.customer?.isGuest && !isAuthenticated && (
          <div className="order-account-prompt-v2">
            <div className="order-prompt-icon">
              <i className="fas fa-user-plus"></i>
            </div>
            <div className="order-prompt-content">
              <h3>Create Your Account</h3>
              <p>Get unlimited access to your purchased beats, track your orders, and enjoy faster checkout.</p>
            </div>
            <Link
              to={`/register?email=${encodeURIComponent(order.customer.email)}`}
              className="order-btn-secondary"
            >
              <i className="fas fa-user-plus"></i>
              Create Account
            </Link>
          </div>
        )}

        {/* Email Confirmation */}
        <div className="order-email-notice-v2">
          <i className="fas fa-envelope"></i>
          <p>
            {isPaid ? 'A confirmation email has been sent to ' : 'Order details will be sent to '}
            <strong>{order.customer?.email}</strong>
          </p>
        </div>

        {/* Actions */}
        <div className="order-actions-v2">
          <Link to="/beats" className="order-action-link">
            <i className="fas fa-arrow-left"></i>
            Continue Shopping
          </Link>
          {isAuthenticated && (
            <Link to="/dashboard" className="order-action-link primary">
              <i className="fas fa-th-large"></i>
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
