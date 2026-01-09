import { useCart } from '../context/CartContext';
import { useToast } from '../context/NotificationContext';
import { Link, useNavigate } from 'react-router-dom';

function CartDrawer() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    clearCart,
    getCartTotal
  } = useCart();

  const handleRemoveItem = (item) => {
    removeFromCart(item.beat.id, item.license.id);
    toast.info('Removed from Cart', `${item.beat.title} - ${item.license.name}`);
  };

  const handleClearCart = () => {
    const count = cartItems.length;
    clearCart();
    toast.info('Cart Cleared', `${count} item${count > 1 ? 's' : ''} removed`);
  };

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    setIsCartOpen(false);
    navigate('/checkout');
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="cart-overlay"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="cart-drawer">
        {/* Header */}
        <div className="cart-header">
          <h2>
            <i className="fas fa-shopping-cart"></i>
            Your Cart
            {cartItems.length > 0 && (
              <span className="cart-count-badge">{cartItems.length}</span>
            )}
          </h2>
          <button className="cart-close" onClick={() => setIsCartOpen(false)}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Cart Items */}
        <div className="cart-items">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <i className="fas fa-music"></i>
              <p>Your cart is empty</p>
              <Link to="/beats" className="cart-browse-btn" onClick={() => setIsCartOpen(false)}>
                Browse Beats
              </Link>
            </div>
          ) : (
            cartItems.map((item, index) => (
              <div key={`${item.beat.id}-${item.license.id}-${index}`} className="cart-item">
                <div className="cart-item-artwork">
                  <i className="fas fa-music"></i>
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-title">{item.beat.title}</div>
                  <div className="cart-item-license">{item.license.name}</div>
                  <div className="cart-item-price">
                    {item.license.price ? `$${item.license.price}` : 'Contact for price'}
                  </div>
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => handleRemoveItem(item)}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total">
              <span>Total:</span>
              <span className="cart-total-price">${getCartTotal()}</span>
            </div>
            <button className="cart-checkout-btn" onClick={handleCheckout}>
              <i className="fas fa-credit-card"></i>
              Checkout
            </button>
            <button className="cart-clear-btn" onClick={handleClearCart}>
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default CartDrawer;
