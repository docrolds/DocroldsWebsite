/**
 * Shared beat-license pricing logic. Beats left at the default price
 * (null/unset) use the standard $50/$150 tiers; a custom beat.price
 * becomes its Standard-tier price, with Unlimited scaled at the same
 * ratio, so a handful of premium beats can be priced differently without
 * affecting the rest of the catalog. This is the single source of truth,
 * used both when charging at checkout and when displaying prices.
 */

export const DEFAULT_STANDARD_PRICE = 50;
export const UNLIMITED_MULTIPLIER = 3; // matches the default $50 -> $150 ratio

export interface LicensePricing {
  standard: number;
  unlimited: number;
}

export function getLicensePricing(beat: { price: number | null }): LicensePricing {
  if (beat.price != null && beat.price > 0) {
    return { standard: beat.price, unlimited: beat.price * UNLIMITED_MULTIPLIER };
  }
  return {
    standard: DEFAULT_STANDARD_PRICE,
    unlimited: DEFAULT_STANDARD_PRICE * UNLIMITED_MULTIPLIER,
  };
}
