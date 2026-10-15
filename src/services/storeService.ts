import {
  UserProfile,
  PurchaseOrder,
  OrderItem,
  Payment,
  BalanceMovement,
  AppSettings,
  needsPriceRefresh,
  CardCondition,
} from '../types/purchases';

const STORAGE_KEYS = {
  USERS: 'manabros_users',
  ORDERS: 'manabros_orders',
  ITEMS: 'manabros_items',
  PAYMENTS: 'manabros_payments',
  MOVEMENTS: 'manabros_movements',
  SETTINGS: 'manabros_settings',
  ACTIVE_ORDER_ID: 'manabros_active_order_id',
  CURRENT_USER_UID: 'manabros_current_user_uid',
};

// Initial Seeds
const DEFAULT_USERS: UserProfile[] = [
  {
    uid: 'user-admin',
    email: 'manabros.store@gmail.com',
    displayName: 'ManaBros Admin',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    role: 'admin',
    status: 'confirmed',
    balance: 15.50,
    createdAt: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: 'user-carlos',
    email: 'carlos.mtg@gmail.com',
    displayName: 'Carlos Mendoza',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    role: 'comprador',
    status: 'confirmed',
    balance: 4.25,
    createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: 'user-valeria',
    email: 'valeria.mana@gmail.com',
    displayName: 'Valeria R.',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    role: 'colaborador',
    status: 'confirmed',
    balance: 0.00,
    createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
  },
  {
    uid: 'user-unconfirmed',
    email: 'nuevo.jugador@gmail.com',
    displayName: 'Mateo Nuevo',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    role: 'comprador',
    status: 'unconfirmed',
    balance: 0.00,
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_DAYS_AHEAD = 4;
const targetDate = new Date(Date.now() + INITIAL_DAYS_AHEAD * 24 * 3600 * 1000).toISOString();

const DEFAULT_ORDERS: PurchaseOrder[] = [
  {
    id: 'ord-ck-oct26',
    status: 'active',
    estimatedPurchaseDate: targetDate,
    shippingCost: 15.00,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ord-ck-nov26',
    status: 'pending',
    estimatedPurchaseDate: new Date(Date.now() + 18 * 24 * 3600 * 1000).toISOString(),
    shippingCost: 0,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ord-ck-sep26',
    status: 'purchased',
    estimatedPurchaseDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    shippingCost: 18.00,
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ord-ck-ago26',
    status: 'finalized',
    estimatedPurchaseDate: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
    shippingCost: 14.50,
    createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
  },
];

const DEFAULT_ITEMS: OrderItem[] = [
  {
    id: 'item-1',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'carlos.mtg@gmail.com',
    buyerName: 'Carlos Mendoza',
    cardName: 'Ragavan, Nimble Pilferer',
    edition: 'Modern Horizons 2',
    cardType: 'Legendary Creature — Monkey Pirate',
    imageUrl: 'https://cards.scryfall.io/normal/front/a/1/a13c1332-7a11-4e3d-8c3b-012ab6490708.jpg',
    pageUrl: 'https://www.cardkingdom.com/mtg/modern-horizons-2/ragavan-nimble-pilferer',
    productId: '246810',
    foil: false,
    condition: 'NM',
    price: 39.99,
    quantity: 1,
    inStock: true,
    availableQty: 3,
    refreshStatus: 'ok',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    lastCheckedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-2',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'carlos.mtg@gmail.com',
    buyerName: 'Carlos Mendoza',
    cardName: 'Lightning Bolt',
    edition: 'Mystery Booster',
    cardType: 'Instant',
    imageUrl: 'https://cards.scryfall.io/normal/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg',
    pageUrl: 'https://www.cardkingdom.com/mtg/mystery-booster/lightning-bolt',
    productId: '219451',
    foil: false,
    condition: 'EX',
    price: 2.49,
    quantity: 4,
    inStock: true,
    availableQty: 12,
    refreshStatus: 'ok',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    lastCheckedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-3',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'valeria.mana@gmail.com',
    buyerName: 'Valeria R.',
    cardName: 'Sol Ring',
    edition: 'Commander 2021',
    cardType: 'Artifact',
    imageUrl: 'https://cards.scryfall.io/normal/front/4/c/4cbc508b-0f16-4af5-966b-4397b077a760.jpg',
    pageUrl: 'https://www.cardkingdom.com/mtg/commander-2021/sol-ring',
    productId: '245012',
    foil: false,
    condition: 'NM',
    price: 1.99,
    quantity: 2,
    inStock: true,
    availableQty: 24,
    refreshStatus: 'ok',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    lastCheckedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-4',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'valeria.mana@gmail.com',
    buyerName: 'Valeria R.',
    cardName: 'Cyclonic Rift',
    edition: 'Commander 2015',
    cardType: 'Instant',
    imageUrl: 'https://cards.scryfall.io/normal/front/f/f/ff08e5ed-f47b-4d8e-8b8b-41675dccef8b.jpg',
    pageUrl: 'https://www.cardkingdom.com/mtg/commander-2015/cyclonic-rift',
    productId: '204112',
    foil: true,
    condition: 'NM',
    price: 34.99,
    quantity: 1,
    inStock: true,
    availableQty: 2,
    refreshStatus: 'ok',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    lastCheckedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'item-5',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'manabros.store@gmail.com',
    buyerName: 'ManaBros Admin',
    cardName: 'Mana Crypt',
    edition: 'Double Masters',
    cardType: 'Artifact',
    imageUrl: 'https://cards.scryfall.io/normal/front/4/d/4d960186-4559-4af0-bd22-63baa15f8939.jpg',
    pageUrl: 'https://www.cardkingdom.com/mtg/double-masters/mana-crypt',
    productId: '235919',
    foil: false,
    condition: 'NM',
    price: 179.99,
    quantity: 1,
    inStock: true,
    availableQty: 1,
    refreshStatus: 'ok',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    lastCheckedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
];

const DEFAULT_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'carlos.mtg@gmail.com',
    amount: 45.00,
    type: 'cards',
    note: 'Transferencia inicial',
    registeredBy: 'manabros.store@gmail.com',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'pay-2',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'carlos.mtg@gmail.com',
    amount: 10.00,
    type: 'shipping',
    note: 'Abono de flete courier',
    registeredBy: 'manabros.store@gmail.com',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'pay-3',
    orderId: 'ord-ck-oct26',
    buyerEmail: 'valeria.mana@gmail.com',
    amount: 40.00,
    type: 'cards',
    note: 'Pago parcial efectivo',
    registeredBy: 'manabros.store@gmail.com',
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  historyEnabled: true,
  buyersViewHistory: true,
  useProxy: true,
  theme: 'dark',
};

class StoreService {
  private users: UserProfile[] = [];
  private orders: PurchaseOrder[] = [];
  private items: OrderItem[] = [];
  private payments: Payment[] = [];
  private movements: BalanceMovement[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;
  private currentUid: string = 'user-admin';
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      this.users = storedUsers ? JSON.parse(storedUsers) : DEFAULT_USERS;

      const storedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
      this.orders = storedOrders ? JSON.parse(storedOrders) : DEFAULT_ORDERS;

      const storedItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
      this.items = storedItems ? JSON.parse(storedItems) : DEFAULT_ITEMS;

      const storedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      this.payments = storedPayments ? JSON.parse(storedPayments) : DEFAULT_PAYMENTS;

      const storedMovements = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      this.movements = storedMovements ? JSON.parse(storedMovements) : [];

      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      this.settings = storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;

      const storedUid = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_UID);
      if (storedUid && this.users.some(u => u.uid === storedUid)) {
        this.currentUid = storedUid;
      } else {
        this.currentUid = this.users[0]?.uid || 'user-admin';
      }
    } catch (e) {
      console.error('Error loading storage, resetting to defaults', e);
      this.users = DEFAULT_USERS;
      this.orders = DEFAULT_ORDERS;
      this.items = DEFAULT_ITEMS;
      this.payments = DEFAULT_PAYMENTS;
      this.movements = [];
      this.settings = DEFAULT_SETTINGS;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(this.items));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(this.payments));
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(this.movements));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_UID, this.currentUid);
    } catch (e) {
      console.error('Error saving storage', e);
    }
    this.notify();
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // --- Session & Current User ---
  public getCurrentUser(): UserProfile {
    const user = this.users.find(u => u.uid === this.currentUid);
    return user || this.users[0];
  }

  public setCurrentUser(uid: string) {
    if (this.users.some(u => u.uid === uid)) {
      this.currentUid = uid;
      this.saveToStorage();
    }
  }

  public getAllUsers(): UserProfile[] {
    return [...this.users].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  public getUserProfileByEmail(email: string): UserProfile | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public confirmUser(uid: string) {
    const user = this.users.find(u => u.uid === uid);
    if (user) {
      user.status = 'confirmed';
      this.saveToStorage();
    }
  }

  // Balance operations (§5.8 & §6.8)
  public addBalance(email: string, amount: number, description: string, registeredBy: string): { success: boolean; message?: string } {
    if (amount <= 0) return { success: false, message: 'El monto debe ser mayor a 0' };
    if (!description.trim()) return { success: false, message: 'La descripción es obligatoria' };
    const user = this.getUserProfileByEmail(email);
    if (!user) return { success: false, message: 'Usuario no encontrado' };

    user.balance = Math.round((user.balance + amount) * 100) / 100;
    const movement: BalanceMovement = {
      id: `mov-${Date.now()}`,
      email,
      type: 'credit',
      amount,
      description,
      registeredBy,
      createdAt: new Date().toISOString(),
    };
    this.movements.unshift(movement);
    this.saveToStorage();
    return { success: true };
  }

  public outflowBalance(email: string, amount: number, description: string, registeredBy: string): { success: boolean; message?: string } {
    if (amount <= 0) return { success: false, message: 'El monto debe ser mayor a 0' };
    if (!description.trim()) return { success: false, message: 'La descripción es obligatoria' };
    const user = this.getUserProfileByEmail(email);
    if (!user) return { success: false, message: 'Usuario no encontrado' };
    if (amount > user.balance) return { success: false, message: 'No puede superar el saldo actual' };

    user.balance = Math.round((user.balance - amount) * 100) / 100;
    const movement: BalanceMovement = {
      id: `mov-${Date.now()}`,
      email,
      type: 'outflow',
      amount,
      description,
      registeredBy,
      createdAt: new Date().toISOString(),
    };
    this.movements.unshift(movement);
    this.saveToStorage();
    return { success: true };
  }

  public getBalanceMovements(email: string): BalanceMovement[] {
    return this.movements
      .filter(m => m.email.toLowerCase() === email.toLowerCase())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Orders ---
  public getAllOrders(): PurchaseOrder[] {
    return [...this.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getActiveOrders(): PurchaseOrder[] {
    return this.orders.filter(o => o.status === 'active');
  }

  public getActiveOrderId(): string | null {
    const active = this.getActiveOrders();
    return active.length > 0 ? active[0].id : null;
  }

  public getOrderById(orderId: string): PurchaseOrder | undefined {
    return this.orders.find(o => o.id === orderId);
  }

  /**
   * Creación: solo admin, DatePicker (hoy + 7 días default).
   * La orden se crea SIEMPRE en 'pending' (§4).
   */
  public createOrder(estimatedPurchaseDate?: string): PurchaseOrder {
    const newOrder: PurchaseOrder = {
      id: `ord-ck-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending',
      estimatedPurchaseDate: estimatedPurchaseDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      shippingCost: 0,
      createdAt: new Date().toISOString(),
    };
    this.orders.unshift(newOrder);
    this.saveToStorage();
    return newOrder;
  }

  public updateOrderStatus(orderId: string, newStatus: PurchaseOrder['status']): { success: boolean; surplusList?: { email: string; surplus: number }[] } {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { success: false };

    // If finalizing, calculate surpluses and credit them to user balances (§4 & §6.6)
    if (newStatus === 'finalized') {
      const surpluses = this.finalizeOrder(orderId);
      order.status = 'finalized';
      this.saveToStorage();
      return { success: true, surplusList: surpluses };
    }

    order.status = newStatus;
    this.saveToStorage();
    return { success: true };
  }

  public updateOrderShippingCost(orderId: string, shippingCost: number) {
    const order = this.orders.find(o => o.id === orderId);
    if (order && order.status !== 'finalized') {
      order.shippingCost = Math.max(0, shippingCost);
      this.saveToStorage();
    }
  }

  /**
   * Finalización (regla crítica §4 & §6.6):
   * cardsSurplus = cardsPaid - userAmount
   * shippingSurplus = shippingPaid - shippingShare
   * total = max(cardsSurplus, 0) + max(shippingSurplus, 0)
   * Solo total > 0 genera crédito: balance += total + BalanceMovement(credit, "Saldo a favor por finalizar orden", orderId)
   */
  private finalizeOrder(orderId: string): { email: string; surplus: number }[] {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return [];

    const items = this.getItemsByOrder(orderId);
    const payments = this.getPaymentsByOrder(orderId);

    // Group items by buyer
    const buyers = Array.from(new Set(items.map(i => i.buyerEmail.toLowerCase())));
    const totalOrderCards = items.reduce((sum, i) => sum + i.quantity, 0);
    const shippingCost = order.shippingCost || 0;

    const surplusResults: { email: string; surplus: number }[] = [];

    buyers.forEach(email => {
      const buyerItems = items.filter(i => i.buyerEmail.toLowerCase() === email);
      const buyerCards = buyerItems.reduce((sum, i) => sum + i.quantity, 0);
      const userAmount = buyerItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      const buyerPayments = payments.filter(p => p.buyerEmail.toLowerCase() === email);
      const cardsPaid = buyerPayments.filter(p => p.type === 'cards').reduce((sum, p) => sum + p.amount, 0);
      const shippingPaid = buyerPayments.filter(p => p.type === 'shipping').reduce((sum, p) => sum + p.amount, 0);

      const shippingShare = totalOrderCards > 0 ? (shippingCost / totalOrderCards) * buyerCards : 0;

      const cardsSurplus = cardsPaid - userAmount;
      const shippingSurplus = shippingPaid - shippingShare;
      const totalSurplus = Math.round((Math.max(cardsSurplus, 0) + Math.max(shippingSurplus, 0)) * 100) / 100;

      if (totalSurplus > 0) {
        const user = this.getUserProfileByEmail(email);
        if (user) {
          user.balance = Math.round((user.balance + totalSurplus) * 100) / 100;
          this.movements.unshift({
            id: `mov-surplus-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            email,
            type: 'credit',
            amount: totalSurplus,
            description: `Saldo a favor por finalizar orden ${orderId.slice(0, 8)}`,
            orderId,
            registeredBy: 'Sistema',
            createdAt: new Date().toISOString(),
          });
        }
        surplusResults.push({ email, surplus: totalSurplus });
      }
    });

    return surplusResults;
  }

  // --- Items & Upsert Rules (§2.8) ---
  public getItemsByOrder(orderId: string): OrderItem[] {
    return this.items.filter(i => i.orderId === orderId);
  }

  public getItemsByOrderAndUser(orderId: string, email: string): OrderItem[] {
    return this.items.filter(i => i.orderId === orderId && i.buyerEmail.toLowerCase() === email.toLowerCase());
  }

  /**
   * Regla de upsert de items (§2.8):
   * Coincidencia: buyerEmail + cardName + condition + foil
   * Si coincide: quantity += newQuantity; price, pageUrl, imageUrl actualizados.
   * Si no: nuevo OrderItem.
   */
  public upsertItem(orderId: string, itemData: Omit<OrderItem, 'id' | 'orderId' | 'createdAt' | 'lastCheckedAt' | 'refreshStatus'>): OrderItem {
    const existing = this.items.find(i =>
      i.orderId === orderId &&
      i.buyerEmail.toLowerCase() === itemData.buyerEmail.toLowerCase() &&
      i.cardName.trim().toLowerCase() === itemData.cardName.trim().toLowerCase() &&
      i.condition === itemData.condition &&
      i.foil === itemData.foil
    );

    if (existing) {
      existing.quantity += itemData.quantity;
      existing.price = itemData.price;
      existing.pageUrl = itemData.pageUrl || existing.pageUrl;
      existing.imageUrl = itemData.imageUrl || existing.imageUrl;
      existing.productId = itemData.productId || existing.productId;
      existing.inStock = itemData.inStock;
      existing.availableQty = itemData.availableQty;
      this.saveToStorage();
      return existing;
    } else {
      const newItem: OrderItem = {
        ...itemData,
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        orderId,
        refreshStatus: 'ok',
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      };
      this.items.push(newItem);
      this.saveToStorage();
      return newItem;
    }
  }

  public updateItem(orderId: string, itemId: string, updates: Partial<OrderItem>) {
    const item = this.items.find(i => i.id === itemId && i.orderId === orderId);
    if (!item) return;

    // Regla §5.3: Cambio de condición = se restablece refreshStatus = null ("No consultado")
    if (updates.condition && updates.condition !== item.condition) {
      item.condition = updates.condition;
      item.refreshStatus = null;
    }

    if (updates.price !== undefined) item.price = Math.max(0, updates.price);
    if (updates.quantity !== undefined) item.quantity = Math.max(1, updates.quantity);

    this.saveToStorage();
  }

  public deleteItem(orderId: string, itemId: string) {
    this.items = this.items.filter(i => !(i.id === itemId && i.orderId === orderId));
    this.saveToStorage();
  }

  public deleteUserItems(orderId: string, buyerEmail: string) {
    this.items = this.items.filter(i => !(i.orderId === orderId && i.buyerEmail.toLowerCase() === buyerEmail.toLowerCase()));
    this.saveToStorage();
  }

  // --- Payments (§8) ---
  public getPaymentsByOrder(orderId: string): Payment[] {
    return this.payments
      .filter(p => p.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addPayment(orderId: string, buyerEmail: string, amount: number, type: 'cards' | 'shipping', note: string, registeredBy: string): { success: boolean; message?: string } {
    if (amount <= 0) return { success: false, message: 'El abono debe ser mayor a 0' };
    const newPayment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orderId,
      buyerEmail,
      amount: Math.round(amount * 100) / 100,
      type,
      note,
      registeredBy,
      createdAt: new Date().toISOString(),
    };
    this.payments.unshift(newPayment);
    this.saveToStorage();
    return { success: true };
  }

  public deletePayment(orderId: string, paymentId: string) {
    this.payments = this.payments.filter(p => !(p.id === paymentId && p.orderId === orderId));
    this.saveToStorage();
  }

  // --- Settings (§2.7 & §5.9) ---
  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveToStorage();
  }

  // --- Calculations Helper for Order Details ---
  public getOrderSummary(orderId: string) {
    const order = this.getOrderById(orderId);
    const items = this.getItemsByOrder(orderId);
    const payments = this.getPaymentsByOrder(orderId);

    const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalCartasAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const shippingCost = order?.shippingCost || 0;

    // Payments totals
    const totalCardsPaid = payments.filter(p => p.type === 'cards').reduce((sum, p) => sum + p.amount, 0);
    const totalShippingPaid = payments.filter(p => p.type === 'shipping').reduce((sum, p) => sum + p.amount, 0);
    const totalPaidAll = totalCardsPaid + totalShippingPaid;

    // Buyers map
    const buyerEmails = Array.from(new Set(items.map(i => i.buyerEmail.toLowerCase())));
    const buyersData = buyerEmails.map(email => {
      const user = this.getUserProfileByEmail(email);
      const userItems = items.filter(i => i.buyerEmail.toLowerCase() === email);
      const userCards = userItems.reduce((sum, i) => sum + i.quantity, 0);
      const userCardsAmount = userItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      const userPayments = payments.filter(p => p.buyerEmail.toLowerCase() === email);
      const cardsPaid = userPayments.filter(p => p.type === 'cards').reduce((sum, p) => sum + p.amount, 0);
      const shippingPaid = userPayments.filter(p => p.type === 'shipping').reduce((sum, p) => sum + p.amount, 0);

      // Shipping split (§6.5): share = shippingCost / totalCards * userCards
      const shippingShare = totalCards > 0 ? (shippingCost / totalCards) * userCards : 0;
      const shippingPending = shippingShare - shippingPaid;

      // Cards coverage
      const cardsPending = userCardsAmount - cardsPaid;

      return {
        email,
        displayName: user?.displayName || userItems[0]?.buyerName || email,
        photoURL: user?.photoURL || '',
        userCards,
        userCardsAmount,
        cardsPaid,
        cardsPending,
        shippingShare,
        shippingPaid,
        shippingPending,
        totalPaid: cardsPaid + shippingPaid,
        items: userItems,
        payments: userPayments,
      };
    });

    return {
      order,
      totalCards,
      totalCartasAmount,
      shippingCost,
      totalCardsPaid,
      totalShippingPaid,
      totalPaidAll,
      buyersData,
      isFinalized: order?.status === 'finalized',
      isActive: order?.status === 'active',
      isPending: order?.status === 'pending',
      isPurchased: order?.status === 'purchased',
    };
  }
}

export const storeService = new StoreService();
