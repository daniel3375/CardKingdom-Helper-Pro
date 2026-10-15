import { ParsedCardItem } from '../types/card';

export function formatForCardKingdomDeckBuilder(cards: ParsedCardItem[], includeSetCode: boolean = false): string {
  return cards
    .map(card => {
      const qty = card.quantity || 1;
      const cleanName = card.name.trim();
      if (includeSetCode && card.setCode) {
        return `${qty} ${cleanName} [${card.setCode.toUpperCase()}]`;
      }
      return `${qty} ${cleanName}`;
    })
    .join('\n');
}

export function getCardKingdomSearchUrl(cardName: string, setCode?: string): string {
  const query = setCode ? `${cardName} ${setCode}` : cardName;
  const encoded = encodeURIComponent(query.trim());
  return `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${encoded}`;
}

export const CARD_KINGDOM_DECKBUILDER_URL = 'https://www.cardkingdom.com/builder';

export function generateCardListCsv(cards: ParsedCardItem[]): string {
  const header = ['Quantity', 'Card Name', 'Set Code', 'Condition', 'Foil', 'Estimated Price (USD)'].join(',');
  const rows = cards.map(c => {
    const escapedName = `"${c.name.replace(/"/g, '""')}"`;
    const price = c.estimatedPriceUsd ? c.estimatedPriceUsd.toFixed(2) : '0.00';
    return [
      c.quantity,
      escapedName,
      c.setCode?.toUpperCase() || '',
      c.preferredCondition,
      c.isFoil ? 'Yes' : 'No',
      price
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
