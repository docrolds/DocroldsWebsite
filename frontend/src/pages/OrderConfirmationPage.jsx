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
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    // Clear cart on successful order
    if (isSuccess) {
      clearCart();
      // Show success toast only once
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        toast.success('Order Complete!', 'Your beats are ready to download');
      }
    }
    fetchOrder();
  }, [orderNumber, isSuccess]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderNumber}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Order not found');
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-6 py-4 rounded-lg">
            {error}
          </div>
          <Link to="/beats" className="inline-block mt-6 text-red-500 hover:text-red-400">
            &larr; Back to Beats
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'PAID';
  const isPending = order.paymentStatus === 'PENDING';

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        {isPaid && (
          <div className="text-center mb-8" role="status">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Order Confirmed!</h1>
            <p className="text-zinc-400">
              Your beats are ready to download. Check your email for the download link.
            </p>
          </div>
        )}

        {isPending && (
          <div className="text-center mb-8" role="status" aria-live="polite">
            <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Processing Payment...</h1>
            <p className="text-zinc-400">
              Your payment is being processed. This page will update automatically.
            </p>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-zinc-900 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Order #{order.orderNumber}</h2>
              <p className="text-zinc-400 text-sm">
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isPaid ? 'bg-green-500/20 text-green-500' :
              isPending ? 'bg-yellow-500/20 text-yellow-500' :
              'bg-red-500/20 text-red-500'
            }`}>
              {order.paymentStatus}
            </div>
          </div>

          {/* Order Items */}
          <div className="space-y-4 mb-6">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-zinc-800 rounded-lg">
                {item.beat.coverArt && (
                  <img
                    src={item.beat.coverArt}
                    alt={item.beat.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-white font-medium">{item.beat.title}</h3>
                  <p className="text-zinc-400 text-sm">{item.licenseName}</p>
                  <div className="text-zinc-500 text-xs mt-1">
                    {item.beat.bpm} BPM • {item.beat.key}
                  </div>
                </div>
                <div className="text-red-500 font-bold">${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex justify-between text-white text-xl font-bold">
              <span>Total</span>
              <span className="text-red-500">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Download Section */}
        {isPaid && (
          <div className="bg-zinc-900 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Download Your Beats</h2>

            <Link
              to={`/download/${order.downloadToken}`}
              className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors text-center"
            >
              Download Now
            </Link>

            {order.customer.isGuest && order.downloadExpiresAt && (
              <p className="text-yellow-500 text-sm mt-4 text-center">
                Download link expires on {new Date(order.downloadExpiresAt).toLocaleDateString()}.
                Create an account for unlimited access.
              </p>
            )}
          </div>
        )}

        {/* Guest Account Prompt */}
        {isPaid && order.customer.isGuest && !isAuthenticated && (
          <div className="bg-zinc-900 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Create an Account</h2>
            <p className="text-zinc-400 mb-4">
              Get unlimited access to your purchased beats. No more expiring download links.
            </p>
            <Link
              to={`/register?email=${encodeURIComponent(order.customer.email)}`}
              className="inline-block bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Create Account
            </Link>
          </div>
        )}

        {/* Email Confirmation */}
        <div className="bg-zinc-800 rounded-lg p-6 text-center">
          <svg className="w-8 h-8 text-zinc-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-zinc-400">
            A confirmation email has been sent to <span className="text-white">{order.customer.email}</span>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/beats" className="text-zinc-400 hover:text-white">
            &larr; Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
