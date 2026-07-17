import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ============================================
// Type Definitions
// ============================================

/** License tier identifiers */
export type LicenseTierId = 'standard' | 'unlimited' | 'exclusive';

/** License tier configuration */
export interface LicenseTier {
  id: LicenseTierId;
  name: string;
  price: number | null; // null for custom pricing (exclusive)
  features: string[];
}

/** Server-computed license prices for a specific beat (see backend services/pricing.ts) */
export interface LicensePricing {
  standard: number;
  unlimited: number;
}

/** Beat item from the catalog */
export interface Beat {
  id: string | number;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string;
  genre?: string;
  imageUrl?: string;
  audioUrl?: string;
  price?: number;
  licensePricing?: LicensePricing;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Returns the license tiers for a specific beat, with Standard/Unlimited
 * prices overridden from the beat's own licensePricing (if the backend
 * provided it) instead of the fixed defaults - so a custom-priced beat
 * shows and charges the right amount everywhere it's offered.
 */
export function getLicenseTiersForBeat(beat: Beat, baseTiers: LicenseTier[]): LicenseTier[] {
  if (!beat.licensePricing) return baseTiers;
  return baseTiers.map((tier) => {
    if (tier.id === 'standard') return { ...tier, price: beat.licensePricing!.standard };
    if (tier.id === 'unlimited') return { ...tier, price: beat.licensePricing!.unlimited };
    return tier;
  });
}

/** Cart item combining a beat with its selected license */
export interface CartItem {
  beat: Beat;
  license: LicenseTier;
  addedAt: number;
}

/** Cart context value interface */
export interface CartContextValue {
  cartItems: CartItem[];
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  licenseTiers: LicenseTier[];
  addToCart: (beat: Beat, license: LicenseTier) => boolean;
  removeFromCart: (beatId: string | number, licenseId: LicenseTierId) => void;
  clearCart: () => void;
  isInCart: (beatId: string | number, licenseId?: LicenseTierId | null) => boolean;
  getCartTotal: () => number;
}

/** Props for CartProvider component */
export interface CartProviderProps {
  children: ReactNode;
}

// ============================================
// Context Creation
// ============================================

const CartContext = createContext<CartContextValue | undefined>(undefined);

// ============================================
// Custom Hook
// ============================================

/**
 * Hook to access cart context.
 * Returns a fallback object with no-op functions if used outside CartProvider.
 */
export function useCart(): CartContextValue {
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

// ============================================
// Provider Component
// ============================================

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // Load cart from localStorage on init
    try {
      const saved = localStorage.getItem('beatCart');
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('beatCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const licenseTiers: LicenseTier[] = [
    {
      id: 'standard',
      name: 'Standard Lease',
      price: 50,
      features: [
        'MP3 File (320kbps)',
        'Up to 100,000 Streams',
        'Up to 5,000 Paid Downloads',
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
        'Unlimited Paid Downloads',
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
        'Unlimited Distribution',
        'Exclusive Use (Not Ownership)',
        'Beat Removed from Store',
        'Publishing: 50/50 (Negotiable)',
        'Credit Required',
        'Producer Retains Master'
      ]
    }
  ];

  const addToCart = (beat: Beat, license: LicenseTier): boolean => {
    // Check if beat with same license already in cart
    const existingIndex = cartItems.findIndex(
      (item: CartItem) => item.beat.id === beat.id && item.license.id === license.id
    );

    if (existingIndex >= 0) {
      // Already in cart
      return false;
    }

    setCartItems((prev: CartItem[]) => [...prev, { beat, license, addedAt: Date.now() }]);
    return true;
  };

  const removeFromCart = (beatId: string | number, licenseId: LicenseTierId): void => {
    setCartItems((prev: CartItem[]) =>
      prev.filter((item: CartItem) => !(item.beat.id === beatId && item.license.id === licenseId))
    );
  };

  const clearCart = (): void => {
    setCartItems([]);
  };

  const isInCart = (beatId: string | number, licenseId: LicenseTierId | null = null): boolean => {
    if (licenseId) {
      return cartItems.some((item: CartItem) => item.beat.id === beatId && item.license.id === licenseId);
    }
    return cartItems.some((item: CartItem) => item.beat.id === beatId);
  };

  const getCartTotal = (): number => {
    return cartItems.reduce((total: number, item: CartItem) => {
      return total + (item.license.price || 0);
    }, 0);
  };

  const cartCount: number = cartItems.length;

  const value: CartContextValue = {
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
