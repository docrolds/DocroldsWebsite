import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    // Load cart from localStorage on init
    const saved = localStorage.getItem('beatCart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('beatCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const licenseTiers = [
    {
      id: 'standard',
      name: 'Standard Lease',
      price: 50,
      features: [
        'MP3 File',
        'Up to 2,500 Streams',
        'Non-Exclusive Rights',
        'Must Credit Producer'
      ]
    },
    {
      id: 'unlimited',
      name: 'Unlimited Lease',
      price: 150,
      features: [
        'WAV + MP3 Files',
        'Unlimited Streams',
        'Non-Exclusive Rights',
        'Untagged Beat',
        'Radio & TV Ready'
      ]
    },
    {
      id: 'exclusive',
      name: 'Exclusive Rights',
      price: null, // Custom pricing
      features: [
        'Full Ownership Transfer',
        'WAV + MP3 + Stems',
        'Unlimited Commercial Use',
        'Beat Removed from Store'
      ]
    }
  ];

  const addToCart = (beat, license) => {
    // Check if beat with same license already in cart
    const existingIndex = cartItems.findIndex(
      item => item.beat.id === beat.id && item.license.id === license.id
    );

    if (existingIndex >= 0) {
      // Already in cart
      return false;
    }

    setCartItems(prev => [...prev, { beat, license, addedAt: Date.now() }]);
    return true;
  };

  const removeFromCart = (beatId, licenseId) => {
    setCartItems(prev =>
      prev.filter(item => !(item.beat.id === beatId && item.license.id === licenseId))
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const isInCart = (beatId, licenseId = null) => {
    if (licenseId) {
      return cartItems.some(item => item.beat.id === beatId && item.license.id === licenseId);
    }
    return cartItems.some(item => item.beat.id === beatId);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.license.price || 0);
    }, 0);
  };

  const cartCount = cartItems.length;

  const value = {
    cartItems,
    cartCount,
    isCartOpen,
    setIsCartOpen,
    licenseTiers,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
    getCartTotal
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}
