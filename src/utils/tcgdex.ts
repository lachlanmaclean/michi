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

export async function searchTcgdexCards(name: string, setId?: string): Promise<TcgdexCardBrief[]> {
  let query = Query.create().contains('name', name).paginate(1, 24);
  if (setId) query = query.equal('set', setId);
  return tcgdex.card.list(query);
}

export async function fetchTcgdexSets(): Promise<TcgdexSetBrief[]> {
  const sets = await tcgdex.set.list();
  return sets.sort((a, b) => a.name.localeCompare(b.name));
}
