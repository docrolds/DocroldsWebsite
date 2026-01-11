import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    console.warn('useCart called outside of CartProvider, returning fallback');
    return {
      cartItems: [],
      cartCount: 0,
      isCartOpen: false,
      setIsCartOpen: () => {},
      licenseTiers: [],
      addToCart: () => false,
      removeFromCart: () => {},
      clearCart: () => {},
      isInCart: () => false,
      getCartTotal: () => 0,
    };
  }
  return context;
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
        'MP3 File (320kbps)',
        'Up to 100,000 Streams',
        'Radio: Prohibited',
        'Non-Exclusive Rights',
        'Publishing: 50/50',
        'Credit Required',
        'Producer Retains Master'
      ]
    },
    {
      id: 'unlimited',
      name: 'Unlimited Lease',
      price: 150,
      features: [
        'WAV + MP3 + Stems',
        'Unlimited Streams',
        'Radio: Unlimited',
        'Non-Exclusive Rights',
        'Sync Licensing Included',
        'Publishing: 50/50',
        'Credit Required',
        'Producer Retains Master'
      ]
    },
    {
      id: 'exclusive',
      name: 'Exclusive Rights',
      price: null, // Custom pricing
      features: [
        'WAV + MP3 + Stems + Project File',
        'Exclusive Use (Not Ownership)',
        'Beat Removed from Store',
        'Publishing: 50/50 (Negotiable)',
        'Credit Required',
        'Producer Retains Master'
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
