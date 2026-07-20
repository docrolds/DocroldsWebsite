import { useState, useEffect, useRef, ChangeEvent, FormEvent, ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadStripe, Stripe as StripeJs } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart, CartItem } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

// ============================================
// Type Definitions
// ============================================

interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface SquareConfig {
  applicationId: string;
  locationId: string;
}

interface TokenResult {
  status: string;
  token?: string;
  errors?: Array<{ message: string }>;
}

interface CheckoutItem {
  beatId: string | number;
  licenseType: string;
}

interface CheckoutResponse {
  success: boolean;
  message?: string;
  redirectUrl?: string;
  orderNumber?: string;
}

// Square SDK types (simplified)
interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<TokenResult>;
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

interface SquareSDK {
  payments: (appId: string, locationId: string) => SquarePayments;
}

// Extend Window interface for Square SDK
declare global {
  interface Window {
    Square?: SquareSDK;
  }
}

type Processor = 'SQUARE' | 'STRIPE' | null;

// ============================================
// Stripe payment sub-form (rendered inside <Elements>, needs its own
// component since useStripe()/useElements() only work within that context)
// ============================================

interface StripePaymentFormProps {
  orderNumber: string;
  amount: number;
  onSuccess: (redirectUrl: string) => void;
}

function StripePaymentForm({ orderNumber, amount, onSuccess }: StripePaymentFormProps): ReactNode {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      if (paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment was not completed');
      }

      const res = await fetch(`${API_URL}/checkout/confirm-stripe-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber }),
      });
      const data: CheckoutResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Payment confirmation failed');
      }

      onSuccess(data.redirectUrl || `/order/${orderNumber}?success=true`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      toast.error('Payment Failed', message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form-v2">
      <PaymentElement />

      {error && (
        <div className="checkout-error-v2" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>{error}</p>
        </div>
      )}

      <button type="submit" disabled={!stripe || loading} className="checkout-submit-btn" aria-busy={loading}>
        {loading ? (
          <>
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Processing Payment...
          </>
        ) : (
          <>
            <i className="fas fa-lock" aria-hidden="true"></i>
            Pay ${amount.toFixed(2)}
          </>
        )}
      </button>

      <div className="checkout-secure-v2">
        <i className="fas fa-shield-alt" aria-hidden="true"></i>
        <span>Secure payment powered by Stripe</span>
      </div>
    </form>
  );
}

// ============================================
// CheckoutPage Component
// ============================================

export default function CheckoutPage(): ReactNode {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart: _ } = useCart();
  const { customer, isAuthenticated } = useCustomerAuth();
  const toast = useToast();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [squareLoading, setSquareLoading] = useState<boolean>(true);
  const [card, setCard] = useState<SquareCard | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Payment-processor routing (multi-collaborator beats route through
  // Stripe; everything else stays on Square - see backend's
  // /checkout/payment-method)
  const [processor, setProcessor] = useState<Processor>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string>('');
  const [stripeOrderNumber, setStripeOrderNumber] = useState<string>('');
  const [creatingStripeIntent, setCreatingStripeIntent] = useState<boolean>(false);

  const [formData, setFormData] = useState<CheckoutFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: ''
  });

  // Populate form with customer data if logged in
  useEffect(() => {
    if (customer) {
      setFormData({
        email: customer.email || '',
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: ''
      });
    }
  }, [customer]);

  // Redirect if cart is empty on initial load only
  useEffect(() => {
    // Only redirect on mount, not on cart changes during checkout
    if (cartItems.length === 0) {
      navigate('/beats', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Determine which processor this cart requires
  useEffect(() => {
    if (cartItems.length === 0) return;

    const beatIds = cartItems.map((item) => item.beat.id).join(',');
    fetch(`${API_URL}/checkout/payment-method?beatIds=${encodeURIComponent(beatIds)}`)
      .then((res) => res.json())
      .then((data: { processor: 'SQUARE' | 'STRIPE' }) => setProcessor(data.processor))
      .catch(() => setProcessor('SQUARE')); // fail open to the proven path
  }, [cartItems]);

  // Initialize Square Web Payments SDK (only when this cart uses Square)
  useEffect(() => {
    if (processor !== 'SQUARE') return;

    async function initializeSquare(): Promise<void> {
      if (!window.Square) {
        console.error('Square SDK not loaded');
        setError('Payment system failed to load. Please refresh the page.');
        setSquareLoading(false);
        return;
      }

      try {
        // Get Square config from backend
        const configRes = await fetch(`${API_URL}/checkout/square-config`);
        const config: SquareConfig = await configRes.json();

        const payments = window.Square.payments(config.applicationId, config.locationId);

        const cardInstance = await payments.card();
        await cardInstance.attach('#card-container');

        setCard(cardInstance);
        setSquareLoading(false);
        console.log('Square card initialized successfully');
      } catch (err) {
        console.error('Failed to initialize Square:', err);
        setError('Failed to initialize payment form. Please refresh the page.');
        setSquareLoading(false);
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeSquare, 100);
    return () => clearTimeout(timer);
  }, [processor]);

  // Initialize Stripe.js (only when this cart requires Stripe)
  useEffect(() => {
    if (processor !== 'STRIPE') return;

    fetch(`${API_URL}/checkout/stripe-config`)
      .then((res) => res.json())
      .then((data: { publishableKey: string | null }) => {
        if (data.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey));
        } else {
          setError('Payment system is temporarily unavailable. Please contact us to complete this purchase.');
        }
      })
      .catch(() => setError('Failed to load payment form. Please refresh the page.'));
  }, [processor]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFormData((prev: CheckoutFormData) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleCheckout = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!card) {
      setError('Payment form not ready. Please wait or refresh the page.');
      return;
    }

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to complete your purchase');
      return;
    }

    setLoading(true);

    try {
      // Tokenize the card
      const tokenResult = await card.tokenize();

      if (tokenResult.status !== 'OK') {
        const errorMessage = tokenResult.errors?.[0]?.message || 'Card validation failed';
        throw new Error(errorMessage);
      }

      // Prepare items for checkout
      const items: CheckoutItem[] = cartItems.map((item: CartItem) => ({
        beatId: item.beat.id,
        licenseType: item.license.id.toUpperCase()
      }));

      // Process payment with backend
      const response = await fetch(`${API_URL}/checkout/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          items,
          customer: formData
        })
      });

      const data: CheckoutResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Payment failed');
      }

      // Payment successful - redirect immediately
      const redirectUrl = data.redirectUrl || `/order/${data.orderNumber}?success=true`;
      console.log('[CHECKOUT] Payment successful! Redirect URL:', redirectUrl);
      console.log('[CHECKOUT] Full data received:', data);

      // Hard redirect - this MUST happen before any React re-render
      window.location.href = redirectUrl;
      // Everything below this line should never execute
      return;

    } catch (err) {
      console.error('Checkout error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error('Payment Failed', errorMessage);
      setLoading(false);
    }
  };

  const handleStripeInfoSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');

    if (!formData.email) {
      setError('Email is required');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to complete your purchase');
      return;
    }

    setCreatingStripeIntent(true);
    try {
      const items: CheckoutItem[] = cartItems.map((item: CartItem) => ({
        beatId: item.beat.id,
        licenseType: item.license.id.toUpperCase()
      }));

      const res = await fetch(`${API_URL}/checkout/create-stripe-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer: formData }),
      });
      const data = await res.json();

      if (!res.ok || !data.clientSecret) {
        throw new Error(data.message || 'Failed to start payment');
      }

      setStripeClientSecret(data.clientSecret);
      setStripeOrderNumber(data.orderNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start payment';
      setError(message);
      toast.error('Checkout Failed', message);
    } finally {
      setCreatingStripeIntent(false);
    }
  };

  const handleStripeSuccess = (redirectUrl: string): void => {
    window.location.href = redirectUrl;
  };

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className="checkout-page-v2">
      <div className="checkout-container-v2">
        {/* Header */}
        <div className="checkout-header-v2">
          <h1>Checkout</h1>
          <p>Complete your purchase</p>
        </div>

        <div className="checkout-grid-v2">
          {/* Order Summary */}
          <div className="checkout-card-v2">
            <div className="checkout-card-header">
              <h2>
                <i className="fas fa-shopping-cart" aria-hidden="true"></i>
                Order Summary
              </h2>
              <span className="checkout-item-count">{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="checkout-items-v2">
              {cartItems.map((item: CartItem, index: number) => (
                <div key={index} className="checkout-item-v2">
                  <div className="checkout-item-cover">
                    {item.beat.imageUrl ? (
                      <img src={item.beat.imageUrl} alt={item.beat.title} />
                    ) : (
                      <div className="checkout-item-placeholder" aria-hidden="true">
                        <i className="fas fa-music"></i>
                      </div>
                    )}
                  </div>
                  <div className="checkout-item-details">
                    <h3>{item.beat.title}</h3>
                    <p className="checkout-item-license">{item.license.name}</p>
                    <div className="checkout-item-meta">
                      {item.beat.bpm && <span>{item.beat.bpm} BPM</span>}
                      {item.beat.key && <span>{item.beat.key}</span>}
                    </div>
                  </div>
                  <div className="checkout-item-price">${item.license.price}</div>
                </div>
              ))}
            </div>

            {/* TODO(tax): no sales tax line item - see backend TODO(tax) notes
                in orders.ts/bookings.ts before adding this. */}
            <div className="checkout-totals-v2">
              <div className="checkout-subtotal">
                <span>Subtotal</span>
                <span>${getCartTotal().toFixed(2)}</span>
              </div>
              <div className="checkout-total">
                <span>Total</span>
                <span className="total-amount">${getCartTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="checkout-card-v2">
            <div className="checkout-card-header">
              <h2>
                <i className="fas fa-credit-card" aria-hidden="true"></i>
                Payment Details
              </h2>
            </div>

            {!isAuthenticated && (
              <div className="checkout-login-prompt-v2">
                <i className="fas fa-info-circle" aria-hidden="true"></i>
                <p>
                  Already have an account?{' '}
                  <Link to="/login?returnTo=/checkout">Sign in</Link>{' '}
                  for faster checkout and unlimited download access.
                </p>
              </div>
            )}

            {error && (
              <div className="checkout-error-v2" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                <p>{error}</p>
              </div>
            )}

            {processor === 'STRIPE' && stripeClientSecret && stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                <StripePaymentForm
                  orderNumber={stripeOrderNumber}
                  amount={getCartTotal()}
                  onSuccess={handleStripeSuccess}
                />
              </Elements>
            ) : (
              <form onSubmit={processor === 'STRIPE' ? handleStripeInfoSubmit : handleCheckout} className="checkout-form-v2">
                {/* Customer Info */}
                <div className="form-field">
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
                    />
                  </div>
                </div>

                {processor === 'SQUARE' && (
                  <div className="form-field">
                    <label>Card Details *</label>
                    <div
                      id="card-container"
                      ref={cardContainerRef}
                      className="square-card-container"
                    >
                      {squareLoading && (
                        <div className="square-card-loading">
                          <i className="fas fa-spinner fa-spin"></i>
                          Loading payment form...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isAuthenticated && (
                  <div className="checkout-guest-notice-v2">
                    <i className="fas fa-clock" aria-hidden="true"></i>
                    <p>
                      <strong>Note:</strong> As a guest, your download link will expire in 7 days.
                      Create an account after purchase for unlimited access to your beats.
                    </p>
                  </div>
                )}

                <div className="form-field-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setAgreedToTerms(e.target.checked)}
                      required
                    />
                    <span>
                      I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>,{' '}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>, and{' '}
                      <Link to="/licenses" target="_blank" rel="noopener noreferrer">License Agreement</Link>
                    </span>
                  </label>
                </div>

                {processor === 'STRIPE' ? (
                  <button
                    type="submit"
                    disabled={creatingStripeIntent || !stripePromise || !agreedToTerms}
                    className="checkout-submit-btn"
                    aria-busy={creatingStripeIntent}
                  >
                    {creatingStripeIntent ? (
                      <>
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        Starting Checkout...
                      </>
                    ) : (
                      <>
                        Continue to Payment
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || squareLoading || !card || !agreedToTerms || processor === null}
                    className="checkout-submit-btn"
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        Processing Payment...
                      </>
                    ) : squareLoading || processor === null ? (
                      <>
                        <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        Loading...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-lock" aria-hidden="true"></i>
                        Pay ${getCartTotal().toFixed(2)}
                      </>
                    )}
                  </button>
                )}

                <div className="checkout-secure-v2">
                  <i className="fas fa-shield-alt" aria-hidden="true"></i>
                  <span>Secure payment powered by {processor === 'STRIPE' ? 'Stripe' : 'Square'}</span>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="checkout-footer-v2">
          <Link to="/beats" className="checkout-back-link">
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
