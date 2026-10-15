export type CardCondition = 'NM' | 'EX' | 'VG' | 'G';
export type FoilPreference = 'any' | 'nonfoil' | 'foil';
export type UserRole = 'admin' | 'customer';

export interface CurrentUserSession {
  uid: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
}

export interface CardVariation {
  condition: CardCondition;
  price: number;
  stock: number;
  isFoil: boolean;
}

export interface ScrapedCKCard {
  url: string;
  title: string;
  setName: string;
  imageUrl?: string;
  variations: CardVariation[];
}

export interface CartItem {
  id: string;
  name: string;
  setName: string;
  condition: CardCondition;
  quantity: number;
  priceUsd: number;
  isFoil: boolean;
  imageUrl?: string;
  cardKingdomUrl?: string;
  addedAt: string;
  originalPriceUsd?: number;
  lastRescrapedPrice?: number;
  isAvailable?: boolean;
}

export interface UserCart {
  userId: string;
  userName: string;
  userEmail: string;
  colorBadge: string;
  items: CartItem[];
}

export interface RescrapeResultItem {
  id: string;
  name: string;
  setName: string;
  condition: CardCondition;
  isFoil: boolean;
  quantity: number;
  oldPrice: number;
  currentPrice: number;
  delta: number;
  inStock: boolean;
  stockCount: number;
}

export interface ParsedCardItem {
  id: string;
  rawLine: string;
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  isFoil: boolean;
  preferredCondition: CardCondition;
  resolved?: boolean;
  loading?: boolean;
  error?: string;
  scryfallId?: string;
  imageUrl?: string;
  manaCost?: string;
  typeLine?: string;
  estimatedPriceUsd?: number;
  estimatedPriceFoil?: number;
  setDisplayName?: string;
}
