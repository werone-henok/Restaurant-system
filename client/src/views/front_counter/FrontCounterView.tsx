import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShoppingBag,
  ArrowDownLeft,
  PlusCircle,
  AlertTriangle,
  ClipboardCheck,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  DollarSign,
  UtensilsCrossed,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingDown,
  RefreshCw,
  Info
} from 'lucide-react';

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
    'inventory' | 'pos' | 'transfers' | 'requests' | 'orders' | 'stocktake' | 'waste'
  >('inventory');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [requests, setRequests] = useState<BakeRequest[]>([]);
  const [cakeOrders, setCakeOrders] = useState<CakeOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any | null>(null);

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

  // Load all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, transRes, reqRes, cakeRes] = await Promise.all([
        fetch('/api/bakery/products', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/bakery/transfers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/bakery/requests', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/bakery/cake-queue', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.data || []);
      }
      if (transRes.ok) {
        const transData = await transRes.json();
        setTransfers(transData.data || []);
      }
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData.data || []);
      }
      if (cakeRes.ok) {
        const cakeData = await cakeRes.json();
        setCakeOrders(cakeData.data || []);
      }
    } catch (err) {
      console.error('Failed to load front counter data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling update every 10s
    return () => clearInterval(interval);
  }, []);

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
      v.size?.toLowerCase().includes(searchQuery.toLowerCase());

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
    try {
      const res = await fetch(`/api/bakery/transfers/${selectedTransfer.id}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          received_quantity: receivedQty,
          notes: receiveNotes
        })
      });

      if (res.ok) {
        setShowReceiveModal(false);
        setSelectedTransfer(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to confirm receipt');
      }
    } catch (err) {
      alert('Error confirming transfer');
    }
  };

  // Handle Reject Transfer
  const handleRejectTransfer = async () => {
    if (!selectedTransfer) return;
    try {
      const res = await fetch(`/api/bakery/transfers/${selectedTransfer.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: rejectNotes })
      });

      if (res.ok) {
        setShowRejectModal(false);
        setSelectedTransfer(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to reject transfer');
      }
    } catch (err) {
      alert('Error rejecting transfer');
    }
  };

  // Handle Bake Request Submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariationForRequest) return;
    try {
      const res = await fetch('/api/bakery/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          product_id: selectedVariationForRequest.product_id,
          variation_id: selectedVariationForRequest.id,
          requested_quantity: requestQty,
          urgency: requestUrgency,
          notes: requestNotes
        })
      });

      if (res.ok) {
        setShowRequestModal(false);
        setSelectedVariationForRequest(null);
        setRequestNotes('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to submit request');
      }
    } catch (err) {
      alert('Error submitting reorder request');
    }
  };

  // POS Cart management
  const addToCart = (variation: Variation) => {
    if (variation.counter_stock <= 0) {
      alert('Item is OUT OF STOCK. Cannot sell!');
      return;
    }
    const existing = cart.find(c => c.variation.id === variation.id);
    if (existing) {
      if (existing.quantity >= variation.counter_stock) {
        alert(`Cannot add more than available stock (${variation.counter_stock})`);
        return;
      }
      setCart(cart.map(c => (c.variation.id === variation.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { variation, quantity: 1 }]);
    }
  };

  const removeFromCart = (variationId: string) => {
    setCart(cart.filter(c => c.variation.id !== variationId));
  };

  const updateCartQty = (variationId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(variationId);
      return;
    }
    const item = cart.find(c => c.variation.id === variationId);
    if (item && qty > item.variation.counter_stock) {
      alert(`Cannot exceed available stock of ${item.variation.counter_stock}`);
      return;
    }
    setCart(cart.map(c => (c.variation.id === variationId ? { ...c, quantity: qty } : c)));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.quantity * item.variation.selling_price, 0);

  // Submit Direct Counter Sale
  const handleProcessSale = async () => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);
    try {
      const res = await fetch('/api/bakery/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
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

      if (res.ok) {
        const saleData = await res.json();
        setLastSaleReceipt({
          ...saleData.data,
          items: [...cart],
          total: cartTotal,
          paymentMethod,
          date: new Date().toLocaleString()
        });
        setCart([]);
        setCustomerName('');
        setSaleNotes('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Direct sale failed');
      }
    } catch (err) {
      alert('Error processing sale');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Stock Take Audit Submission
  const handleStockCountSubmit = async () => {
    const entries = Object.entries(physicalCounts);
    if (entries.length === 0) {
      alert('No counts recorded to submit.');
      return;
    }

    const countsToSubmit = entries.map(([variation_id, data]) => ({
      variation_id,
      physical_quantity: data.count,
      reason: data.reason || 'Routine physical stock audit'
    }));

    setIsSubmittingAudit(true);
    try {
      const res = await fetch('/api/bakery/stock-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ counts: countsToSubmit })
      });

      if (res.ok) {
        alert('Physical stock counts submitted and adjustments recorded!');
        setPhysicalCounts({});
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Stock count update failed');
      }
    } catch (err) {
      alert('Error updating stock count');
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Waste Recording Submission
  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteVariationId) return;
    try {
      const res = await fetch('/api/bakery/waste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          variation_id: wasteVariationId,
          quantity: wasteQty,
          reason: wasteReason,
          notes: wasteNotes,
          location: 'FRONT_COUNTER'
        })
      });

      if (res.ok) {
        setShowWasteModal(false);
        setWasteVariationId('');
        setWasteQty(1);
        setWasteNotes('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to record waste');
      }
    } catch (err) {
      alert('Error submitting waste');
    }
  };

  // Returns Recording Submission
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnVariationId) return;
    try {
      const res = await fetch('/api/bakery/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          variation_id: returnVariationId,
          quantity: returnQty,
          reason: returnReason,
          condition: returnCondition,
          return_to_inventory: returnToInventory
        })
      });

      if (res.ok) {
        setShowReturnModal(false);
        setReturnVariationId('');
        setReturnQty(1);
        setReturnReason('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to process return');
      }
    } catch (err) {
      alert('Error processing return');
    }
  };

  // Update Waiter Order Status (e.g. READY for waiter to pickup)
  const updateCakeOrderStatus = async (itemId: string, status: string) => {
    try {
      const res = await fetch(`/api/bakery/cake-queue/${itemId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to update order status');
      }
    } catch (err) {
      alert('Error updating order status');
    }
  };

  // Badge counts
  const pendingTransfersCount = transfers.filter(t => t.status === 'PENDING' || t.status === 'IN_TRANSIT').length;
  const pendingOrdersCount = cakeOrders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length;
  const lowStockCount = allVariations.filter(v => v.counter_stock > 0 && v.counter_stock <= v.min_stock_level).length;
  const outOfStockCount = allVariations.filter(v => v.counter_stock <= 0).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-30 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-pink-600 to-rose-500 rounded-xl shadow-lg shadow-pink-500/20 text-white">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Front Cake Sales Counter
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/30">
                  Live Operations
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Staff: <span className="text-slate-200 font-medium">{user?.username}</span> | Department: Front Sales
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-slate-400">Low Stock:</span>
              <span className={`font-bold ${lowStockCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {lowStockCount}
              </span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-slate-400">Out of Stock:</span>
              <span className={`font-bold ${outOfStockCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {outOfStockCount}
              </span>
            </div>
            {pendingTransfersCount > 0 && (
              <button
                onClick={() => setActiveTab('transfers')}
                className="bg-pink-950/80 border border-pink-600/50 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-pink-300 animate-pulse whitespace-nowrap"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>{pendingTransfersCount} Inbound Transfers</span>
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-pink-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 max-w-7xl mx-auto mt-4 overflow-x-auto border-t border-slate-800/80 pt-3 no-scrollbar">
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
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white text-pink-700' : 'bg-pink-600 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ========================================================================= */}
        {/* TAB 1: LIVE INVENTORY */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search cake name, size, SKU..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <button
                  onClick={() => setFilterStatus('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    filterStatus === 'ALL'
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                  }`}
                >
                  All ({allVariations.length})
                </button>
                <button
                  onClick={() => setFilterStatus('LOW')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    filterStatus === 'LOW'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                  }`}
                >
                  Low Stock ({lowStockCount})
                </button>
                <button
                  onClick={() => setFilterStatus('OUT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    filterStatus === 'OUT'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                      : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                  }`}
                >
                  Out of Stock ({outOfStockCount})
                </button>
              </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVariations.map(variation => {
                const isOutOfStock = variation.counter_stock <= 0;
                const isLowStock = !isOutOfStock && variation.counter_stock <= variation.min_stock_level;

                return (
                  <div
                    key={variation.id}
                    className={`bg-slate-900/80 rounded-xl border p-4 transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'border-rose-900/60 bg-rose-950/10'
                        : isLowStock
                        ? 'border-amber-900/60 bg-amber-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="text-[10px] tracking-wider uppercase font-bold text-pink-400/90">
                            {variation.product_category || 'Bakery'}
                          </span>
                          <h3 className="text-base font-semibold text-white leading-tight">
                            {variation.product_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                              {variation.name}
                            </span>
                            {variation.size && (
                              <span className="text-xs text-slate-400">Size: {variation.size}</span>
                            )}
                            {variation.weight && (
                              <span className="text-xs text-slate-400">({variation.weight})</span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isOutOfStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60 flex items-center gap-1 shadow-sm shadow-rose-900/40">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              OUT OF STOCK
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              LOW STOCK
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              IN STOCK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Level Details */}
                      <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Counter Stock</span>
                          <span
                            className={`text-lg font-black ${
                              isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {variation.counter_stock}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">In Transit</span>
                          <span className="text-lg font-bold text-sky-400">
                            {variation.in_transit_stock || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Min. Target</span>
                          <span className="text-lg font-semibold text-slate-300">
                            {variation.min_stock_level}
                          </span>
                        </div>
                      </div>

                      {/* Price & Bakery Available */}
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
                        <div>
                          Bakery Reserve:{' '}
                          <span className="font-semibold text-slate-200">
                            {variation.bakery_stock} units
                          </span>
                        </div>
                        <div className="text-sm font-bold text-emerald-400">
                          {variation.selling_price.toLocaleString()} ETB
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          setSelectedVariationForRequest(variation);
                          setRequestQty(
                            Math.max(variation.min_stock_level * 2 - variation.counter_stock, 5)
                          );
                          setShowRequestModal(true);
                        }}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-pink-300 border border-slate-700 flex items-center justify-center gap-1.5 transition"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Request More
                      </button>

                      <button
                        onClick={() => addToCart(variation)}
                        disabled={isOutOfStock}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          isOutOfStock
                            ? 'bg-slate-800/50 text-slate-600 border border-slate-800 cursor-not-allowed'
                            : 'bg-pink-600 hover:bg-pink-500 text-white shadow-sm shadow-pink-600/30'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Sell Cake
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COUNTER POS / DIRECT WALK-IN SALE */}
        {/* ========================================================================= */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Product Selector */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    Direct Walk-In Cake Sales
                  </h2>
                  <p className="text-xs text-slate-400">
                    Instant sale & receipt for front counter showcase display
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search cakes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredVariations.map(variation => {
                  const isOutOfStock = variation.counter_stock <= 0;
                  return (
                    <div
                      key={variation.id}
                      onClick={() => !isOutOfStock && addToCart(variation)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isOutOfStock
                          ? 'bg-slate-900/40 border-slate-800/40 opacity-50 cursor-not-allowed'
                          : 'bg-slate-900/90 border-slate-800 hover:border-pink-500/60 hover:bg-slate-850'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white">{variation.product_name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="text-pink-400">{variation.name}</span>
                          {variation.size && <span>• {variation.size}</span>}
                        </div>
                        <div className="text-xs font-semibold text-emerald-400">
                          {variation.selling_price.toLocaleString()} ETB
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            isOutOfStock
                              ? 'bg-rose-950 text-rose-400'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isOutOfStock ? 'OUT' : `${variation.counter_stock} left`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Cart & Checkout Panel */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col justify-between h-[650px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-pink-400" />
                    Current Order ({cart.length})
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-rose-400 hover:text-rose-300 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Cart Items list */}
                <div className="space-y-2 overflow-y-auto max-h-[280px] pr-1">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Cart is empty. Select available cakes from the left.
                    </div>
                  ) : (
                    cart.map(item => (
                      <div
                        key={item.variation.id}
                        className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="max-w-[130px]">
                          <div className="font-semibold text-white truncate">
                            {item.variation.product_name}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            {item.variation.name} ({item.variation.selling_price} ETB)
                          </div>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(item.variation.id, item.quantity - 1)}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.variation.id, item.quantity + 1)}
                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
                          >
                            +
                          </button>
                        </div>

                        <div className="font-bold text-emerald-400">
                          {(item.quantity * item.variation.selling_price).toLocaleString()} ETB
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Customer info & payment selector */}
                <div className="mt-4 space-y-3 pt-3 border-t border-slate-800">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Customer Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Walk-in Guest"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['CASH', 'CARD', 'TRANSFER'] as const).map(pm => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPaymentMethod(pm)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                            paymentMethod === pm
                              ? 'bg-pink-600 text-white border-pink-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Total & Checkout button */}
              <div className="border-t border-slate-800 pt-3">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-400 font-medium">Total Amount:</span>
                  <span className="text-xl font-black text-emerald-400">
                    {cartTotal.toLocaleString()} ETB
                  </span>
                </div>

                <button
                  disabled={cart.length === 0 || isProcessingSale}
                  onClick={handleProcessSale}
                  className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                    cart.length === 0 || isProcessingSale
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/30'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  {isProcessingSale ? 'Completing Sale...' : 'Confirm Sale & Print Receipt'}
                </button>

                {lastSaleReceipt && (
                  <button
                    onClick={() => alert(`Sale Receipt #${lastSaleReceipt.id} printed!`)}
                    className="w-full mt-2 py-1.5 text-[11px] text-slate-400 hover:text-white underline text-center"
                  >
                    View Last Receipt (#{lastSaleReceipt.id.slice(-6)})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: INBOUND PHYSICAL TRANSFERS */}
        {/* ========================================================================= */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-sky-400" />
                  Physical Cake Transfers from Bakery
                </h2>
                <p className="text-xs text-slate-400">
                  Inspect physical deliveries upon arrival. Stock increases only after receipt confirmation.
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-300">
                Pending Confirmation: <span className="text-pink-400">{pendingTransfersCount}</span>
              </div>
            </div>

            {/* Inbound Transfers Table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Transfer ID</th>
                      <th className="px-4 py-3">Cake / Item</th>
                      <th className="px-4 py-3">Variation</th>
                      <th className="px-4 py-3">Dispatched Qty</th>
                      <th className="px-4 py-3">Dispatched By</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Physical Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transfers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No inbound transfer records found.
                        </td>
                      </tr>
                    ) : (
                      transfers.map(transfer => {
                        const isPending =
                          transfer.status === 'PENDING' || transfer.status === 'IN_TRANSIT';
                        return (
                          <tr key={transfer.id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                              #{transfer.id.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 font-bold text-white">
                              {transfer.product_name}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {transfer.variation_name} {transfer.size && `(${transfer.size})`}
                            </td>
                            <td className="px-4 py-3 font-bold text-sky-400 text-sm">
                              {transfer.quantity}
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                              {transfer.sender_name || 'Bakery Staff'}
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                              {new Date(transfer.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  transfer.status === 'RECEIVED'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : transfer.status === 'REJECTED'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                }`}
                              >
                                {transfer.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      setReceivedQty(transfer.quantity);
                                      setShowReceiveModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Confirm Receipt
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTransfer(transfer);
                                      setShowRejectModal(true);
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-rose-900 text-rose-300 border border-slate-700 hover:border-rose-700 transition"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">
                                  {transfer.received_at
                                    ? `Received at ${new Date(transfer.received_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}`
                                    : 'Completed'}
                                </span>
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RESTAURANT WAITER CAKE ORDERS */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                  Waiter Cake Orders Queue
                </h2>
                <p className="text-xs text-slate-400">
                  Approved cake requests routed from restaurant tables. Prepare and mark READY for waiter pickup.
                </p>
              </div>
              <div className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Active Orders: <span className="font-bold text-amber-400">{cakeOrders.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cakeOrders.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                  No active cake orders from restaurant waiters.
                </div>
              ) : (
                cakeOrders.map(order => {
                  const isReady = order.status === 'READY';
                  return (
                    <div
                      key={order.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isReady
                          ? 'bg-emerald-950/20 border-emerald-800/80'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-400">
                            Order #{order.order_number}
                          </span>
                          <h4 className="text-base font-bold text-white">{order.item_name}</h4>
                          <div className="text-xs text-pink-400 font-medium">
                            {order.variation_name} {order.size && `• ${order.size}`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isReady ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <div className="my-2.5 p-2 rounded bg-slate-950/60 text-xs space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Table / Area:</span>
                          <span className="font-bold text-white">{order.table_number || 'Takeaway'}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Quantity:</span>
                          <span className="font-bold text-pink-400 text-sm">{order.quantity}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Waiter:</span>
                          <span className="text-slate-200">{order.waiter_name}</span>
                        </div>
                        {order.notes && (
                          <div className="text-[11px] text-amber-300/80 italic pt-1 border-t border-slate-800">
                            "{order.notes}"
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div className="pt-2">
                        {!isReady ? (
                          <button
                            onClick={() => updateCakeOrderStatus(order.id, 'READY')}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark Ready for Waiter Pickup
                          </button>
                        ) : (
                          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold px-1">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Ready for Collection
                            </span>
                            <button
                              onClick={() => updateCakeOrderStatus(order.id, 'DELIVERED')}
                              className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300"
                            >
                              Delivered
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: REORDER / BAKE REQUESTS */}
        {/* ========================================================================= */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pink-400" />
                  Bakery Reorder Requests
                </h2>
                <p className="text-xs text-slate-400">
                  Track requested production batches and submit new urgent bake orders
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedVariationForRequest(allVariations[0] || null);
                  setShowRequestModal(true);
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white flex items-center gap-1.5 shadow-md shadow-pink-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                Submit New Bake Request
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Req ID</th>
                      <th className="px-4 py-3">Cake Name</th>
                      <th className="px-4 py-3">Variation</th>
                      <th className="px-4 py-3">Requested Qty</th>
                      <th className="px-4 py-3">Urgency</th>
                      <th className="px-4 py-3">Requested At</th>
                      <th className="px-4 py-3">Production Status</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No active bake requests to display.
                        </td>
                      </tr>
                    ) : (
                      requests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                            #{req.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-bold text-white">{req.product_name}</td>
                          <td className="px-4 py-3 text-slate-300">
                            {req.variation_name} {req.size && `(${req.size})`}
                          </td>
                          <td className="px-4 py-3 font-bold text-pink-400 text-sm">
                            {req.requested_quantity}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.urgency === 'URGENT'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : req.urgency === 'HIGH'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {req.urgency}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(req.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === 'COMPLETED'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : req.status === 'IN_PRODUCTION'
                                  ? 'bg-indigo-950 text-indigo-300 animate-pulse'
                                  : 'bg-amber-950 text-amber-300'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                            {req.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: PHYSICAL STOCK COUNTING & DISCREPANCY AUDIT */}
        {/* ========================================================================= */}
        {activeTab === 'stocktake' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  Physical Stock Counting & Discrepancy Adjustment
                </h2>
                <p className="text-xs text-slate-400">
                  Count physical cakes on the counter. Any difference with the system requires an auditable reason.
                </p>
              </div>

              <button
                disabled={isSubmittingAudit || Object.keys(physicalCounts).length === 0}
                onClick={handleStockCountSubmit}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                  isSubmittingAudit || Object.keys(physicalCounts).length === 0
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmittingAudit ? 'Submitting...' : 'Commit Audit & Adjust Inventory'}
              </button>
            </div>

            {/* Table of products to count */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Cake / Variation</th>
                      <th className="px-4 py-3">System Quantity</th>
                      <th className="px-4 py-3">Physical Count</th>
                      <th className="px-4 py-3">Discrepancy</th>
                      <th className="px-4 py-3">Adjustment Reason (Required if difference)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allVariations.map(variation => {
                      const entry = physicalCounts[variation.id];
                      const physicalCount = entry !== undefined ? entry.count : variation.counter_stock;
                      const discrepancy = physicalCount - variation.counter_stock;

                      return (
                        <tr key={variation.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-bold text-white">{variation.product_name}</div>
                            <div className="text-slate-400 text-[11px]">
                              {variation.name} {variation.size && `(${variation.size})`}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-200 text-sm">
                            {variation.counter_stock}
                          </td>
                          <td className="px-4 py-3">
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
                              className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-sm font-bold text-white focus:outline-none focus:border-pink-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {discrepancy === 0 ? (
                              <span className="text-slate-500 font-semibold">0 (Exact)</span>
                            ) : discrepancy < 0 ? (
                              <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded">
                                {discrepancy} (Shortage)
                              </span>
                            ) : (
                              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded">
                                +{discrepancy} (Surplus)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {discrepancy !== 0 ? (
                              <input
                                type="text"
                                placeholder="Explain discrepancy reason..."
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
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-pink-500"
                              />
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Match confirmed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: WASTE, DAMAGE & CUSTOMER RETURNS */}
        {/* ========================================================================= */}
        {activeTab === 'waste' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Record Waste Card */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-950 text-rose-400 border border-rose-800">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Record Waste or Damage</h3>
                    <p className="text-xs text-slate-400">
                      Deduct damaged, expired, or spoiled cakes from front counter inventory
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowWasteModal(true)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Log Loss Entry
                </button>
              </div>

              {/* Record Return Card */}
              <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Process Customer Return</h3>
                    <p className="text-xs text-slate-400">
                      Log customer return with inspection of sellability before restocking
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowReturnModal(true)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Process Return Entry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM TRANSFER RECEIPT */}
      {/* ========================================================================= */}
      {showReceiveModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Confirm Physical Transfer Receipt
              </h3>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="text-slate-400">Item: <span className="font-bold text-white">{selectedTransfer.product_name}</span></div>
                <div className="text-slate-400">Variation: <span className="font-semibold text-slate-200">{selectedTransfer.variation_name}</span></div>
                <div className="text-slate-400">Bakery Dispatched: <span className="font-bold text-sky-400">{selectedTransfer.quantity} units</span></div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Physically Counted Quantity:
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedTransfer.quantity}
                  value={receivedQty}
                  onChange={e => setReceivedQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white"
                />
                {receivedQty < selectedTransfer.quantity && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    Partial receipt: {selectedTransfer.quantity - receivedQty} units will remain flagged as discrepancy.
                  </p>
                )}
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Receipt Notes / Condition Check</label>
                <textarea
                  placeholder="e.g. Delivered in pristine cold condition"
                  value={receiveNotes}
                  onChange={e => setReceiveNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30"
              >
                Accept into Counter Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJECT TRANSFER */}
      {/* ========================================================================= */}
      {showRejectModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Reject Physical Delivery
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Rejecting transfer for <span className="font-bold text-white">{selectedTransfer.product_name}</span> ({selectedTransfer.quantity} units). Inventory will be returned to bakery reserve.
              </p>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Mandatory Rejection Reason:
                </label>
                <textarea
                  placeholder="e.g. Broken topping during transport, melted frosting"
                  value={rejectNotes}
                  onChange={e => setRejectNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-rose-900 rounded-lg text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={!rejectNotes.trim()}
                onClick={handleRejectTransfer}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT REORDER / BAKE REQUEST */}
      {/* ========================================================================= */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-pink-400" />
                Submit Production Reorder Request
              </h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Select Cake & Variation</label>
                <select
                  value={selectedVariationForRequest?.id || ''}
                  onChange={e => {
                    const found = allVariations.find(v => v.id === e.target.value);
                    if (found) setSelectedVariationForRequest(found);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name} ({v.counter_stock} in stock)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Quantity Needed</label>
                  <input
                    type="number"
                    min="1"
                    value={requestQty}
                    onChange={e => setRequestQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Urgency Level</label>
                  <select
                    value={requestUrgency}
                    onChange={e => setRequestUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">URGENT (Stock Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Notes / Instructions</label>
                <textarea
                  placeholder="e.g. Afternoon rush expected, please expedite"
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30"
                >
                  Send to Bakery Queue
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                Log Cake Damage or Waste
              </h3>
              <button onClick={() => setShowWasteModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleWasteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Select Cake</label>
                <select
                  value={wasteVariationId}
                  onChange={e => setWasteVariationId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="">-- Choose Item --</option>
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name} (Stock: {v.counter_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Quantity Wasted</label>
                  <input
                    type="number"
                    min="1"
                    value={wasteQty}
                    onChange={e => setWasteQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Reason</label>
                  <select
                    value={wasteReason}
                    onChange={e => setWasteReason(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="DAMAGED">Physical Damage</option>
                    <option value="EXPIRED">Expired Shelf Life</option>
                    <option value="SPOILED">Spoiled / Off-Taste</option>
                    <option value="COMPLIMENTARY">Complimentary / Tasting</option>
                    <option value="STAFF">Staff Consumption</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Detailed Explanation</label>
                <textarea
                  required
                  placeholder="Explain cause of loss..."
                  value={wasteNotes}
                  onChange={e => setWasteNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
                >
                  Deduct from Counter Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROCESS RETURN */}
      {/* ========================================================================= */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-400" />
                Process Customer Return
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Select Cake</label>
                <select
                  value={returnVariationId}
                  onChange={e => setReturnVariationId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="">-- Choose Item --</option>
                  {allVariations.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} - {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={returnQty}
                    onChange={e => setReturnQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Physical Condition</label>
                  <select
                    value={returnCondition}
                    onChange={e => setReturnCondition(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="SELLABLE">Sellable / Untouched</option>
                    <option value="DAMAGED">Damaged / Opened</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  id="returnToStock"
                  checked={returnToInventory}
                  onChange={e => setReturnToInventory(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500"
                />
                <label htmlFor="returnToStock" className="text-slate-300">
                  Return to Sellable Counter Stock (Only check if product is safe & sealed)
                </label>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Return Reason</label>
                <textarea
                  required
                  placeholder="e.g. Customer changed mind, wrong flavor requested"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Record Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
