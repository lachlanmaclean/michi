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
 *
 * `localId` (the card's printed number within its set, e.g. "170") IS
 * present and filterable on the list endpoint, unlike rarity — but unlike
 * `set`/`rarity`, the API's `eq:` operator prefix (which `.equal()` adds)
 * silently matches nothing for this field; `.contains()` (no prefix) is
 * required instead. Confirmed against the live API — `localId=41` works,
 * `localId=eq:41` returns an empty array.
 */
export async function searchTcgdexCards(
  name: string,
  setId?: string,
  fullArtOnly?: boolean,
  localId?: string,
  rarity?: string
): Promise<TcgdexCardBrief[]> {
  function buildQuery(rarityOverride?: string) {
    let query = Query.create().contains('name', name).paginate(1, 24);
    if (setId) query = query.equal('set', setId);
    if (localId) query = query.contains('localId', localId);
    const effectiveRarity = rarityOverride ?? rarity;
    if (effectiveRarity) query = query.equal('rarity', effectiveRarity);
    return query;
  }

  // An explicit rarity parsed from the query (e.g. "IR" -> Illustration
  // rare) is a single exact filter, same cost as any other query — only
  // the "full art and above" toggle needs the multi-rarity fan-out below.
  if (!fullArtOnly || rarity) {
    return tcgdex.card.list(buildQuery());
  }

  const batches = await Promise.all(
    FULL_ART_AND_ABOVE_RARITIES.map((r) => tcgdex.card.list(buildQuery(r)).catch(() => []))
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

/**
 * Best-effort collector-shorthand rarity abbreviation -> exact TCGdex
 * rarity string. "AR" and "CH"/"CHR" are genuinely ambiguous against
 * TCGdex's enum (no 1:1 match across sets) and are deliberately omitted —
 * an unrecognized token is left as part of the name search instead of
 * silently guessing wrong.
 */
const RARITY_ABBREVIATIONS: Record<string, string> = {
  C: 'Common',
  U: 'Uncommon',
  R: 'Rare',
  RH: 'Rare Holo',
  DR: 'Double rare',
  ACE: 'ACE SPEC Rare',
  IR: 'Illustration rare',
  SIR: 'Special illustration rare',
  SAR: 'Special illustration rare',
  UR: 'Ultra Rare',
  HR: 'Hyper rare',
  SR: 'Secret Rare',
  RR: 'Radiant Rare',
  AAA: 'Amazing Rare',
  TR: 'Full Art Trainer',
  SUR: 'Shiny Ultra Rare',
  BWR: 'Black White Rare',
  CC: 'Classic Collection',
  PR: 'Promo',
  PROMO: 'Promo',
};

export interface ParsedCardQuery {
  name: string;
  localId?: string;
  rarity?: string;
  /** The set's printed total card count (the "165" in "170/165"), used to auto-resolve a set when none is selected. */
  setTotal?: number;
}

/**
 * Parses collector shorthand like "Squirtle IR 170/165" into structured
 * search terms: card name, rarity abbreviation, local card number, and the
 * set's total card count (for auto-resolving which set, when the sidebar
 * set filter is empty). Any token that isn't recognized as a number pair
 * or a known rarity abbreviation is treated as part of the name — so a
 * plain name-only search behaves exactly as before.
 */
export function parseCardQuery(raw: string): ParsedCardQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const nameTokens: string[] = [];
  let localId: string | undefined;
  let rarity: string | undefined;
  let setTotal: number | undefined;

  for (const token of tokens) {
    const numberPair = /^(\d+)\/(\d+)$/.exec(token);
    if (numberPair) {
      localId = numberPair[1];
      setTotal = Number(numberPair[2]);
      continue;
    }
    const rarityMatch = RARITY_ABBREVIATIONS[token.toUpperCase()];
    if (rarityMatch && !rarity) {
      rarity = rarityMatch;
      continue;
    }
    nameTokens.push(token);
  }

  return { name: nameTokens.join(' '), localId, rarity, setTotal };
}

/** Finds a set whose printed total card count matches, for auto-resolving a set from a "170/165"-style query when no set filter is already selected. */
export function findSetByCardCount(sets: TcgdexSetBrief[], total: number): TcgdexSetBrief | null {
  return sets.find((s) => s.cardCount.official === total || s.cardCount.total === total) ?? null;
}
