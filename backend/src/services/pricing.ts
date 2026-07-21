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

/**
 * The name(s) to actually display as "produced by" for a beat. Once real
 * BeatCollaborator splits are configured (via the admin splits editor),
 * those collaborators' names are the source of truth and should be shown
 * instead of the legacy free-text producedBy field, which can drift out
 * of sync with who's actually credited/paid. Falls back to producedBy (or
 * "Doc Rolds") for beats with no splits configured yet.
 */
export function getDisplayProducer(beat: {
  producedBy?: string | null;
  beatCollaborators?: Array<{ collaborator: { name: string } }>;
}): string {
  if (beat.beatCollaborators && beat.beatCollaborators.length > 0) {
    return beat.beatCollaborators.map((bc) => bc.collaborator.name).join(' & ');
  }
  return beat.producedBy || 'Doc Rolds';
}
