import { ParsedCardItem } from '../types/card';

interface ScryfallCardResponse {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
  };
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    image_uris?: {
      small?: string;
      normal?: string;
    };
  }>;
}

const cardCache = new Map<string, Partial<ParsedCardItem>>();

export async function resolveCardsWithScryfall(
  cards: ParsedCardItem[],
  onProgress?: (progress: number) => void
): Promise<ParsedCardItem[]> {
  const unresolved = cards.filter(c => !c.resolved && c.name.trim());
  if (unresolved.length === 0) return cards;

  const remainingToFetch: ParsedCardItem[] = [];
  const updatedCards = cards.map(c => {
    const cacheKey = `${c.name.toLowerCase().trim()}_${c.setCode?.toLowerCase() || ''}`;
    if (cardCache.has(cacheKey)) {
      const cached = cardCache.get(cacheKey)!;
      return {
        ...c,
        ...cached,
        resolved: true,
        loading: false
      };
    }
    remainingToFetch.push(c);
    return { ...c, loading: true };
  });

  if (remainingToFetch.length === 0) {
    return updatedCards;
  }

  const chunkSize = 70;
  const chunks: ParsedCardItem[][] = [];
  for (let i = 0; i < remainingToFetch.length; i += chunkSize) {
    chunks.push(remainingToFetch.slice(i, i + chunkSize));
  }

  const resultMap = new Map<string, Partial<ParsedCardItem>>();

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const identifiers = chunk.map(c => {
      if (c.setCode) {
        return { name: c.name, set: c.setCode.toLowerCase() };
      }
      return { name: c.name };
    });

    try {
      const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ identifiers })
      });

      if (response.ok) {
        const data = await response.json();
        const foundList: ScryfallCardResponse[] = data.data || [];

        for (const card of foundList) {
          const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || '';
          const usd = card.prices?.usd ? parseFloat(card.prices.usd) : undefined;
          const usdFoil = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : undefined;

          const partialData: Partial<ParsedCardItem> = {
            resolved: true,
            loading: false,
            scryfallId: card.id,
            imageUrl: img,
            manaCost: card.mana_cost || card.card_faces?.[0]?.mana_cost || '',
            typeLine: card.type_line || '',
            estimatedPriceUsd: usd,
            estimatedPriceFoil: usdFoil,
            setCode: card.set?.toUpperCase(),
            setDisplayName: card.set_name,
            collectorNumber: card.collector_number
          };

          const keyWithNameOnly = card.name.toLowerCase().trim();
          resultMap.set(keyWithNameOnly, partialData);
          cardCache.set(keyWithNameOnly, partialData);

          if (card.set) {
            const keyWithSet = `${keyWithNameOnly}_${card.set.toLowerCase()}`;
            resultMap.set(keyWithSet, partialData);
            cardCache.set(keyWithSet, partialData);
          }
        }
      }
    } catch {
      // Gracefully handle connectivity / rate limiting
    }

    if (onProgress) {
      onProgress(Math.round(((chunkIdx + 1) / chunks.length) * 100));
    }

    if (chunkIdx < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return updatedCards.map(c => {
    const keyWithSet = `${c.name.toLowerCase().trim()}_${c.setCode?.toLowerCase() || ''}`;
    const keyNameOnly = c.name.toLowerCase().trim();
    const match = resultMap.get(keyWithSet) || resultMap.get(keyNameOnly);

    if (match) {
      return {
        ...c,
        ...match,
        resolved: true,
        loading: false
      };
    }
    return {
      ...c,
      loading: false,
      resolved: false
    };
  });
}
