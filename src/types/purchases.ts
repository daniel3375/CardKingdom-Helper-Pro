export type CardCondition = 'NM' | 'EX' | 'VG' | 'G';
export type UserRole = 'admin' | 'colaborador' | 'comprador';
export type UserStatus = 'unconfirmed' | 'confirmed';
export type PurchaseOrderStatus = 'pending' | 'active' | 'purchased' | 'finalized';
export type PaymentType = 'cards' | 'shipping';
export type BalanceMovementType = 'credit' | 'outflow';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  status: UserStatus;
  balance: number;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  status: PurchaseOrderStatus;
  estimatedPurchaseDate?: string | null;
  shippingCost?: number | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  cardName: string;
  edition: string;
  cardType: string;
  imageUrl: string;
  pageUrl: string;
  productId: string;
  foil: boolean;
  condition: CardCondition;
  price: number;
  quantity: number;
  inStock: boolean;
  availableQty: number;
  refreshStatus: 'ok' | 'error' | null;
  createdAt: string;
  lastCheckedAt: string;
  // Diffs from last rescrape
  previousPrice?: number;
  priceDelta?: number;
  stockChanged?: 'in_stock' | 'out_of_stock' | null;
}

export interface Payment {
  id: string;
  orderId: string;
  buyerEmail: string;
  amount: number;
  note: string;
  registeredBy: string;
  type: PaymentType;
  createdAt: string;
}

export interface BalanceMovement {
  id: string;
  email: string;
  type: BalanceMovementType;
  amount: number;
  description: string;
  orderId?: string | null;
  registeredBy: string;
  createdAt: string;
}

export interface AppSettings {
  historyEnabled: boolean;
  buyersViewHistory: boolean;
  useProxy: boolean;
  theme: 'dark' | 'light' | 'system';
}

/**
 * Regla de elegibilidad de refresco de precio (§2.4):
 * - pageUrl no vacío
 * - refreshStatus != 'ok' (nunca consultado o con error)
 * - o han transcurrido >= 1 hora desde lastCheckedAt
 */
export function needsPriceRefresh(item: OrderItem): boolean {
  if (!item.pageUrl || item.pageUrl.trim() === '') return false;
  if (item.refreshStatus !== 'ok') return true;
  try {
    const lastCheck = new Date(item.lastCheckedAt).getTime();
    if (isNaN(lastCheck)) return true;
    const diffHours = (Date.now() - lastCheck) / (1000 * 60 * 60);
    return diffHours >= 1;
  } catch {
    return true;
  }
}

/**
 * Cálculo de urgencia para fecha estimada (§4):
 * - < 0: Vencida hace N días (rojo)
 * - = 0: Compra es hoy (rojo)
 * - > 0: En N días (verde)
 */
export function getOrderUrgency(estimatedDateStr?: string | null): {
  label: string;
  urgency: 'overdue' | 'today' | 'upcoming' | 'none';
  days: number;
} {
  if (!estimatedDateStr) return { label: '', urgency: 'none', days: 0 };
  const target = new Date(estimatedDateStr);
  if (isNaN(target.getTime())) return { label: '', urgency: 'none', days: 0 };

  const now = new Date();
  // Normalized to midnight
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? '' : 's'}`,
      urgency: 'overdue',
      days: diffDays,
    };
  } else if (diffDays === 0) {
    return {
      label: 'Compra es hoy',
      urgency: 'today',
      days: 0,
    };
  } else {
    return {
      label: `En ${diffDays} día${diffDays === 1 ? '' : 's'}`,
      urgency: 'upcoming',
      days: diffDays,
    };
  }
}
