import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { resolveImageUrl } from '../../utils/imageUrl';
import { tactileFeedback } from '../../utils/feedback';
import { gToast } from '../../utils/toast';
import {
  ShoppingBag,
  ArrowDownLeft,
  UtensilsCrossed,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  RefreshCw,
  Bell,
  Check,
  X,
  CreditCard,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ClipboardList,
  History,
  Trash2
} from 'lucide-react';

interface Variation {
  id: string;
  product_id: string;
  name: string;
  variation_name?: string;
  size?: string;
  weight?: string;
  flavor?: string;
  bakery_stock: number;
  in_transit_stock: number;
  counter_stock: number;
  min_stock_level: number;
  selling_price: number;
  price?: number;
  cost_price?: number;
  sku?: string;
  product_name?: string;
  product_name_amharic?: string;
  product_category?: string;
  image_url?: string;
  photo_url?: string;
}

interface Product {
  id: string;
  name: string;
  name_amharic?: string;
  category: string;
  description?: string;
  photo_url?: string;
  image_url?: string;
  variations: Variation[];
}

interface Transfer {
  id: string;
  variation_id: string;
  batch_id?: string;
  quantity: number;
  quantity_sent?: number;
  status: 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  created_at: string;
  sent_at?: string;
  received_at?: string;
  product_name: string;
  product_name_amharic?: string;
  variation_name: string;
  size?: string;
  sender_name?: string;
  photo_url?: string;
}

interface CakeOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  variation_id: string;
  quantity: number;
  notes?: string;
  status: string;
  created_at: string;
  order_number: string;
  table_number?: string;
  order_type: string;
  waiter_name: string;
  item_name: string;
  variation_name: string;
  size?: string;
  photo_url?: string;
}

// Visual cake photo helper ensuring every single cake has a rich, appetizing picture
function getCakePhoto(item: { image_url?: string; photo_url?: string; name?: string; product_name?: string }): string {
  const url = item.photo_url || item.image_url;
  if (url && url.trim()) {
    const resolved = resolveImageUrl(url);
    if (resolved) return resolved;
  }

  const text = `${item.product_name || ''} ${item.name || ''}`.toLowerCase();
  if (text.includes('choc') || text.includes('ቸኮሌት') || text.includes('ፈጅ')) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80';
  }
  if (text.includes('velvet') || text.includes('ቬልቬት') || text.includes('ቀይ')) {
    return 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600&q=80';
  }
  if (text.includes('cheese') || text.includes('ቺዝ') || text.includes('strawb')) {
    return 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80';
  }
  if (text.includes('croissant') || text.includes('ክሩዋሳን') || text.includes('ቅቤ')) {
    return 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80';
  }
  if (text.includes('forest') || text.includes('ፎረስት')) {
    return 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=600&q=80';
  }
  return 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80';
}

const PRESET_CAKE_PHOTOS = [
  { label: 'ቸኮሌት (Chocolate)', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80' },
  { label: 'ሬድ ቬልቬት (Red Velvet)', url: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600&q=80' },
  { label: 'ስትሮውበሪ ቺዝ (Cheesecake)', url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80' },
  { label: 'ቫኒላ / ካሮት (Vanilla Cake)', url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80' },
  { label: 'ክሩዋሳን (Croissant)', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80' },
  { label: 'ብላክ ፎረስት (Black Forest)', url: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=600&q=80' }
];

export const FrontCounterView: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'showcase' | 'transfers' | 'orders' | 'history'>('showcase');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [cakeOrders, setCakeOrders] = useState<CakeOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Grouped variations: Product ID -> Selected Variation ID
  const [selectedVariationMap, setSelectedVariationMap] = useState<Record<string, string>>({});

  // Cart for Direct Walk-in Sale
  const [cart, setCart] = useState<{ variation: Variation; quantity: number }[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TELEBIRR' | 'CARD'>('CASH');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);

  // 1-Tap Reorder Request Modal
  const [requestTarget, setRequestTarget] = useState<Variation | null>(null);
  const [requestQty, setRequestQty] = useState(5);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Transfer Reject Modal
  const [rejectTransferTarget, setRejectTransferTarget] = useState<Transfer | null>(null);
  const [rejectReason, setRejectReason] = useState('ተሰብሯል / Damaged');

  // History Tab Data
  const [historyData, setHistoryData] = useState<{ sales: any[]; transfersReceived: any[] }>({
    sales: [],
    transfersReceived: []
  });
  const [historySubTab, setHistorySubTab] = useState<'sales' | 'transfers'>('sales');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add Cake Modal (Bakery, Admin, Owner)
  const [showAddCakeModal, setShowAddCakeModal] = useState(false);
  const [isCreatingCake, setIsCreatingCake] = useState(false);
  const [newCakeName, setNewCakeName] = useState('');
  const [newCakeAmharic, setNewCakeAmharic] = useState('');
  const [newCakeCategory, setNewCakeCategory] = useState('Cake');
  const [newCakePhoto, setNewCakePhoto] = useState(PRESET_CAKE_PHOTOS[0].url);
  const [newCakeVariations, setNewCakeVariations] = useState<
    { variation_name: string; size: string; price: number; min_stock_level: number }[]
  >([
    { variation_name: 'Single Slice', size: 'ቁራጭ (Slice)', price: 150, min_stock_level: 5 },
    { variation_name: 'Medium 1kg', size: '1 ኪ.ግ (1kg)', price: 1200, min_stock_level: 2 }
  ]);

  // Delete Cake Modal (Admin & Owner ONLY)
  const [cakeToDelete, setCakeToDelete] = useState<Product | null>(null);
  const [isDeletingCake, setIsDeletingCake] = useState(false);

  const canCreateCake = user?.role === 'bakery' || user?.role === 'admin' || user?.role === 'owner';
  const canDeleteCake = user?.role === 'admin' || user?.role === 'owner';

  // Load all operational data
  const loadData = useCallback(async () => {
    try {
      const [prodData, transData, cakeData] = await Promise.all([
        api.request<any>('/bakery/products').catch(() => ({ data: [] })),
        api.request<any>('/bakery/transfers').catch(() => ({ data: [] })),
        api.request<any>('/bakery/cake-queue').catch(() => ({ data: [] }))
      ]);

      const rawProducts: Product[] = Array.isArray(prodData) ? prodData : prodData?.data || [];
      setProducts(rawProducts);
      setTransfers(Array.isArray(transData) ? transData : transData?.data || []);
      setCakeOrders(Array.isArray(cakeData) ? cakeData : cakeData?.data || []);

      // Auto-initialize selected variation map
      setSelectedVariationMap(prev => {
        const updated = { ...prev };
        rawProducts.forEach(p => {
          if (!updated[p.id] && p.variations && p.variations.length > 0) {
            updated[p.id] = p.variations[0].id;
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to load front counter data', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res: any = await api.request('/bakery/counter-history');
      if (res) {
        setHistoryData({
          sales: res.sales || [],
          transfersReceived: res.transfersReceived || []
        });
      }
    } catch (err) {
      console.error('Failed to load counter history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();

    // Listen to real-time events
    const unsub = api.onEvent((event) => {
      if (
        event?.type === 'BAKERY_TRANSFER_PENDING' ||
        event?.type === 'BAKERY_TRANSFER_RECEIVED' ||
        event?.type === 'BAKERY_REQUEST_NEW' ||
        event?.type === 'BAKERY_REQUEST_UPDATED' ||
        event?.type === 'CAKE_NEW_ORDER' ||
        event?.type === 'CAKE_ORDER_UPDATED' ||
        event?.type === 'ORDER_CONFIRMED' ||
        event?.type === 'ORDER_READY' ||
        event?.type === 'BAKERY_STOCK_UPDATED'
      ) {
        loadData();
      }
    });

    const interval = setInterval(loadData, 10000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // 1-Tap Add to Cart
  const handleTapCake = (cake: Variation) => {
    tactileFeedback('click');
    const counterStock = Number(cake.counter_stock || 0);

    if (counterStock <= 0) {
      // Cake is empty, open 1-tap reorder request
      setRequestTarget(cake);
      setRequestQty(5);
      return;
    }

    const existing = cart.find(c => c.variation.id === cake.id);
    if (existing) {
      if (existing.quantity >= counterStock) {
        gToast.error(`ከ${counterStock} በላይ ኬክ የለም / Max counter stock reached`);
        return;
      }
      setCart(cart.map(c => (c.variation.id === cake.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { variation: cake, quantity: 1 }]);
    }
  };

  const updateCartQty = (cakeId: string, delta: number) => {
    tactileFeedback('click');
    const existing = cart.find(c => c.variation.id === cakeId);
    if (!existing) return;

    const newQty = existing.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(c => c.variation.id !== cakeId));
    } else {
      const stock = Number(existing.variation.counter_stock || 0);
      if (newQty > stock) {
        gToast.error(`ያለው ኬክ ${stock} ብቻ ነው`);
        return;
      }
      setCart(cart.map(c => (c.variation.id === cakeId ? { ...c, quantity: newQty } : c)));
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = Number(item.variation.selling_price || item.variation.price || 0);
    return sum + item.quantity * price;
  }, 0);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // 1-Tap Confirm Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    tactileFeedback('success');
    setIsProcessingSale(true);
    try {
      const res: any = await api.request('/bakery/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: 'Walk-in Customer',
          payment_method: paymentMethod,
          notes: 'Counter Walk-in Sale',
          items: cart.map(c => ({
            variation_id: c.variation.id,
            quantity: c.quantity,
            unit_price: Number(c.variation.selling_price || c.variation.price || 0)
          }))
        })
      });

      setLastReceipt({
        ...res?.data,
        items: [...cart],
        total: cartTotal,
        paymentMethod,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      setCart([]);
      setShowCheckoutModal(false);
      gToast.success('✅ ተሽጧል! (Cake Sold!)');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ሽያጩ አልተሳካም');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // 1-Tap Receive Delivery
  const handleConfirmTransfer = async (transfer: Transfer) => {
    tactileFeedback('success');
    try {
      const qty = transfer.quantity_sent || transfer.quantity;
      await api.request(`/bakery/transfers/${transfer.id}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({
          received_quantity: qty,
          notes: 'ተቀብያለሁ / Physically counted & accepted'
        })
      });

      gToast.success(`✅ ${qty} ኬክ ተቀብለዋል! (Accepted into stock!)`);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ርክክቡ አልተሳካም');
    }
  };

  // Reject Delivery
  const handleRejectTransfer = async () => {
    if (!rejectTransferTarget) return;
    tactileFeedback('click');
    try {
      await api.request(`/bakery/transfers/${rejectTransferTarget.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: rejectReason })
      });
      gToast.success('ርክክቡ ተመልሷል (Transfer Rejected)');
      setRejectTransferTarget(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'መመለስ አልተቻለም');
    }
  };

  // 1-Tap Cake Ready for Waiter
  const handleMarkCakeReady = async (itemId: string) => {
    tactileFeedback('success');
    try {
      await api.request(`/bakery/cake-queue/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' })
      });
      gToast.success('🔔 ለአስተናጋጅ ተልኳል! (Cake marked READY!)');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ማዘመን አልተቻለም');
    }
  };

  // 1-Tap Reorder Request to Bakery
  const handleSendBakeRequest = async () => {
    if (!requestTarget) return;
    tactileFeedback('click');
    setIsSendingRequest(true);
    try {
      await api.request('/bakery/requests', {
        method: 'POST',
        body: JSON.stringify({
          product_id: requestTarget.product_id,
          variation_id: requestTarget.id,
          requested_quantity: requestQty,
          urgency: 'HIGH',
          notes: 'ካውንተር ላይ አልቋል / Urgent replenishment needed'
        })
      });
      tactileFeedback('success');
      gToast.success(`🔔 ወደ ዳቦ ቤት ${requestQty} ኬክ ተጠይቋል!`);
      setRequestTarget(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ጥያቄው አልተላከም');
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Create complete cake menu item
  const handleCreateCake = async () => {
    if (!newCakeName.trim()) {
      gToast.error('እባክዎ የኬክ ስም ያስገቡ (Please enter cake name)');
      return;
    }
    if (newCakeVariations.length === 0) {
      gToast.error('ቢያንስ አንድ መጠን ያስገቡ (Add at least one size)');
      return;
    }

    tactileFeedback('click');
    setIsCreatingCake(true);
    try {
      await api.request('/bakery/complete-cake', {
        method: 'POST',
        body: JSON.stringify({
          name: newCakeName.trim(),
          name_amharic: newCakeAmharic.trim() || newCakeName.trim(),
          category: newCakeCategory,
          photo_url: newCakePhoto,
          variations: newCakeVariations
        })
      });
      tactileFeedback('success');
      gToast.success('🎂 አዲሱ ኬክ በስኬት ተመዝግቧል! (New cake created!)');
      setShowAddCakeModal(false);
      setNewCakeName('');
      setNewCakeAmharic('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ኬክ መመዝገብ አልተቻለም');
    } finally {
      setIsCreatingCake(false);
    }
  };

  // Delete cake product (Admin & Owner ONLY)
  const handleDeleteCake = async () => {
    if (!cakeToDelete) return;
    tactileFeedback('click');
    setIsDeletingCake(true);
    try {
      await api.request(`/bakery/products/${cakeToDelete.id}`, {
        method: 'DELETE'
      });
      tactileFeedback('success');
      gToast.success('🗑️ ኬኩ ተሰርዟል (Cake deleted)');
      setCakeToDelete(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'መሰረዝ አልተቻለም');
    } finally {
      setIsDeletingCake(false);
    }
  };

  // Pending counts
  const pendingTransfers = transfers.filter(t => t.status === 'PENDING' || t.status === 'IN_TRANSIT');
  const pendingOrders = cakeOrders.filter(o => o.status !== 'DELIVERED' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: cart.length > 0 ? '16px 20px 140px' : '16px 20px 90px', boxSizing: 'border-box', fontFamily: 'var(--font-family)' }}>
      {/* Visual Top Header Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #9d174d 0%, #db2777 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          borderRadius: 22,
          marginBottom: 18,
          boxShadow: '0 8px 24px rgba(157, 23, 77, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28
            }}
          >
            🧁
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
              የፊት ኬክ መሸጫ
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, opacity: 0.9 }}>
              Cake Sales Showcase • {user?.username} ({user?.role})
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {canCreateCake && (
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowAddCakeModal(true);
              }}
              style={{
                background: '#ffffff',
                color: '#db2777',
                border: 'none',
                borderRadius: 14,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
              }}
            >
              <Plus size={18} strokeWidth={3} />
              + አዲስ ኬክ መዝግብ
            </button>
          )}

          <button
            onClick={() => {
              tactileFeedback('click');
              setIsRefreshing(true);
              loadData();
              if (activeTab === 'history') loadHistory();
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 14,
              padding: '12px 18px',
              fontSize: 14,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            አድስ (Refresh)
          </button>
        </div>
      </div>

      {/* 4 Large Picture-Driven Tab Buttons - Optimized for Tablets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Tab 1: Showcase & Sell */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('showcase');
          }}
          style={{
            background: activeTab === 'showcase' ? 'linear-gradient(135deg, #be185d 0%, #db2777 100%)' : 'var(--bg-card)',
            color: activeTab === 'showcase' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'showcase' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'showcase' ? '0 8px 20px rgba(190, 24, 93, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🍰</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>ኬክ መሸጫ</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Sell Cakes</span>
        </button>

        {/* Tab 2: Incoming from Bakery */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('transfers');
          }}
          style={{
            position: 'relative',
            background: activeTab === 'transfers' ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' : 'var(--bg-card)',
            color: activeTab === 'transfers' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'transfers' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'transfers' ? '0 8px 20px rgba(2, 132, 199, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🚚</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>የመጣ ርክክብ</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Incoming</span>

          {pendingTransfers.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: 6,
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 900,
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                animation: 'pulse 1.5s infinite'
              }}
            >
              {pendingTransfers.length}
            </span>
          )}
        </button>

        {/* Tab 3: Waiter Orders */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('orders');
          }}
          style={{
            position: 'relative',
            background: activeTab === 'orders' ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : 'var(--bg-card)',
            color: activeTab === 'orders' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'orders' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'orders' ? '0 8px 20px rgba(217, 119, 6, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🍽️</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>የትዕዛዝ ወረፋ</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Orders</span>

          {pendingOrders.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: 6,
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 900,
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              {pendingOrders.length}
            </span>
          )}
        </button>

        {/* Tab 4: History Log */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('history');
          }}
          style={{
            background: activeTab === 'history' ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'var(--bg-card)',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'history' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'history' ? '0 8px 20px rgba(79, 70, 229, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>📜</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>ታሪክ</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>History Log</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISUAL SHOWCASE & CAKE SELL GRID (COMBINED BY PRODUCT WITH SIZE PILLS) */}
      {/* ========================================================================= */}
      {activeTab === 'showcase' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}
          >
            {products.map(product => {
              const variations = product.variations || [];
              if (variations.length === 0) return null;

              const selectedVarId = selectedVariationMap[product.id] || variations[0]?.id;
              const activeVar = variations.find(v => v.id === selectedVarId) || variations[0];
              const photo = getCakePhoto(product);

              const counterStock = Number(activeVar?.counter_stock || 0);
              const inStock = counterStock > 0;
              const isLow = inStock && counterStock <= Number(activeVar?.min_stock_level || 3);
              const cartItem = cart.find(c => c.variation.id === activeVar?.id);

              return (
                <div
                  key={product.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: cartItem
                      ? '3px solid #db2777'
                      : !inStock
                      ? '2px dashed #fca5a5'
                      : '2px solid var(--border)',
                    boxShadow: cartItem
                      ? '0 8px 22px rgba(219, 39, 119, 0.28)'
                      : 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  {/* Big Image Container with Badges */}
                  <div style={{ position: 'relative', width: '100%', height: 160, background: '#f3f4f6' }}>
                    <img
                      src={photo}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: !inStock ? 'grayscale(0.6) opacity(0.85)' : 'none'
                      }}
                    />

                    {/* Stock Status Badge Right Over Image */}
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      {inStock ? (
                        <span
                          style={{
                            background: isLow ? '#fef08a' : '#22c55e',
                            color: isLow ? '#854d0e' : '#ffffff',
                            padding: '4px 10px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 900,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                          {counterStock} አለ
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            padding: '4px 10px',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 900,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                          }}
                        >
                          🔴 አልቋል (OUT)
                        </span>
                      )}
                    </div>

                    {/* Admin/Owner Delete Button */}
                    {canDeleteCake && (
                      <button
                        title="ይህን ኬክ ሰርዝ (Delete Cake)"
                        onClick={(e) => {
                          e.stopPropagation();
                          tactileFeedback('click');
                          setCakeToDelete(product);
                        }}
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: cartItem ? 48 : 8,
                          background: 'rgba(239, 68, 68, 0.88)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 10,
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          zIndex: 5
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    {/* Cart Selected Overlay Badge */}
                    {cartItem && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: '#db2777',
                          color: '#ffffff',
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 900,
                          boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
                          border: '2px solid #ffffff'
                        }}
                      >
                        {cartItem.quantity}
                      </div>
                    )}
                  </div>

                  {/* Cake Details */}
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)', lineHeight: 1.25 }}>
                        {product.name_amharic || product.name}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {product.name}
                      </div>

                      {/* Interactive Size Pills */}
                      <div style={{ marginTop: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          መጠን ይምረጡ (Select Size):
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {variations.map(v => {
                            const isSelected = v.id === activeVar?.id;
                            const stock = Number(v.counter_stock || 0);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  tactileFeedback('click');
                                  setSelectedVariationMap(prev => ({ ...prev, [product.id]: v.id }));
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  border: isSelected ? '2px solid #db2777' : '1px solid var(--border)',
                                  background: isSelected ? '#fdf2f8' : 'var(--bg-app)',
                                  color: isSelected ? '#be185d' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {v.size || v.name || v.variation_name} ({stock})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Row */}
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>
                        {Number(activeVar?.selling_price || activeVar?.price || 0)} ብር
                      </span>

                      {!inStock ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            tactileFeedback('click');
                            const cakeObj: Variation = {
                              ...activeVar,
                              product_name: product.name,
                              product_name_amharic: product.name_amharic,
                              photo_url: product.photo_url
                            };
                            setRequestTarget(cakeObj);
                            setRequestQty(5);
                          }}
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer'
                          }}
                        >
                          <Bell size={14} /> ከዳቦ ቤት እዘዝ
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button
                            title="ከዳቦ ቤት ተጨማሪ ጠይቅ (Request Bake)"
                            onClick={(e) => {
                              e.stopPropagation();
                              tactileFeedback('click');
                              const cakeObj: Variation = {
                                ...activeVar,
                                product_name: product.name,
                                product_name_amharic: product.name_amharic,
                                photo_url: product.photo_url
                              };
                              setRequestTarget(cakeObj);
                              setRequestQty(5);
                            }}
                            style={{
                              background: '#fff1f2',
                              color: '#e11d48',
                              border: '1.5px solid #fecdd3',
                              borderRadius: 12,
                              padding: '8px 10px',
                              fontSize: 12,
                              fontWeight: 900,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <Bell size={13} /> ጠይቅ
                          </button>

                          <button
                            onClick={() => {
                              tactileFeedback('click');
                              const cakeObj: Variation = {
                                ...activeVar,
                                product_name: product.name,
                                product_name_amharic: product.name_amharic,
                                photo_url: product.photo_url
                              };
                              handleTapCake(cakeObj);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: 13,
                              fontWeight: 900,
                              padding: '8px 14px',
                              borderRadius: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: '0 3px 8px rgba(219, 39, 119, 0.25)'
                            }}
                          >
                            <Plus size={16} /> ወደ ቅርጫት
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INCOMING CAKE DELIVERIES FROM BAKERY */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {pendingTransfers.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                background: 'var(--bg-card)',
                borderRadius: 20,
                padding: 40,
                textAlign: 'center',
                border: '2px dashed var(--border)'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🚚</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>አዲስ የመጣ ኬክ የለም</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                ከዳቦ ቤት የተላከ አዲስ ኬክ የለም (No pending deliveries right now).
              </p>
            </div>
          ) : (
            pendingTransfers.map(trf => {
              const photo = getCakePhoto(trf);
              const qty = trf.quantity_sent || trf.quantity;

              return (
                <div
                  key={trf.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    border: '3px solid #38bdf8',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <img
                      src={photo}
                      alt={trf.product_name}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 16,
                        objectFit: 'cover',
                        border: '2px solid #e0f2fe',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flexGrow: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase' }}>
                        🚚 ከዳቦ ቤት ደርሷል (Arrived from Bakery)
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 0', color: 'var(--text-main)' }}>
                        {trf.product_name_amharic || trf.product_name}
                      </h3>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                        {trf.variation_name} {trf.size && `• ${trf.size}`}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0369a1', marginTop: 4 }}>
                        ብዛት (Count): <span style={{ fontSize: 24, color: '#0284c7' }}>{qty}</span> ኬክ
                      </div>
                    </div>
                  </div>

                  {/* 2 Big Touch Action Buttons for Low Literacy */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <button
                      onClick={() => handleConfirmTransfer(trf)}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 14,
                        padding: '16px 14px',
                        fontSize: 16,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 6px 16px rgba(22, 163, 74, 0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      <CheckCircle2 size={22} />
                      ✅ ተቀብያለሁ ({qty})
                    </button>

                    <button
                      onClick={() => setRejectTransferTarget(trf)}
                      style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '2px solid #fecdd3',
                        borderRadius: 14,
                        padding: '16px 10px',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      ❌ ተሰብሯል
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WAITER CAKE ORDERS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {pendingOrders.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                background: 'var(--bg-card)',
                borderRadius: 20,
                padding: 40,
                textAlign: 'center',
                border: '2px dashed var(--border)'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>የአስተናጋጅ ትዕዛዝ የለም</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                ምንም የሚጠበቅ የአስተናጋጅ ኬክ ትዕዛዝ የለም (No pending orders from tables).
              </p>
            </div>
          ) : (
            pendingOrders.map(order => {
              const photo = getCakePhoto({ product_name: order.item_name });
              const isReady = order.status === 'READY';

              return (
                <div
                  key={order.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    border: isReady ? '3px solid #22c55e' : '3px solid #f59e0b',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <img
                      src={photo}
                      alt={order.item_name}
                      style={{
                        width: 75,
                        height: 75,
                        borderRadius: 14,
                        objectFit: 'cover',
                        border: '2px solid var(--border)',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#d97706' }}>
                          ጠረጴዛ: {order.table_number || 'መውሰጃ (Takeaway)'}
                        </span>
                        <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 8, fontWeight: 900 }}>
                          #{order.order_number}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 17, fontWeight: 900, margin: '2px 0 0', color: 'var(--text-main)' }}>
                        {order.item_name}
                      </h3>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                        {order.variation_name} • አስተናጋጅ: <strong>{order.waiter_name}</strong>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#be185d', marginTop: 2 }}>
                        ብዛት: <span style={{ fontSize: 22 }}>{order.quantity}</span> ኬክ
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {!isReady ? (
                      <button
                        onClick={() => handleMarkCakeReady(order.id)}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 14,
                          padding: '14px',
                          fontSize: 16,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: '0 6px 16px rgba(22, 163, 74, 0.3)',
                          cursor: 'pointer'
                        }}
                      >
                        <CheckCircle2 size={22} />
                        ✅ ኬኩ ዝግጁ ነው (READY FOR WAITER)
                      </button>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '12px 16px',
                          borderRadius: 14,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: '1.5px solid #86efac'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 14 }}>
                          <CheckCircle2 size={18} color="#16a34a" />
                          ✓ ለአስተናጋጅ ተልኳል (Ready for pickup)
                        </span>
                        <button
                          onClick={() => handleMarkCakeReady(order.id)}
                          style={{
                            background: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 10,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          እንደገና አሳውቅ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HISTORY TAB (COUNTER SALES & RECEIVED DELIVERIES) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
            <button
              onClick={() => {
                tactileFeedback('click');
                setHistorySubTab('sales');
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: 'none',
                background: historySubTab === 'sales' ? '#be185d' : 'var(--bg-app)',
                color: historySubTab === 'sales' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🧾 የተሸጡ ደረሰኞች ({historyData.sales.length})
            </button>
            <button
              onClick={() => {
                tactileFeedback('click');
                setHistorySubTab('transfers');
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: 'none',
                background: historySubTab === 'transfers' ? '#0284c7' : 'var(--bg-app)',
                color: historySubTab === 'transfers' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🚚 የተቀበልናቸው ርክክቦች ({historyData.transfersReceived.length})
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              ታሪክ እየተጫነ ነው... (Loading history...)
            </div>
          ) : (
            <div>
              {/* SUBTAB 1: PAST SALES */}
              {historySubTab === 'sales' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                  {historyData.sales.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      ምንም የሽያጭ ታሪክ የለም (No sales history yet)
                    </div>
                  ) : (
                    historyData.sales.map(s => (
                      <div
                        key={s.id}
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: 16,
                          border: '1px solid var(--border)',
                          padding: 16,
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#be185d' }}>
                            #{s.order_number}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: 8,
                              background: '#fdf2f8',
                              color: '#be185d'
                            }}
                          >
                            {s.payment_method || 'CASH'}
                          </span>
                        </div>

                        {/* Items Breakdown */}
                        <div style={{ background: 'var(--bg-app)', borderRadius: 12, padding: 10 }}>
                          {(s.items || []).map((it: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '4px 0' }}>
                              <span>
                                {it.quantity}x {it.item_name_amharic || it.item_name} {it.size && `(${it.size})`}
                              </span>
                              <strong style={{ color: 'var(--text-main)' }}>
                                {Number(it.unit_price || 0) * it.quantity} ብር
                              </strong>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            🕒 {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {s.staff_name || 'Counter'}
                          </div>
                          <strong style={{ fontSize: 17, color: '#16a34a' }}>
                            {Number(s.total_amount || 0).toLocaleString()} ብር
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUBTAB 2: RECEIVED TRANSFERS */}
              {historySubTab === 'transfers' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {historyData.transfersReceived.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      ምንም የተቀበልነው ርክክብ የለም (No received transfers yet)
                    </div>
                  ) : (
                    historyData.transfersReceived.map(t => (
                      <div
                        key={t.id}
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: 16,
                          border: '1px solid var(--border)',
                          padding: 16,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 14,
                            background: '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            flexShrink: 0
                          }}
                        >
                          ✅
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
                            {t.product_name_amharic || t.product_name}
                          </strong>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                            {t.variation_name} {t.size && `(${t.size})`} • <strong style={{ color: '#16a34a' }}>{t.quantity_sent || t.quantity} ኬክ ተረክቧል</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            🕒 {new Date(t.received_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ተቀባይ: {t.received_by_name || 'Staff'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING ACTION CART BAR */}
      {/* ========================================================================= */}
      {cart.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            maxWidth: 960,
            margin: '0 auto',
            background: 'var(--bg-card)',
            borderRadius: 24,
            padding: '14px 20px',
            border: '3px solid #db2777',
            boxShadow: '0 12px 36px rgba(219, 39, 119, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 40
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Visual Mini Photos */}
            <div style={{ display: 'flex', gap: -6, overflow: 'hidden' }}>
              {cart.slice(0, 3).map((item, idx) => (
                <img
                  key={idx}
                  src={getCakePhoto(item.variation)}
                  alt=""
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    objectFit: 'cover',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                />
              ))}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-main)' }}>
                {cartItemCount} ኬክ ተመርጧል ({cart.length} አይነቶች)
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>
                {cartTotal.toLocaleString()} ብር
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCart([])}
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              አጽዳ
            </button>

            <button
              onClick={() => setShowCheckoutModal(true)}
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 6px 16px rgba(22, 163, 74, 0.3)',
                cursor: 'pointer'
              }}
            >
              <DollarSign size={20} />
              💵 ሽጥ (SELL)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: 1-TAP CHECKOUT */}
      {/* ========================================================================= */}
      {showCheckoutModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 480, borderRadius: 24, padding: 26, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                💵 የክፍያ መንገድ ምረጥ
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Total Big Text */}
            <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: 18, padding: '18px', textAlign: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#166534', display: 'block' }}>ጠቅላላ ክፍያ (Total)</span>
              <strong style={{ fontSize: 36, fontWeight: 900, color: '#15803d' }}>
                {cartTotal.toLocaleString()} ብር (ETB)
              </strong>
            </div>

            {/* Giant Payment Mode Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
              {[
                { id: 'CASH', label: 'ጥሬ ገንዘብ', sub: 'Cash', icon: '💵', color: '#16a34a' },
                { id: 'TELEBIRR', label: 'ቴሌብር', sub: 'Telebirr', icon: '📱', color: '#0284c7' },
                { id: 'CARD', label: 'ካርድ', sub: 'Card', icon: '💳', color: '#7c3aed' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    tactileFeedback('click');
                    setPaymentMethod(m.id as any);
                  }}
                  style={{
                    padding: '18px 8px',
                    borderRadius: 18,
                    border: paymentMethod === m.id ? `3px solid ${m.color}` : '2px solid var(--border)',
                    background: paymentMethod === m.id ? '#fdf2f8' : 'var(--bg-app)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: 32 }}>{m.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-main)' }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.sub}</span>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowCheckoutModal(false)}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  background: 'var(--bg-app)',
                  border: '2px solid var(--border)',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ተመለስ
              </button>

              <button
                disabled={isProcessingSale}
                onClick={handleCompleteSale}
                style={{
                  flex: 2,
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(22, 163, 74, 0.35)'
                }}
              >
                <CheckCircle2 size={22} />
                {isProcessingSale ? 'እየተመዘገበ ነው...' : '✅ ሽያጩን ጨርስ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 1-TAP REORDER REQUEST TO BAKERY */}
      {/* ========================================================================= */}
      {requestTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 24, padding: 26, textAlign: 'center', boxShadow: 'var(--shadow-floating)' }}>
            <img
              src={getCakePhoto(requestTarget)}
              alt=""
              style={{ width: 120, height: 120, borderRadius: 22, objectFit: 'cover', margin: '0 auto 14px', border: '3px solid #fbcfe8', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
            />
            <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
              {requestTarget.product_name_amharic || requestTarget.product_name}
            </h3>
            <div style={{ fontSize: 14, color: '#be185d', fontWeight: 800, marginTop: 4 }}>
              መጠን: {requestTarget.size || requestTarget.variation_name}
            </div>
            <p style={{ margin: '6px 0 20px', fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>
              ከዳቦ ቤት ተጨማሪ ኬክ ጠይቅ (Request from Bakery)
            </p>

            {/* Giant Stepper for Low Literacy Staff */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
              <button
                onClick={() => {
                  tactileFeedback('click');
                  setRequestQty(Math.max(1, requestQty - 1));
                }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  border: '2px solid var(--border)',
                  background: 'var(--bg-app)',
                  fontSize: 32,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                -
              </button>

              <span style={{ fontSize: 44, fontWeight: 900, color: '#be185d', minWidth: 80, textAlign: 'center' }}>
                {requestQty}
              </span>

              <button
                onClick={() => {
                  tactileFeedback('click');
                  setRequestQty(requestQty + 1);
                }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  border: '2px solid var(--border)',
                  background: 'var(--bg-app)',
                  fontSize: 32,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                +
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setRequestTarget(null)}
                style={{ flex: 1, padding: 16, borderRadius: 16, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                ተመለስ
              </button>

              <button
                disabled={isSendingRequest}
                onClick={handleSendBakeRequest}
                style={{
                  flex: 2,
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 18px rgba(190, 24, 93, 0.35)'
                }}
              >
                {isSendingRequest ? 'እየላከ ነው...' : `🔔 ${requestQty} ኬክ እዘዝ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REJECT TRANSFER REASON PICKER */}
      {/* ========================================================================= */}
      {rejectTransferTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 400, borderRadius: 24, padding: 22, boxShadow: 'var(--shadow-floating)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 14px', color: '#991b1b' }}>
              ❌ ኬኩን ያልተቀበሉበት ምክንያት
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {[
                '💔 ተሰብሯል / Damaged Frosting',
                '⏳ ጊዜው አልፏል / Expired',
                '🔄 የተሳሳተ አይነት / Wrong Cake Sent',
                '📦 አልደረሰም / Missing Physical Cakes'
              ].map(reason => (
                <button
                  key={reason}
                  onClick={() => setRejectReason(reason)}
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    border: rejectReason === reason ? '3px solid #ef4444' : '2px solid var(--border)',
                    background: rejectReason === reason ? '#fef2f2' : 'var(--bg-app)',
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setRejectTransferTarget(null)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                ሰርዝ
              </button>
              <button
                onClick={handleRejectTransfer}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
              >
                አረጋግጥ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD NEW CAKE MENU ITEM */}
      {/* ========================================================================= */}
      {showAddCakeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 540, borderRadius: 24, padding: 26, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                🎂 አዲስ ኬክ መመዝገቢያ (New Cake)
              </h3>
              <button
                onClick={() => setShowAddCakeModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  የኬክ ስም በአማርኛ (Amharic Name) *
                </label>
                <input
                  type="text"
                  placeholder="ለምሳሌ፡ የካሮት ኬክ"
                  value={newCakeAmharic}
                  onChange={(e) => setNewCakeAmharic(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  የኬክ ስም በእንግሊዝኛ (English Name) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Carrot Cake"
                  value={newCakeName}
                  onChange={(e) => setNewCakeName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

              {/* Photo presets */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  ፎቶ ይምረጡ (Select Photo Preset)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {PRESET_CAKE_PHOTOS.map(p => (
                    <div
                      key={p.url}
                      onClick={() => setNewCakePhoto(p.url)}
                      style={{
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: newCakePhoto === p.url ? '3px solid #db2777' : '2px solid var(--border)',
                        cursor: 'pointer',
                        position: 'relative',
                        height: 70
                      }}
                    >
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', bottom: 0, insetInline: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, padding: '2px 4px', textAlign: 'center', fontWeight: 800 }}>
                        {p.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Variations list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>
                    መጠኖችና ዋጋዎች (Sizes & Prices)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCakeVariations([
                        ...newCakeVariations,
                        { variation_name: `Size ${newCakeVariations.length + 1}`, size: 'Extra Size', price: 200, min_stock_level: 2 }
                      ]);
                    }}
                    style={{ background: 'none', border: 'none', color: '#db2777', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
                  >
                    + ሌላ መጠን ጨምር
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newCakeVariations.map((v, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-app)', padding: 10, borderRadius: 12 }}>
                      <input
                        type="text"
                        placeholder="መጠን (e.g. ቁራጭ)"
                        value={v.size}
                        onChange={(e) => {
                          const updated = [...newCakeVariations];
                          updated[idx].size = e.target.value;
                          updated[idx].variation_name = e.target.value;
                          setNewCakeVariations(updated);
                        }}
                        style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}
                      />
                      <input
                        type="number"
                        placeholder="ዋጋ (ETB)"
                        value={v.price}
                        onChange={(e) => {
                          const updated = [...newCakeVariations];
                          updated[idx].price = Number(e.target.value);
                          setNewCakeVariations(updated);
                        }}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}
                      />
                      {newCakeVariations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewCakeVariations(newCakeVariations.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddCakeModal(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
                >
                  ተመለስ
                </button>
                <button
                  type="button"
                  disabled={isCreatingCake}
                  onClick={handleCreateCake}
                  style={{
                    flex: 2,
                    padding: 14,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(219, 39, 119, 0.3)'
                  }}
                >
                  {isCreatingCake ? 'እየመዘገበ ነው...' : '✅ ኬኩን መዝግብ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE CONFIRMATION (ADMIN & OWNER ONLY) */}
      {/* ========================================================================= */}
      {cakeToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 420, borderRadius: 24, padding: 26, textAlign: 'center', boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>
              <AlertTriangle size={36} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px', color: 'var(--text-main)' }}>
              ኬክ መሰረዝ ይፈልጋሉ?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)' }}>
              እርግጠኛ ነዎት <strong>"{cakeToDelete.name_amharic || cakeToDelete.name}"</strong> ይሰረዝ? ከምናሌው እና ከካውንተር ይወገዳል::
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setCakeToDelete(null)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                ይቅር
              </button>
              <button
                type="button"
                disabled={isDeletingCake}
                onClick={handleDeleteCake}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isDeletingCake ? 'እየሰረዘ ነው...' : 'አዎ ሰርዝ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
