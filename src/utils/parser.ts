import { CardCondition, ParsedCardItem } from '../types/card';

export function parseDecklist(text: string, defaultCondition: CardCondition = 'NM'): ParsedCardItem[] {
  const lines = text.split('\n');
  const cards: ParsedCardItem[] = [];

  let lineCounter = 1;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    let isFoil = false;
    let lineToParse = trimmed;
    if (/\*F\*|\[Foil\]|\(Foil\)|(?:\s|^)foil(?:\s|$)/i.test(lineToParse)) {
      isFoil = true;
      lineToParse = lineToParse.replace(/\*F\*|\[Foil\]|\(Foil\)|(?:\s|^)foil(?:\s|$)/gi, ' ').trim();
    }

    let setCode: string | undefined;
    let collectorNumber: string | undefined;

    const setMatch = lineToParse.match(/[\(\[]([A-Za-z0-9]{3,5})[\)\]](?:\s+([0-9a-zA-Z\u2605]+))?/);
    if (setMatch) {
      setCode = setMatch[1].toUpperCase();
      collectorNumber = setMatch[2];
      lineToParse = lineToParse.replace(setMatch[0], '').trim();
    }

    const qtyMatch = lineToParse.match(/^(\d+)x?\s+(.+)$/i);
    let quantity = 1;
    let name = lineToParse;

    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      name = qtyMatch[2].trim();
    } else {
      name = lineToParse.replace(/^x?\s*/, '').trim();
    }

    name = name.replace(/\s*\*+$/, '').trim();

    if (name.length > 0) {
      cards.push({
        id: `card-${lineCounter}-${name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
        rawLine: trimmed,
        quantity: isNaN(quantity) || quantity <= 0 ? 1 : quantity,
        name,
        setCode,
        collectorNumber,
        isFoil,
        preferredCondition: defaultCondition,
        resolved: false,
        loading: false
      });
      lineCounter++;
    }
  }

  return cards;
}

export const SAMPLE_DECKLISTS = {
  commanderStaples: `1 Sol Ring (C21)
1 Arcane Signet
1 Rhystic Study
1 Demonic Tutor
1 Cyclonic Rift
1 Smothering Tithe
1 Esper Sentinel
1 Dockside Extortionist
1 Fierce Guardianship
1 Mana Crypt
1 Lightning Greaves
1 Swiftfoot Boots
1 Command Tower
1 Exotic Orchard`,
  burnModern: `4 Lightning Bolt [M10]
4 Monastery Swiftspear
4 Goblin Guide
4 Eidolon of the Great Revel
4 Lava Spike
4 Rift Bolt
4 Searing Blaze
4 Boros Charm
4 Sacred Foundry
4 Sunbaked Canyon
4 Wooded Foothills
4 Bloodstained Mire
4 Mountain`,
  budgetUpgrades: `4 Counterspell
4 Brainstorm
4 Ponder
4 Preordain
4 Swords to Plowshares
4 Path to Exile
4 Wrath of God
4 Dark Ritual`
};
