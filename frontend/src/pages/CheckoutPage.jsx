import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { customer, isAuthenticated } = useCustomerAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });

  // Check if checkout was cancelled
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      setError('Checkout was cancelled. You can try again when ready.');
      toast.warning('Checkout Cancelled', 'Your order was not placed. You can try again when ready.');
    }
  }, [searchParams]);

  // Populate form with customer data if logged in
  useEffect(() => {
    if (customer) {
      setFormData({
        email: customer.email || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || ''
      });
    }
  }, [customer]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/beats');
    }
  }, [cartItems.length, navigate]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Prepare items for checkout
      const items = cartItems.map(item => ({
        beatId: item.beat.id,
        licenseType: item.license.id.toUpperCase() // STANDARD or UNLIMITED
      }));

      const response = await fetch(`${API_URL}/checkout/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          customer: formData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;

    } catch (err) {
      setError(err.message);
      toast.error('Checkout Failed', err.message);
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className="page-container">
      <section className="checkout-section">
        <h1 className="page-title">Checkout</h1>
        <p className="page-subtitle">Complete your purchase</p>

        <div className="checkout-container">
          {/* Order Summary */}
          <div className="checkout-card order-summary">
            <h2 className="checkout-card-title">
              <i className="fas fa-shopping-cart" aria-hidden="true"></i>
              Order Summary
            </h2>

            <div className="order-items">
              {cartItems.map((item, index) => (
                <div key={index} className="order-item">
                  {item.beat.coverArt ? (
                    <img
                      src={item.beat.coverArt}
                      alt={item.beat.title}
                      className="order-item-image"
                    />
                  ) : (
                    <div className="order-item-image-placeholder" aria-hidden="true">
                      <i className="fas fa-music"></i>
                    </div>
                  )}
                  <div className="order-item-details">
                    <h3 className="order-item-title">{item.beat.title}</h3>
                    <p className="order-item-license">{item.license.name}</p>
                    <div className="order-item-meta">
                      {item.beat.bpm && <span>{item.beat.bpm} BPM</span>}
                      {item.beat.key && <span>{item.beat.key}</span>}
                    </div>
                  </div>
                  <div className="order-item-price">${item.license.price}</div>
                </div>
              ))}
            </div>

            <div className="order-totals">
              <div className="order-subtotal">
                <span>Subtotal</span>
                <span>${getCartTotal().toFixed(2)}</span>
              </div>
              <div className="order-total">
                <span>Total</span>
                <span className="total-price">${getCartTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="checkout-card customer-info">
            <h2 className="checkout-card-title">
              <i className="fas fa-user" aria-hidden="true"></i>
              {isAuthenticated ? 'Confirm Your Details' : 'Customer Information'}
            </h2>

            {!isAuthenticated && (
              <div className="checkout-login-prompt">
                <i className="fas fa-info-circle" aria-hidden="true"></i>
                <p>
                  Already have an account?{' '}
                  <Link to="/login?returnTo=/checkout">Sign in</Link>{' '}
                  for faster checkout and unlimited download access.
                </p>
              </div>
            )}

            {error && (
              <div className="form-error" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleCheckout} className="checkout-form">
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isAuthenticated}
                  placeholder="your@email.com"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 555-5555"
                />
              </div>

              {!isAuthenticated && (
                <div className="checkout-guest-notice">
                  <i className="fas fa-clock" aria-hidden="true"></i>
                  <p>
                    <strong>Note:</strong> As a guest, your download link will expire in 7 days.
                    Create an account after purchase for unlimited access to your beats.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="checkout-btn"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-lock" aria-hidden="true"></i>
                    Proceed to Payment - ${getCartTotal().toFixed(2)}
                  </>
                )}
              </button>

              <div className="checkout-secure">
                <i className="fab fa-stripe" aria-hidden="true"></i>
                <span>Secure payment powered by Stripe</span>
              </div>
            </form>
          </div>
        </div>

        <div className="checkout-back-link">
          <Link to="/beats">
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            Continue Shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
