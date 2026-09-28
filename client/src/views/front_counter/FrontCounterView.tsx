import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  ShoppingBag,
  ArrowDownLeft,
  PlusCircle,
  AlertTriangle,
  ClipboardCheck,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  DollarSign,
  UtensilsCrossed,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  Check,
  X,
  CreditCard,
  Receipt,
  Eye,
  AlertCircle
} from 'lucide-react';
import { tactileFeedback } from '../../utils/feedback';
import { gToast } from '../../utils/toast';

interface Variation {
  id: string;
  product_id: string;
  name: string;
  size?: string;
  weight?: string;
  flavor?: string;
  bakery_stock: number;
  in_transit_stock: number;
  counter_stock: number;
  min_stock_level: number;
  selling_price: number;
  cost_price: number;
  sku?: string;
  product_name?: string;
  product_category?: string;
  image_url?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  description?: string;
  image_url?: string;
  variations: Variation[];
}

interface Transfer {
  id: string;
  variation_id: string;
  batch_id?: string;
  quantity: number;
  status: 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  created_at: string;
  sent_at?: string;
  received_at?: string;
  product_name: string;
  variation_name: string;
  size?: string;
  sender_name?: string;
  receiver_name?: string;
}

interface BakeRequest {
  id: string;
  product_id: string;
  variation_id: string;
  requested_quantity: number;
  urgency: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PRODUCTION' | 'PARTIALLY_FULFILLED' | 'READY' | 'TRANSFERRED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  created_at: string;
  product_name: string;
  variation_name: string;
  size?: string;
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
  weight?: string;
}

export const FrontCounterView: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'pos' | 'transfers' | 'orders' | 'requests' | 'stocktake' | 'waste'
  >('inventory');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [requests, setRequests] = useState<BakeRequest[]>([]);
  const [cakeOrders, setCakeOrders] = useState<CakeOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // Modal states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedVariationForRequest, setSelectedVariationForRequest] = useState<Variation | null>(null);
  const [requestQty, setRequestQty] = useState(5);
  const [requestUrgency, setRequestUrgency] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [requestNotes, setRequestNotes] = useState('');

  // Transfer Receipt Modal
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // POS / Direct Walk-In Sale State
  const [cart, setCart] = useState<{ variation: Variation; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TELEBIRR' | 'CBE_BIRR' | 'CARD'>('CASH');
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Stock Take State
  const [physicalCounts, setPhysicalCounts] = useState<{ [variationId: string]: { count: number; reason: string } }>({});
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

  // Waste / Damage State
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteVariationId, setWasteVariationId] = useState('');
  const [wasteQty, setWasteQty] = useState(1);
  const [wasteReason, setWasteReason] = useState<'DAMAGED' | 'EXPIRED' | 'SPOILED' | 'COMPLIMENTARY' | 'STAFF' | 'OTHER'>('DAMAGED');
  const [wasteNotes, setWasteNotes] = useState('');

  // Return State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnVariationId, setReturnVariationId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnCondition, setReturnCondition] = useState<'SELLABLE' | 'DAMAGED' | 'EXPIRED'>('SELLABLE');
  const [returnToInventory, setReturnToInventory] = useState(true);

  // Load all initial data via robust api client
  const loadData = useCallback(async () => {
    try {
      const [prodData, transData, reqData, cakeData] = await Promise.all([
        api.request<any>('/bakery/products').catch(() => ({ data: [] })),
        api.request<any>('/bakery/transfers').catch(() => ({ data: [] })),
        api.request<any>('/bakery/requests').catch(() => ({ data: [] })),
        api.request<any>('/bakery/cake-queue').catch(() => ({ data: [] }))
      ]);

      setProducts(Array.isArray(prodData) ? prodData : prodData?.data || []);
      setTransfers(Array.isArray(transData) ? transData : transData?.data || []);
      setRequests(Array.isArray(reqData) ? reqData : reqData?.data || []);
      setCakeOrders(Array.isArray(cakeData) ? cakeData : cakeData?.data || []);
    } catch (err) {
      console.error('Failed to load front counter data', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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
        event?.type === 'ORDER_CONFIRMED' ||
        event?.type === 'BAKERY_STOCK_UPDATED'
      ) {
        loadData();
      }
    });

    const interval = setInterval(loadData, 12000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadData]);

  // All flat variations for easy listing
  const allVariations: Variation[] = products.flatMap(p =>
    (p.variations || []).map(v => ({
      ...v,
      product_name: p.name,
      product_category: p.category,
      image_url: p.image_url
    }))
  );

  // Filtered variations for inventory
  const filteredVariations = allVariations.filter(v => {
    const matchesSearch =
      v.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.size && v.size.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'LOW') {
      return v.counter_stock > 0 && v.counter_stock <= v.min_stock_level;
    }
    if (filterStatus === 'OUT') {
      return v.counter_stock <= 0;
    }
    return true;
  });

  // Handle Receive Transfer
  const handleConfirmTransfer = async () => {
    if (!selectedTransfer) return;
    tactileFeedback('click');
    try {
      await api.request(`/bakery/transfers/${selectedTransfer.id}/confirm`, {
        method: 'PATCH',
        body: JSON.stringify({
          received_quantity: receivedQty,
          notes: receiveNotes
        })
      });

      tactileFeedback('success');
      gToast.success(`Confirmed receipt of ${receivedQty} units into Front Counter stock!`);
      setShowReceiveModal(false);
      setSelectedTransfer(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to confirm receipt');
    }
  };

  // Handle Reject Transfer
  const handleRejectTransfer = async () => {
    if (!selectedTransfer) return;
    tactileFeedback('click');
    try {
      await api.request(`/bakery/transfers/${selectedTransfer.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: rejectNotes })
      });

      tactileFeedback('success');
      gToast.success('Transfer rejected. Product returned to bakery reserve.');
      setShowRejectModal(false);
      setSelectedTransfer(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to reject transfer');
    }
  };

  // Handle Bake Request Submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariationForRequest) return;
    tactileFeedback('click');
    try {
      await api.request('/bakery/requests', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedVariationForRequest.product_id,
          variation_id: selectedVariationForRequest.id,
          requested_quantity: requestQty,
          urgency: requestUrgency,
          notes: requestNotes
        })
      });

      tactileFeedback('success');
      gToast.success('Reorder request submitted to Bakery Production Queue!');
      setShowRequestModal(false);
      setSelectedVariationForRequest(null);
      setRequestNotes('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to submit request');
    }
  };

  // POS Cart management
  const addToCart = (variation: Variation) => {
    tactileFeedback('click');
    if (variation.counter_stock <= 0) {
      gToast.error('Item is OUT OF STOCK. Cannot sell!');
      return;
    }
    const existing = cart.find(c => c.variation.id === variation.id);
    if (existing) {
      if (existing.quantity >= variation.counter_stock) {
        gToast.error(`Cannot add more than available counter stock (${variation.counter_stock})`);
        return;
      }
      setCart(cart.map(c => (c.variation.id === variation.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { variation, quantity: 1 }]);
    }
  };

  const removeFromCart = (variationId: string) => {
    tactileFeedback('click');
    setCart(cart.filter(c => c.variation.id !== variationId));
  };

  const updateCartQty = (variationId: string, qty: number) => {
    tactileFeedback('click');
    if (qty <= 0) {
      removeFromCart(variationId);
      return;
    }
    const item = cart.find(c => c.variation.id === variationId);
    if (item && qty > item.variation.counter_stock) {
      gToast.error(`Cannot exceed counter stock of ${item.variation.counter_stock}`);
      return;
    }
    setCart(cart.map(c => (c.variation.id === variationId ? { ...c, quantity: qty } : c)));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.quantity * item.variation.selling_price, 0);

  // Submit Direct Counter Sale
  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    tactileFeedback('click');
    setIsProcessingSale(true);
    try {
      const res: any = await api.request('/bakery/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: customerName || 'Walk-in Customer',
          payment_method: paymentMethod,
          notes: saleNotes,
          items: cart.map(c => ({
            variation_id: c.variation.id,
            quantity: c.quantity,
            unit_price: c.variation.selling_price
          }))
        })
      });

      tactileFeedback('success');
      gToast.success('Cake sale completed! Stock deducted.');
      setLastSaleReceipt({
        ...res?.data,
        items: [...cart],
        total: cartTotal,
        paymentMethod,
        date: new Date().toLocaleString()
      });
      setShowReceiptModal(true);
      setCart([]);
      setCustomerName('');
      setSaleNotes('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Direct sale failed');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Stock Take Audit Submission
  const handleStockCountSubmit = async () => {
    const entries = Object.entries(physicalCounts);
    if (entries.length === 0) {
      gToast.error('No counts recorded to submit.');
      return;
    }

    const countsToSubmit = entries.map(([variation_id, data]) => ({
      variation_id,
      physical_quantity: data.count,
      reason: data.reason || 'Routine physical stock audit'
    }));

    tactileFeedback('click');
    setIsSubmittingAudit(true);
    try {
      await api.request('/bakery/stock-count', {
        method: 'POST',
        body: JSON.stringify({ counts: countsToSubmit })
      });

      tactileFeedback('success');
      gToast.success('Physical stock counts submitted and inventory adjusted!');
      setPhysicalCounts({});
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Stock count update failed');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Waste Recording Submission
  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteVariationId) return;
    tactileFeedback('click');
    try {
      await api.request('/bakery/waste', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: wasteVariationId,
          quantity: wasteQty,
          reason: wasteReason,
          notes: wasteNotes,
          location: 'FRONT_COUNTER'
        })
      });

      tactileFeedback('success');
      gToast.success('Waste recorded and stock deducted from front counter.');
      setShowWasteModal(false);
      setWasteVariationId('');
      setWasteQty(1);
      setWasteNotes('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to record waste');
    }
  };

  // Returns Recording Submission
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnVariationId) return;
    tactileFeedback('click');
    try {
      await api.request('/bakery/returns', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: returnVariationId,
          quantity: returnQty,
          reason: returnReason,
          condition: returnCondition,
          return_to_inventory: returnToInventory
        })
      });

      tactileFeedback('success');
      gToast.success('Customer return processed.');
      setShowReturnModal(false);
      setReturnVariationId('');
      setReturnQty(1);
      setReturnReason('');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to process return');
    }
  };

  // Update Waiter Order Status
  const updateCakeOrderStatus = async (itemId: string, status: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/bakery/cake-queue/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      tactileFeedback('success');
      gToast.success(`Cake order marked as ${status}!`);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update order status');
    }
  };

  // Counts
  const totalCounterUnits = allVariations.reduce((sum, v) => sum + (v.counter_stock || 0), 0);
  const pendingTransfersCount = transfers.filter(t => t.status === 'PENDING' || t.status === 'IN_TRANSIT').length;
  const pendingOrdersCount = cakeOrders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length;
  const lowStockCount = allVariations.filter(v => v.counter_stock > 0 && v.counter_stock <= v.min_stock_level).length;
  const outOfStockCount = allVariations.filter(v => v.counter_stock <= 0).length;

  return (
    <div className="view-content" style={{ paddingBottom: 90 }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #831843 0%, #be185d 50%, #db2777 100%)',
          color: '#ffffff',
          padding: '24px 20px',
          borderRadius: 20,
          marginBottom: 20,
          boxShadow: '0 10px 25px -5px rgba(190, 24, 93, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26
            }}
          >
            🧁
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                Front Cake Sales Counter
              </h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.25)',
                  textTransform: 'uppercase'
                }}
              >
                Live Operations
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
              Staff: <strong style={{ color: '#fdf2f8' }}>{user?.username}</strong> • Counter Showcase & Direct Sales
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => {
              tactileFeedback('click');
              setIsRefreshing(true);
              loadData();
            }}
            disabled={isRefreshing}
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={() => {
              tactileFeedback('click');
              setActiveTab('pos');
            }}
            className="btn"
            style={{
              background: '#ffffff',
              color: '#9d174d',
              border: 'none',
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer'
            }}
          >
            <ShoppingBag size={16} /> Open Counter POS
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginBottom: 20
        }}
      >
        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Counter Stock</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#be185d', marginTop: 4 }}>
            {totalCounterUnits} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Stock</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: lowStockCount > 0 ? '#eab308' : '#10b981', marginTop: 4 }}>
            {lowStockCount} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>items</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Out of Stock</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: outOfStockCount > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
            {outOfStockCount} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>items</span>
          </div>
        </div>

        <div
          onClick={() => {
            if (pendingTransfersCount > 0) setActiveTab('transfers');
          }}
          style={{
            background: pendingTransfersCount > 0 ? 'var(--primary-light)' : 'var(--bg-card)',
            padding: '14px 16px',
            borderRadius: 16,
            border: pendingTransfersCount > 0 ? '2px solid #db2777' : '1px solid var(--border)',
            cursor: pendingTransfersCount > 0 ? 'pointer' : 'default'
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: pendingTransfersCount > 0 ? '#be185d' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            Inbound Transfers
          </span>
          <div style={{ fontSize: 22, fontWeight: 900, color: pendingTransfersCount > 0 ? '#db2777' : '#64748b', marginTop: 4 }}>
            {pendingTransfersCount} <span style={{ fontSize: 12, fontWeight: 600 }}>pending</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 18,
          scrollbarWidth: 'none'
        }}
      >
        {[
          { id: 'inventory', label: 'Live Inventory', icon: Layers, badge: null },
          { id: 'pos', label: 'Counter POS', icon: ShoppingBag, badge: cart.length > 0 ? cart.length : null },
          { id: 'transfers', label: 'Inbound Transfers', icon: ArrowDownLeft, badge: pendingTransfersCount || null },
          { id: 'orders', label: 'Waiter Orders', icon: UtensilsCrossed, badge: pendingOrdersCount || null },
          { id: 'requests', label: 'Bake Requests', icon: Clock, badge: null },
          { id: 'stocktake', label: 'Physical Audit', icon: ClipboardCheck, badge: null },
          { id: 'waste', label: 'Loss & Returns', icon: Trash2, badge: null }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                tactileFeedback('click');
                setActiveTab(tab.id as any);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 14,
                fontSize: 13,
                fontWeight: 800,
                border: isActive ? 'none' : '1px solid var(--border)',
                background: isActive ? 'linear-gradient(135deg, #be185d 0%, #db2777 100%)' : 'var(--bg-card)',
                color: isActive ? '#ffffff' : 'var(--text-main)',
                boxShadow: isActive ? '0 4px 12px rgba(190, 24, 93, 0.25)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isActive ? '#ffffff' : '#be185d',
                    color: isActive ? '#be185d' : '#ffffff'
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE INVENTORY */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div>
          {/* Search & Filter Toolbar */}
          <div
            style={{
              background: 'var(--bg-card)',
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Search cake name, size, SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Filter size={15} style={{ color: 'var(--text-muted)' }} />
              {[
                { id: 'ALL', label: `All (${allVariations.length})` },
                { id: 'LOW', label: `Low Stock (${lowStockCount})`, color: '#eab308' },
                { id: 'OUT', label: `Out of Stock (${outOfStockCount})`, color: '#ef4444' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    tactileFeedback('click');
                    setFilterStatus(f.id as any);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    border: filterStatus === f.id ? '2px solid #be185d' : '1px solid var(--border)',
                    background: filterStatus === f.id ? 'var(--primary-light)' : 'var(--bg-card)',
                    color: filterStatus === f.id ? '#be185d' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cake Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}
          >
            {filteredVariations.map(variation => {
              const isOutOfStock = variation.counter_stock <= 0;
              const isLowStock = !isOutOfStock && variation.counter_stock <= variation.min_stock_level;

              return (
                <div
                  key={variation.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 18,
                    border: isOutOfStock
                      ? '2px solid #fecdd3'
                      : isLowStock
                      ? '2px solid #fef08a'
                      : '1px solid var(--border)',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {variation.product_category || 'Cake & Pastry'}
                        </span>
                        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-main)' }}>
                          {variation.product_name}
                        </h3>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--bg-app)', padding: '2px 8px', borderRadius: 6 }}>
                            {variation.name}
                          </span>
                          {variation.size && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{variation.size}</span>
                          )}
                          {variation.weight && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({variation.weight})</span>
                          )}
                        </div>
                      </div>

                      {/* Stock Badge */}
                      <div>
                        {isOutOfStock ? (
                          <span style={{ fontSize: 11, fontWeight: 900, background: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={12} /> OUT
                          </span>
                        ) : isLowStock ? (
                          <span style={{ fontSize: 11, fontWeight: 900, background: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> LOW
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 900, background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Check size={12} /> IN STOCK
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stock Counts Metric Box */}
                    <div
                      style={{
                        background: 'var(--bg-app)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 6,
                        textAlign: 'center',
                        margin: '12px 0'
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Counter Stock</span>
                        <strong style={{ fontSize: 16, color: isOutOfStock ? '#ef4444' : isLowStock ? '#eab308' : '#10b981' }}>
                          {variation.counter_stock}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>In Transit</span>
                        <strong style={{ fontSize: 16, color: '#0284c7' }}>
                          {variation.in_transit_stock || 0}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Target Min</span>
                        <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>
                          {variation.min_stock_level}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      <span>Bakery Reserve: <strong style={{ color: 'var(--text-main)' }}>{variation.bakery_stock}</strong></span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                        {variation.selling_price.toLocaleString()} ETB
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => {
                        tactileFeedback('click');
                        setSelectedVariationForRequest(variation);
                        setRequestQty(Math.max(variation.min_stock_level * 2 - variation.counter_stock, 5));
                        setShowRequestModal(true);
                      }}
                      className="btn"
                      style={{
                        background: 'var(--bg-app)',
                        color: '#be185d',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer'
                      }}
                    >
                      <PlusCircle size={14} /> Request More
                    </button>

                    <button
                      onClick={() => {
                        addToCart(variation);
                        setActiveTab('pos');
                      }}
                      disabled={isOutOfStock}
                      className="btn"
                      style={{
                        background: isOutOfStock ? 'var(--bg-app)' : 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                        color: isOutOfStock ? 'var(--text-muted)' : '#ffffff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 10px',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <ShoppingBag size={14} /> Sell Cake
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COUNTER POS / DIRECT WALK-IN SALES */}
      {/* ========================================================================= */}
      {activeTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Left: Product Selector */}
          <div style={{ flex: '1 1 500px' }}>
            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 18, border: '1px solid var(--border)', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Counter Showcase Selection
              </h3>
              <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                Tap available cakes to add to cart for direct walk-in sale
              </p>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Quick filter cakes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-app)',
                    fontSize: 13
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
              {filteredVariations.map(variation => {
                const isOutOfStock = variation.counter_stock <= 0;
                return (
                  <div
                    key={variation.id}
                    onClick={() => !isOutOfStock && addToCart(variation)}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 14,
                      border: isOutOfStock ? '1px dashed var(--border)' : '1px solid var(--border)',
                      padding: 12,
                      opacity: isOutOfStock ? 0.6 : 1,
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.1s ease',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#be185d' }}>{variation.product_category}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{variation.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{variation.name} {variation.size && `• ${variation.size}`}</div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#10b981' }}>{variation.selling_price} ETB</span>
                      <span style={{ fontSize: 11, fontWeight: 800, background: isOutOfStock ? '#fee2e2' : 'var(--bg-app)', color: isOutOfStock ? '#ef4444' : 'var(--text-main)', padding: '2px 6px', borderRadius: 6 }}>
                        {isOutOfStock ? 'OUT' : `${variation.counter_stock} left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Cart & Tender */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 18,
              border: '1px solid var(--border)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 520,
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={18} style={{ color: '#be185d' }} />
                  Current Counter Order ({cart.length})
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Items List */}
              <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                    Cart is empty. Tap any cake on the showcase to add.
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.variation.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: 'var(--bg-app)',
                        borderRadius: 10,
                        marginBottom: 8,
                        fontSize: 12
                      }}
                    >
                      <div style={{ maxWidth: 140 }}>
                        <strong style={{ display: 'block', color: 'var(--text-main)', fontSize: 13 }}>{item.variation.product_name}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>{item.variation.name} ({item.variation.selling_price} ETB)</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => updateCartQty(item.variation.id, item.quantity - 1)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 800, cursor: 'pointer' }}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: 900, width: 20, textAlign: 'center' }}>{item.quantity}</span>
                        <button
                          onClick={() => updateCartQty(item.variation.id, item.quantity + 1)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 800, cursor: 'pointer' }}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ fontWeight: 900, color: '#10b981' }}>
                        {(item.quantity * item.variation.selling_price).toLocaleString()} ETB
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer and Payment Methods */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Walk-in Guest"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-app)',
                    fontSize: 13,
                    marginBottom: 12
                  }}
                />

                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['CASH', 'TELEBIRR', 'CBE_BIRR', 'CARD'] as const).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => {
                        tactileFeedback('click');
                        setPaymentMethod(pm);
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        border: paymentMethod === pm ? '2px solid #be185d' : '1px solid var(--border)',
                        background: paymentMethod === pm ? 'var(--primary-light)' : 'var(--bg-app)',
                        color: paymentMethod === pm ? '#be185d' : 'var(--text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Total and Checkout */}
            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Total Amount</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
                  {cartTotal.toLocaleString()} ETB
                </span>
              </div>

              <button
                disabled={cart.length === 0 || isProcessingSale}
                onClick={handleProcessSale}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: cart.length === 0 ? 'var(--border)' : 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                  color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                  border: 'none',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: cart.length === 0 ? 'none' : '0 4px 14px rgba(190, 24, 93, 0.35)'
                }}
              >
                <DollarSign size={18} />
                {isProcessingSale ? 'Completing Sale...' : 'Confirm Sale & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INBOUND TRANSFERS */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Physical Cake Transfers from Bakery
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Inspect physical cake delivery upon arrival. Stock increases only when counter staff explicitly confirms receipt.
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: 'var(--primary-light)', color: '#be185d' }}>
              Pending: {pendingTransfersCount}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Cake / Item</th>
                  <th style={{ padding: '10px 8px' }}>Variation</th>
                  <th style={{ padding: '10px 8px' }}>Sent Qty</th>
                  <th style={{ padding: '10px 8px' }}>Dispatched By</th>
                  <th style={{ padding: '10px 8px' }}>Time</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No transfer history found.
                    </td>
                  </tr>
                ) : (
                  transfers.map(trf => {
                    const isPending = trf.status === 'PENDING' || trf.status === 'IN_TRANSIT';
                    return (
                      <tr key={trf.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          #{trf.id.slice(-6).toUpperCase()}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {trf.product_name}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                          {trf.variation_name} {trf.size && `(${trf.size})`}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 900, color: '#0284c7' }}>
                          {trf.quantity} units
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                          {trf.sender_name || 'Bakery Staff'}
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                          {new Date(trf.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              padding: '3px 8px',
                              borderRadius: 12,
                              background:
                                trf.status === 'RECEIVED'
                                  ? '#dcfce7'
                                  : trf.status === 'REJECTED'
                                  ? '#fee2e2'
                                  : '#fef3c7',
                              color:
                                trf.status === 'RECEIVED'
                                  ? '#166534'
                                  : trf.status === 'REJECTED'
                                  ? '#991b1b'
                                  : '#92400e'
                            }}
                          >
                            {trf.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                onClick={() => {
                                  tactileFeedback('click');
                                  setSelectedTransfer(trf);
                                  setReceivedQty(trf.quantity);
                                  setShowReceiveModal(true);
                                }}
                                style={{
                                  background: '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                Accept Delivery
                              </button>
                              <button
                                onClick={() => {
                                  tactileFeedback('click');
                                  setSelectedTransfer(trf);
                                  setShowRejectModal(true);
                                }}
                                style={{
                                  background: 'var(--bg-app)',
                                  color: '#ef4444',
                                  border: '1px solid var(--border)',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Complete</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RESTAURANT WAITER CAKE ORDERS */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Restaurant Waiter Cake Orders Queue
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Cake orders confirmed by Cashier and routed to Front Counter for preparation and pickup.
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: 'var(--primary-light)', color: '#be185d' }}>
              Active Orders: {cakeOrders.length}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {cakeOrders.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                No active cake orders from restaurant waiters.
              </div>
            ) : (
              cakeOrders.map(order => {
                const isReady = order.status === 'READY';
                return (
                  <div
                    key={order.id}
                    style={{
                      background: isReady ? 'var(--primary-light)' : 'var(--bg-app)',
                      borderRadius: 14,
                      border: isReady ? '2px solid #10b981' : '1px solid var(--border)',
                      padding: 16
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-muted)' }}>
                          Order #{order.order_number}
                        </span>
                        <h4 style={{ fontSize: 16, fontWeight: 900, margin: '2px 0 0', color: 'var(--text-main)' }}>
                          {order.item_name}
                        </h4>
                        <div style={{ fontSize: 12, color: '#be185d', fontWeight: 700 }}>
                          {order.variation_name} {order.size && `• ${order.size}`}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: isReady ? '#dcfce7' : '#fef3c7',
                          color: isReady ? '#166534' : '#92400e'
                        }}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 10, margin: '10px 0', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Table: <strong style={{ color: 'var(--text-main)' }}>{order.table_number || 'Takeaway'}</strong></span>
                      <span>Qty: <strong style={{ color: '#be185d', fontSize: 14 }}>{order.quantity}</strong></span>
                      <span>Waiter: <strong style={{ color: 'var(--text-main)' }}>{order.waiter_name}</strong></span>
                    </div>

                    {!isReady ? (
                      <button
                        onClick={() => updateCakeOrderStatus(order.id, 'READY')}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 10,
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <CheckCircle2 size={16} /> Mark Ready for Waiter Pickup
                      </button>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#166534', fontWeight: 800, padding: 4 }}>
                        <span>✓ Ready for pickup</span>
                        <button
                          onClick={() => updateCakeOrderStatus(order.id, 'DELIVERED')}
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Delivered
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: BAKE REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Production Reorder Requests
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Communicate directly with Bakery kitchen for stock replenishment
              </p>
            </div>

            <button
              onClick={() => {
                tactileFeedback('click');
                setSelectedVariationForRequest(allVariations[0] || null);
                setShowRequestModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Submit New Request
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>ID</th>
                  <th style={{ padding: '10px 8px' }}>Cake</th>
                  <th style={{ padding: '10px 8px' }}>Variation</th>
                  <th style={{ padding: '10px 8px' }}>Requested Qty</th>
                  <th style={{ padding: '10px 8px' }}>Urgency</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No active reorder requests.
                    </td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        #{req.id.slice(-6).toUpperCase()}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {req.product_name}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {req.variation_name} {req.size && `(${req.size})`}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 900, color: '#be185d' }}>
                        {req.requested_quantity} units
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: req.urgency === 'URGENT' ? '#fee2e2' : req.urgency === 'HIGH' ? '#fef3c7' : 'var(--bg-app)',
                            color: req.urgency === 'URGENT' ? '#991b1b' : req.urgency === 'HIGH' ? '#92400e' : 'var(--text-muted)'
                          }}
                        >
                          {req.urgency}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: req.status === 'COMPLETED' ? '#dcfce7' : req.status === 'IN_PRODUCTION' ? '#e0f2fe' : '#fef3c7',
                            color: req.status === 'COMPLETED' ? '#166534' : req.status === 'IN_PRODUCTION' ? '#0369a1' : '#92400e'
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {req.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PHYSICAL STOCK COUNTING & AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'stocktake' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Physical Stocktake & Discrepancy Adjustment
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Count physical cakes remaining on the counter. Any variance with the system requires an auditable reason.
              </p>
            </div>

            <button
              disabled={isSubmittingAudit || Object.keys(physicalCounts).length === 0}
              onClick={handleStockCountSubmit}
              style={{
                background: Object.keys(physicalCounts).length === 0 ? 'var(--border)' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: Object.keys(physicalCounts).length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle2 size={16} />
              {isSubmittingAudit ? 'Submitting...' : 'Commit Counts & Adjust'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Cake / Variation</th>
                  <th style={{ padding: '10px 8px' }}>System Qty</th>
                  <th style={{ padding: '10px 8px' }}>Physical Count</th>
                  <th style={{ padding: '10px 8px' }}>Discrepancy</th>
                  <th style={{ padding: '10px 8px' }}>Adjustment Reason (Mandatory if variance)</th>
                </tr>
              </thead>
              <tbody>
                {allVariations.map(variation => {
                  const entry = physicalCounts[variation.id];
                  const physicalCount = entry !== undefined ? entry.count : variation.counter_stock;
                  const discrepancy = physicalCount - variation.counter_stock;

                  return (
                    <tr key={variation.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{variation.product_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{variation.name} {variation.size && `(${variation.size})`}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 900, fontSize: 15, color: 'var(--text-main)' }}>
                        {variation.counter_stock}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input
                          type="number"
                          min="0"
                          value={physicalCount}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setPhysicalCounts({
                              ...physicalCounts,
                              [variation.id]: {
                                count: val,
                                reason: entry?.reason || ''
                              }
                            });
                          }}
                          style={{
                            width: 70,
                            padding: '6px 8px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-app)'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {discrepancy === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>0 (Exact Match)</span>
                        ) : discrepancy < 0 ? (
                          <span style={{ color: '#991b1b', background: '#fee2e2', padding: '3px 8px', borderRadius: 8, fontWeight: 900 }}>
                            {discrepancy} (Shortage)
                          </span>
                        ) : (
                          <span style={{ color: '#166534', background: '#dcfce7', padding: '3px 8px', borderRadius: 8, fontWeight: 900 }}>
                            +{discrepancy} (Surplus)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {discrepancy !== 0 ? (
                          <input
                            type="text"
                            placeholder="Explain reason for shortage/surplus..."
                            value={entry?.reason || ''}
                            onChange={e => {
                              setPhysicalCounts({
                                ...physicalCounts,
                                [variation.id]: {
                                  count: physicalCount,
                                  reason: e.target.value
                                }
                              });
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid #fecdd3',
                              background: 'var(--bg-app)',
                              fontSize: 12
                            }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: LOSS, DAMAGE & CUSTOMER RETURNS */}
      {/* ========================================================================= */}
      {activeTab === 'waste' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Record Loss or Waste</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Deduct damaged, expired, or spoiled cakes from front counter
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                tactileFeedback('click');
                setShowWasteModal(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} /> Log Cake Waste Entry
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca' }}>
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Customer Return</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Process customer return with inspection of sellability
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                tactileFeedback('click');
                setShowReturnModal(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} /> Process Return Entry
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM TRANSFER RECEIPT */}
      {/* ========================================================================= */}
      {showReceiveModal && selectedTransfer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} /> Confirm Transfer Receipt
              </h3>
              <button onClick={() => setShowReceiveModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 12, marginBottom: 14, fontSize: 13 }}>
              <div>Cake: <strong style={{ color: 'var(--text-main)' }}>{selectedTransfer.product_name}</strong></div>
              <div>Variation: <strong style={{ color: 'var(--text-main)' }}>{selectedTransfer.variation_name}</strong></div>
              <div>Dispatched Qty: <strong style={{ color: '#0284c7' }}>{selectedTransfer.quantity} units</strong></div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                Physically Counted Units:
              </label>
              <input
                type="number"
                min="1"
                max={selectedTransfer.quantity}
                value={receivedQty}
                onChange={e => setReceivedQty(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 16, fontWeight: 800 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                Condition & Delivery Notes:
              </label>
              <textarea
                placeholder="e.g. Arrived in good cold condition"
                value={receiveNotes}
                onChange={e => setReceiveNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowReceiveModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#10b981', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
              >
                Accept into Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJECT TRANSFER */}
      {/* ========================================================================= */}
      {showRejectModal && selectedTransfer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                <XCircle size={20} /> Reject Transfer Delivery
              </h3>
              <button onClick={() => setShowRejectModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Rejecting delivery for <strong>{selectedTransfer.product_name}</strong> ({selectedTransfer.quantity} units). Inventory will be returned to bakery reserve.
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                Mandatory Rejection Reason:
              </label>
              <textarea
                placeholder="e.g. Broken topping during transit, melting frosting"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #fecdd3', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={!rejectNotes.trim()}
                onClick={handleRejectTransfer}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer', opacity: !rejectNotes.trim() ? 0.6 : 1 }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT REORDER REQUEST */}
      {/* ========================================================================= */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#be185d' }}>
                <Clock size={20} /> Production Reorder Request
              </h3>
              <button onClick={() => setShowRequestModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitRequest}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Select Cake & Variation
                </label>
                <select
                  value={selectedVariationForRequest?.id || ''}
                  onChange={e => {
                    const found = allVariations.find(v => v.id === e.target.value);
                    if (found) setSelectedVariationForRequest(found);
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                >
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name} ({v.counter_stock} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Quantity Needed
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={requestQty}
                    onChange={e => setRequestQty(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, fontWeight: 800 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                    Urgency Level
                  </label>
                  <select
                    value={requestUrgency}
                    onChange={e => setRequestUrgency(e.target.value as any)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">URGENT (Stock Out)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  Notes / Instructions for Bakery
                </label>
                <textarea
                  placeholder="e.g. Afternoon rush expected, please expedite"
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LOG WASTE */}
      {/* ========================================================================= */}
      {showWasteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                <Trash2 size={20} /> Log Cake Damage or Loss
              </h3>
              <button onClick={() => setShowWasteModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleWasteSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Select Cake</label>
                <select
                  value={wasteVariationId}
                  onChange={e => setWasteVariationId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                >
                  <option value="">-- Choose Cake --</option>
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name} (Stock: {v.counter_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={wasteQty}
                    onChange={e => setWasteQty(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Reason</label>
                  <select
                    value={wasteReason}
                    onChange={e => setWasteReason(e.target.value as any)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="DAMAGED">Physical Damage</option>
                    <option value="EXPIRED">Expired Shelf-Life</option>
                    <option value="SPOILED">Spoiled / Off-Taste</option>
                    <option value="COMPLIMENTARY">Complimentary / Tasting</option>
                    <option value="STAFF">Staff Consumption</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Detailed Explanation</label>
                <textarea
                  required
                  placeholder="Explain incident cause..."
                  value={wasteNotes}
                  onChange={e => setWasteNotes(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                >
                  Deduct from Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CUSTOMER RETURN */}
      {/* ========================================================================= */}
      {showReturnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#4f46e5' }}>
                <RotateCcw size={20} /> Process Customer Return
              </h3>
              <button onClick={() => setShowReturnModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleReturnSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Select Cake</label>
                <select
                  value={returnVariationId}
                  onChange={e => setReturnVariationId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                >
                  <option value="">-- Choose Cake --</option>
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={returnQty}
                    onChange={e => setReturnQty(parseInt(e.target.value) || 1)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Condition</label>
                  <select
                    value={returnCondition}
                    onChange={e => setReturnCondition(e.target.value as any)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="SELLABLE">Sellable / Untouched</option>
                    <option value="DAMAGED">Damaged / Opened</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg-app)', borderRadius: 10, marginBottom: 14 }}>
                <input
                  type="checkbox"
                  id="returnStockCheck"
                  checked={returnToInventory}
                  onChange={e => setReturnToInventory(e.target.checked)}
                />
                <label htmlFor="returnStockCheck" style={{ fontSize: 12, color: 'var(--text-main)', cursor: 'pointer' }}>
                  Return to sellable counter inventory (Only if untouched & safe)
                </label>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>Return Reason</label>
                <textarea
                  required
                  placeholder="e.g. Customer changed mind, incorrect flavor chosen"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-app)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#4f46e5', color: '#ffffff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                >
                  Process Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SALE RECEIPT */}
      {/* ========================================================================= */}
      {showReceiptModal && lastSaleReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 380, borderRadius: 20, padding: 24, boxShadow: 'var(--shadow-floating)' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🍰</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Yo Bakery & Cafe</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Front Sales Counter Receipt</p>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 4 }}>
                {lastSaleReceipt.date} • Staff: {user?.username}
              </div>
            </div>

            <div style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              {(lastSaleReceipt.items || []).map((it: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>{it.quantity}x {it.variation.product_name} ({it.variation.name})</span>
                  <strong style={{ color: 'var(--text-main)' }}>{(it.quantity * it.variation.selling_price).toLocaleString()} ETB</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Total Paid ({lastSaleReceipt.paymentMethod}):</span>
              <strong style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{lastSaleReceipt.total.toLocaleString()} ETB</strong>
            </div>

            <button
              onClick={() => setShowReceiptModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
