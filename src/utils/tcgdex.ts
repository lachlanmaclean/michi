import TCGdex, { Query, type CardResumeModel, type SetResume } from '@tcgdex/sdk';

const tcgdex = new TCGdex('en');

export type TcgdexCardBrief = CardResumeModel;
export type TcgdexSetBrief = SetResume;

/**
 * Full-resolution card image URL for a search result. Uses PNG rather than
 * webp: pdf-lib (the PDF export library) can only embed PNG/JPEG, not webp,
 * and the image is later exported to PDF.
 */
export function tcgdexImageUrl(card: TcgdexCardBrief): string | null {
  return card.image ? card.getImageURL('high', 'png') : null;
}

/** Smaller/faster-loading variant, used for search result thumbnails. */
export function tcgdexThumbnailUrl(card: TcgdexCardBrief): string | null {
  return card.image ? card.getImageURL('low', 'png') : null;
}

/**
 * Rarity tiers considered "full art and above" — everything at or above the
 * illustration/alt-art tier, spanning every TCGdex era's naming convention
 * (WOTC/e-Card "Rare Holo V.X", Sword & Shield "V/VMAX", Scarlet & Violet
 * "diamond/star" symbols, TCG Pocket's own scale). See
 * https://api.tcgdex.net/v2/en/rarities for the full enum this is drawn
 * from. Deliberately excludes Common/Uncommon/Rare/Rare Holo/diamond tiers
 * and plain "Shiny"/"Promo"/"None", which aren't full-art-tier.
 */
export const FULL_ART_AND_ABOVE_RARITIES = [
  'Ultra Rare',
  'Full Art Trainer',
  'Double rare',
  'Illustration rare',
  'Special illustration rare',
  'Hyper rare',
  'Secret Rare',
  'Shiny Ultra Rare',
  'Radiant Rare',
  'Rare Holo V',
  'Holo Rare V',
  'Holo Rare VMAX',
  'Holo Rare VSTAR',
  'ACE SPEC Rare',
  'Amazing Rare',
  'Black White Rare',
  'Classic Collection',
  'Crown',
  'LEGEND',
  'Mega Hyper Rare',
  'Rare PRIME',
  'Rare Holo LV.X',
  'Shiny rare V',
  'Shiny rare VMAX',
  'Three Star',
  'Two Star',
  'One Star',
] as const;

/**
 * The list/resume endpoint TCGdex uses for search results has no rarity
 * field (only the full card detail does), and the SDK's query builder has
 * no OR-across-values helper — so a rarity filter means one request per
 * candidate rarity, merged and deduped by card id. Fine at this list's
 * size (results are already capped to 24 per search).
 */
export async function searchTcgdexCards(
  name: string,
  setId?: string,
  fullArtOnly?: boolean
): Promise<TcgdexCardBrief[]> {
  function buildQuery(rarity?: string) {
    let query = Query.create().contains('name', name).paginate(1, 24);
    if (setId) query = query.equal('set', setId);
    if (rarity) query = query.equal('rarity', rarity);
    return query;
  }

  if (!fullArtOnly) {
    return tcgdex.card.list(buildQuery());
  }

  const batches = await Promise.all(
    FULL_ART_AND_ABOVE_RARITIES.map((rarity) => tcgdex.card.list(buildQuery(rarity)).catch(() => []))
  );
  const seen = new Set<string>();
  const merged: TcgdexCardBrief[] = [];
  for (const batch of batches) {
    for (const card of batch) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      merged.push(card);
    }
  }
  return merged.slice(0, 24);
}

export async function fetchTcgdexSets(): Promise<TcgdexSetBrief[]> {
  const sets = await tcgdex.set.list();
  return sets.sort((a, b) => a.name.localeCompare(b.name));
}
