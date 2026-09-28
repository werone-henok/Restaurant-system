import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { resolveImageUrl } from '../../utils/imageUrl';
import { tactileFeedback } from '../../utils/feedback';
import { gToast } from '../../utils/toast';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import {
  Flame,
  Send,
  Plus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Check,
  X,
  Clock,
  Package,
  Layers,
  Sparkles,
  History,
  AlertTriangle
} from 'lucide-react';

interface Variation {
  id: string;
  product_id: string;
  name: string;
  variation_name?: string;
  size?: string;
  bakery_stock: number;
  counter_stock: number;
  price?: number;
  selling_price?: number;
  photo_url?: string;
  image_url?: string;
  product_name?: string;
  product_name_amharic?: string;
}

interface Product {
  id: string;
  name: string;
  name_amharic?: string;
  category: string;
  photo_url?: string;
  image_url?: string;
  variations: Variation[];
}

interface BakeRequest {
  id: string;
  product_id: string;
  variation_id: string;
  requested_quantity: number;
  quantity_requested?: number;
  urgency: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PRODUCTION' | 'READY' | 'TRANSFERRED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  notes?: string;
  created_at: string;
  product_name: string;
  product_name_amharic?: string;
  variation_name: string;
  size?: string;
  photo_url?: string;
}

interface Batch {
  id: string;
  batch_number: string;
  product_name: string;
  product_name_amharic?: string;
  variation_name: string;
  quantity_produced: number;
  quantity_remaining: number;
  status: 'BAKING' | 'READY' | 'COMPLETED';
  created_at: string;
  photo_url?: string;
  variation_id: string;
  product_id: string;
  produced_by_name?: string;
}

// Cake image helper ensures every cake has a mouth-watering visual photo
function getCakePhoto(item: { photo_url?: string; image_url?: string; name?: string; product_name?: string }): string {
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

export const BakeryView: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'requests' | 'ready' | 'bake_new' | 'history'>('requests');

  // Operational states
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<BakeRequest[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Grouped variations: Product ID -> Selected Variation ID
  const [selectedVariationMap, setSelectedVariationMap] = useState<Record<string, string>>({});

  // Quick Bake Modal
  const [selectedCakeForBake, setSelectedCakeForBake] = useState<Variation | null>(null);
  const [bakeQty, setBakeQty] = useState(10);
  const [isStartingBake, setIsStartingBake] = useState(false);

  // Send to Counter Transfer Modal
  const [transferTarget, setTransferTarget] = useState<{ cake: Variation; maxQty: number } | null>(null);
  const [transferQty, setTransferQty] = useState(5);
  const [isDispatchingTransfer, setIsDispatchingTransfer] = useState(false);

  // History Tab States
  const [historyData, setHistoryData] = useState<{ batches: any[]; transfers: any[]; waste: any[] }>({
    batches: [],
    transfers: [],
    waste: []
  });
  const [historySubTab, setHistorySubTab] = useState<'batches' | 'transfers' | 'waste'>('batches');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add New Cake Modal
  const [showAddCakeModal, setShowAddCakeModal] = useState(false);
  const [isCreatingCake, setIsCreatingCake] = useState(false);
  const [newCakeName, setNewCakeName] = useState('');
  const [newCakeAmharic, setNewCakeAmharic] = useState('');
  const [newCakeCategory, setNewCakeCategory] = useState('Cake');
  const [newCakePhoto, setNewCakePhoto] = useState(PRESET_CAKE_PHOTOS[0].url);
  const [newCakePhotoMode, setNewCakePhotoMode] = useState<'preset' | 'upload'>('preset');
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

  const loadData = useCallback(async () => {
    try {
      const [prodData, reqData, batchData] = await Promise.all([
        api.request<any>('/bakery/products').catch(() => ({ data: [] })),
        api.request<any>('/bakery/requests').catch(() => ({ data: [] })),
        api.request<any>('/bakery/batches').catch(() => ({ data: [] }))
      ]);

      const rawProducts: Product[] = Array.isArray(prodData) ? prodData : prodData?.data || [];
      setProducts(rawProducts);
      setRequests(Array.isArray(reqData) ? reqData : reqData?.data || []);
      setBatches(Array.isArray(batchData) ? batchData : batchData?.data || []);

      // Auto-initialize selected variation map for each product
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
      console.error('Failed to load bakery kitchen data', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res: any = await api.request('/bakery/history');
      if (res) {
        setHistoryData({
          batches: res.batches || [],
          transfers: res.transfers || [],
          waste: res.waste || []
        });
      }
    } catch (err) {
      console.error('Failed to load bakery history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();

    const unsub = api.onEvent((event) => {
      if (
        event?.type === 'BAKERY_REQUEST_NEW' ||
        event?.type === 'BAKERY_REQUEST_UPDATED' ||
        event?.type === 'BAKERY_BATCH_CREATED' ||
        event?.type === 'BAKERY_BATCH_READY' ||
        event?.type === 'BAKERY_TRANSFER_PENDING' ||
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

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // 1-Tap: Start Baking a Request
  const handleStartBakingRequest = async (request: BakeRequest) => {
    tactileFeedback('success');
    try {
      await api.request(`/bakery/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PRODUCTION' })
      });
      gToast.success('🔥 መጋገር ጀመረ! (Baking in progress!)');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ማዘመን አልተቻለም');
    }
  };

  // 1-Tap: Mark Baking Batch as Ready
  const handleMarkBatchReady = async (batchId: string) => {
    tactileFeedback('success');
    try {
      await api.request(`/bakery/batches/${batchId}/ready`, {
        method: 'PATCH'
      });
      gToast.success('🎂 ኬኩ በሰለ! ወደ ክምችት ገባ (Cake is Ready!)');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ማዘመን አልተቻለም');
    }
  };

  // 1-Tap: Mark a bake REQUEST as Ready (done baking, ready to send to counter)
  const handleMarkRequestReady = async (requestId: string) => {
    tactileFeedback('success');
    try {
      await api.request(`/bakery/requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' })
      });
      gToast.success('✅ ኬኩ ተጋግሯል! ለካውንተር ዝግጁ ነው (Ready to Send to Counter!)');
      setActiveTab('ready');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ማዘመን አልተቻለም');
    }
  };

  // 1-Tap: Send a READY request to the counter as a physical transfer
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);
  const handleSendRequestToCounter = async (req: BakeRequest) => {
    tactileFeedback('click');
    setSendingRequestId(req.id);
    try {
      // 1. Create the physical transfer record
      await api.request('/bakery/transfers', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: req.variation_id,
          quantity_sent: req.quantity_requested || req.requested_quantity,
          notes: `ለካውንተር ተላከ / Sent from bake request #${req.id}`,
          request_id: req.id
        })
      });
      // 2. Mark the request as TRANSFERRED
      await api.request(`/bakery/requests/${req.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'TRANSFERRED' })
      });
      tactileFeedback('success');
      gToast.success(`🚚 ${req.quantity_requested || req.requested_quantity} ኬክ ወደ ካውንተር ተላከ! (Sent to Counter)`);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ወደ ካውንተር መላክ አልተቻለም');
    } finally {
      setSendingRequestId(null);
    }
  };

  // 1-Tap: Start a New Bake Batch
  const handleStartNewBake = async () => {
    if (!selectedCakeForBake) return;
    tactileFeedback('click');
    setIsStartingBake(true);
    try {
      await api.request('/bakery/batches', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedCakeForBake.product_id,
          variation_id: selectedCakeForBake.id,
          quantity_produced: bakeQty,
          selling_price: selectedCakeForBake.selling_price || selectedCakeForBake.price || 200,
          shelf_life_days: 3,
          notes: 'Freshly baked batch',
          status: 'BAKING'
        })
      });
      tactileFeedback('success');
      gToast.success(`🔥 ${bakeQty} ኬክ መጋገር ጀመረ! (Started baking!)`);
      setSelectedCakeForBake(null);
      setActiveTab('ready');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'መጀመር አልተቻለም');
    } finally {
      setIsStartingBake(false);
    }
  };

  // 1-Tap: Dispatch Transfer to Front Cake Counter
  const handleSendTransfer = async () => {
    if (!transferTarget) return;
    tactileFeedback('click');
    setIsDispatchingTransfer(true);
    try {
      await api.request('/bakery/transfers', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: transferTarget.cake.id,
          quantity_sent: transferQty,
          notes: 'Direct physical transfer to front counter'
        })
      });
      tactileFeedback('success');
      gToast.success(`🚚 ${transferQty} ኬክ ወደ ፊት ካውንተር ተልኳል! (Sent to Counter!)`);
      setTransferTarget(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'መላክ አልተቻለም');
    } finally {
      setIsDispatchingTransfer(false);
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
      setNewCakePhoto(PRESET_CAKE_PHOTOS[0].url);
      setNewCakePhotoMode('preset');
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ኬክ መመዝገብ አልተቻለም');
    } finally {
      setIsCreatingCake(false);
    }
  };

  // Delete cake product (Admin / Owner ONLY)
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

  // Counts
  const pendingRequests = requests.filter(r => r.status === 'REQUESTED' || r.status === 'IN_PRODUCTION');
  const readyRequests = requests.filter(r => r.status === 'READY');
  const activeBakingBatches = batches.filter(b => b.status === 'BAKING');

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '16px 20px 90px', boxSizing: 'border-box', fontFamily: 'var(--font-family)' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          borderRadius: 22,
          marginBottom: 18,
          boxShadow: '0 8px 24px rgba(180, 83, 9, 0.25)',
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
            🍰
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
              የዳቦ ቤት ማብሰያ ክፍል
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, opacity: 0.9 }}>
              Bakery Kitchen • {user?.username} ({user?.role})
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
                color: '#b45309',
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

      {/* 4 Large Picture-Driven Action Tabs - Optimized for Tablets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Tab 1: Counter Requests / Needs Baking */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('requests');
          }}
          style={{
            position: 'relative',
            background: activeTab === 'requests' ? 'linear-gradient(135deg, #b45309 0%, #d97706 100%)' : 'var(--bg-card)',
            color: activeTab === 'requests' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'requests' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'requests' ? '0 8px 20px rgba(180, 83, 9, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🔔</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>ምን ልጋግር?</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Requests ({pendingRequests.length})</span>

          {pendingRequests.length > 0 && (
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
              {pendingRequests.length}
            </span>
          )}
        </button>

        {/* Tab 2: Ready / Send to Counter */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('ready');
          }}
          style={{
            position: 'relative',
            background: activeTab === 'ready' ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' : 'var(--bg-card)',
            color: activeTab === 'ready' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'ready' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'ready' ? '0 8px 20px rgba(2, 132, 199, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🚚</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>ለካውንተር ላክ</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Send to Counter</span>

          {activeBakingBatches.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: 6,
                background: '#f59e0b',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 900,
                width: 26,
                height: 26,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff'
              }}
            >
              {activeBakingBatches.length}
            </span>
          )}
        </button>

        {/* Tab 3: Bake New Cake */}
        <button
          onClick={() => {
            tactileFeedback('click');
            setActiveTab('bake_new');
          }}
          style={{
            background: activeTab === 'bake_new' ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' : 'var(--bg-card)',
            color: activeTab === 'bake_new' ? '#ffffff' : 'var(--text-main)',
            border: activeTab === 'bake_new' ? 'none' : '2px solid var(--border)',
            borderRadius: 18,
            padding: '14px 8px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            boxShadow: activeTab === 'bake_new' ? '0 8px 20px rgba(22, 163, 74, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 26 }}>🎂</span>
          <span style={{ fontSize: 14, fontWeight: 900 }}>አዲስ ጋግር</span>
          <span style={{ fontSize: 11, opacity: 0.88 }}>Bake New</span>
        </button>

        {/* Tab 4: History */}
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
      {/* 1. FRONT COUNTER REQUESTS (WHAT TO BAKE) */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {pendingRequests.length === 0 ? (
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
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>የተጠየቀ ኬክ የለም</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                ካውንተር በቂ ክምችት አለው:: ተጨማሪ ለመጋገር "አዲስ ጋግር" ይንኩ::
              </p>
            </div>
          ) : (
            pendingRequests.map(req => {
              const photo = getCakePhoto(req);
              const qty = req.quantity_requested || req.requested_quantity;
              const isBaking = req.status === 'IN_PRODUCTION';

              return (
                <div
                  key={req.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    border: isBaking ? '3px solid #f59e0b' : '3px solid #ef4444',
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
                      alt={req.product_name}
                      style={{
                        width: 85,
                        height: 85,
                        borderRadius: 16,
                        objectFit: 'cover',
                        border: '2px solid var(--border)',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flexGrow: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#dc2626', textTransform: 'uppercase' }}>
                        🔔 ካውንተሩ ጠይቋል (Front Counter Needs)
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 0', color: 'var(--text-main)' }}>
                        {req.product_name_amharic || req.product_name}
                      </h3>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                        {req.variation_name} {req.size && `• ${req.size}`}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#b45309', marginTop: 4 }}>
                        የሚፈለገው ብዛት: <span style={{ fontSize: 26, color: '#dc2626' }}>{qty}</span> ኬክ
                      </div>
                    </div>
                  </div>

                  {!isBaking ? (
                    <button
                      onClick={() => handleStartBakingRequest(req)}
                      style={{
                        background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 14,
                        padding: '16px',
                        fontSize: 16,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 6px 16px rgba(234, 88, 12, 0.3)',
                        cursor: 'pointer'
                      }}
                    >
                      <Flame size={22} />
                      🔥 መጋገር ጀምር (START BAKING)
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Oven status indicator */}
                      <div
                        style={{
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '12px 14px',
                          borderRadius: 14,
                          textAlign: 'center',
                          fontWeight: 900,
                          fontSize: 15,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                      >
                        <Flame size={20} className="animate-bounce" />
                        እየተጋገረ ነው... (Currently Baking in Oven)
                      </div>

                      {/* Mark as Ready button */}
                      <button
                        onClick={() => handleMarkRequestReady(req.id)}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 14,
                          padding: '14px',
                          fontSize: 15,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          boxShadow: '0 6px 16px rgba(22, 163, 74, 0.3)',
                          transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                        }}
                        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <CheckCircle2 size={20} />
                        ✅ ተጋግሯል! ለካውንተር ዝግጁ (Mark as Ready)
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. READY CAKES & SEND TO COUNTER (COMBINED BY PRODUCT WITH SIZE PILLS) */}
      {/* ========================================================================= */}
      {activeTab === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── SECTION A: READY requests waiting to be dispatched ── */}
          {readyRequests.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} /> ዝግጁ — ወደ ካውንተር ለመላክ (Ready to Dispatch)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {readyRequests.map(req => {
                  const photo = getCakePhoto(req);
                  const qty = req.quantity_requested || req.requested_quantity;
                  const isSending = sendingRequestId === req.id;
                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--bg-card)',
                        borderRadius: 20,
                        border: '3px solid #22c55e',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 6px 20px rgba(22, 163, 74, 0.12)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <img
                          src={photo}
                          alt={req.product_name}
                          style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', border: '2px solid #bbf7d0', flexShrink: 0 }}
                        />
                        <div style={{ flexGrow: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: '#15803d', textTransform: 'uppercase' }}>
                            ✅ ዝግጁ — ካውንተር ጠይቋል (Ready — Counter Requested)
                          </span>
                          <h3 style={{ fontSize: 18, fontWeight: 900, margin: '2px 0 0', color: 'var(--text-main)' }}>
                            {req.product_name_amharic || req.product_name}
                          </h3>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
                            {req.variation_name} {req.size && `• ${req.size}`}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                            ብዛት: <span style={{ fontSize: 28, color: '#15803d' }}>{qty}</span> ኬክ
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendRequestToCounter(req)}
                        disabled={isSending}
                        style={{
                          background: isSending ? '#e5e7eb' : 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                          color: isSending ? '#6b7280' : '#ffffff',
                          border: 'none',
                          borderRadius: 14,
                          padding: '16px',
                          fontSize: 16,
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: isSending ? 'not-allowed' : 'pointer',
                          boxShadow: isSending ? 'none' : '0 6px 16px rgba(2, 132, 199, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Send size={20} />
                        {isSending ? 'እየተላከ ነው...' : `🚚 ለካውንተር ላክ (Send to Counter)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Baking Batches in Oven */}
          {activeBakingBatches.length > 0 && (

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#b45309', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flame size={20} /> እሳት ላይ ያሉ (Currently in Oven)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {activeBakingBatches.map(batch => (
                  <div
                    key={batch.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 18,
                      border: '2px solid #f59e0b',
                      padding: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={getCakePhoto(batch)}
                        alt=""
                        style={{ width: 68, height: 68, borderRadius: 14, objectFit: 'cover' }}
                      />
                      <div>
                        <strong style={{ fontSize: 16, display: 'block', color: 'var(--text-main)' }}>
                          {batch.product_name_amharic || batch.product_name}
                        </strong>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {batch.variation_name} • <strong style={{ color: '#b45309' }}>{batch.quantity_produced} ኬክ</strong>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleMarkBatchReady(batch.id)}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 18px',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      በስሏል (Ready)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cakes Available to Send to Counter (Grouped with Size Pills) */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0284c7', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={20} /> የበሰሉ / ለካውንተር መላኪያ (Finished Cakes to Send)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {products.map(product => {
                const variations = product.variations || [];
                if (variations.length === 0) return null;

                const selectedVarId = selectedVariationMap[product.id] || variations[0]?.id;
                const activeVar = variations.find(v => v.id === selectedVarId) || variations[0];
                const photo = getCakePhoto(product);
                const bakeryStock = Number(activeVar?.bakery_stock || 0);
                const hasStock = bakeryStock > 0;

                return (
                  <div
                    key={product.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 20,
                      border: '2px solid var(--border)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                        <img
                          src={photo}
                          alt={product.name}
                          style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flexGrow: 1 }}>
                          <strong style={{ fontSize: 16, color: 'var(--text-main)', display: 'block', lineHeight: 1.25 }}>
                            {product.name_amharic || product.name}
                          </strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {product.name}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Size Pills */}
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          መጠን ይምረጡ (Select Size):
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {variations.map(v => {
                            const isSelected = v.id === activeVar?.id;
                            const stock = Number(v.bakery_stock || 0);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  tactileFeedback('click');
                                  setSelectedVariationMap(prev => ({ ...prev, [product.id]: v.id }));
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  border: isSelected ? '2px solid #0284c7' : '1px solid var(--border)',
                                  background: isSelected ? '#e0f2fe' : 'var(--bg-app)',
                                  color: isSelected ? '#0369a1' : 'var(--text-main)',
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

                      {/* Stock Status for Chosen Size */}
                      <div style={{ background: 'var(--bg-app)', padding: 10, borderRadius: 12, textAlign: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                          የ{activeVar?.size || activeVar?.variation_name} ክምችት
                        </span>
                        <strong style={{ fontSize: 20, color: hasStock ? '#16a34a' : '#ef4444' }}>
                          {bakeryStock} ኬክ አለ
                        </strong>
                      </div>
                    </div>

                    <button
                      disabled={!hasStock}
                      onClick={() => {
                        tactileFeedback('click');
                        const cakeObj: Variation = {
                          ...activeVar,
                          product_name: product.name,
                          product_name_amharic: product.name_amharic,
                          photo_url: product.photo_url
                        };
                        setTransferTarget({ cake: cakeObj, maxQty: bakeryStock });
                        setTransferQty(Math.min(bakeryStock, 5));
                      }}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: 14,
                        background: hasStock ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' : 'var(--border)',
                        color: hasStock ? '#ffffff' : 'var(--text-muted)',
                        border: 'none',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: hasStock ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: hasStock ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
                      }}
                    >
                      <Send size={18} />
                      ለካውንተር ላክ (Send to Counter)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISUAL CAKE PICKER TO BAKE NEW (COMBINED BY PRODUCT WITH SIZE PILLS) */}
      {/* ========================================================================= */}
      {activeTab === 'bake_new' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', fontWeight: 700 }}>
              የሚጋግሩትን ኬክ ይምረጡ (Choose cake and size to bake):
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {products.map(product => {
              const variations = product.variations || [];
              if (variations.length === 0) return null;

              const selectedVarId = selectedVariationMap[product.id] || variations[0]?.id;
              const activeVar = variations.find(v => v.id === selectedVarId) || variations[0];
              const photo = getCakePhoto(product);

              return (
                <div
                  key={product.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: '2px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  {/* Photo with Admin Delete Button Overlay */}
                  <div style={{ width: '100%', height: 160, position: 'relative' }}>
                    <img
                      src={photo}
                      alt={product.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

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
                          top: 10,
                          right: 10,
                          background: 'rgba(239, 68, 68, 0.88)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 12,
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--text-main)', lineHeight: 1.25 }}>
                        {product.name_amharic || product.name}
                      </h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {product.name}
                      </div>

                      {/* Size Selector Pills */}
                      <div style={{ marginTop: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          የሚጋገር መጠን (Select Size):
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {variations.map(v => {
                            const isSelected = v.id === activeVar?.id;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  tactileFeedback('click');
                                  setSelectedVariationMap(prev => ({ ...prev, [product.id]: v.id }));
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  border: isSelected ? '2px solid #16a34a' : '1px solid var(--border)',
                                  background: isSelected ? '#dcfce7' : 'var(--bg-app)',
                                  color: isSelected ? '#15803d' : 'var(--text-main)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {v.size || v.name || v.variation_name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        tactileFeedback('click');
                        const cakeObj: Variation = {
                          ...activeVar,
                          product_name: product.name,
                          product_name_amharic: product.name_amharic,
                          photo_url: product.photo_url
                        };
                        setSelectedCakeForBake(cakeObj);
                        setBakeQty(10);
                      }}
                      style={{
                        marginTop: 10,
                        width: '100%',
                        padding: '14px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <Flame size={18} />
                      🔥 {activeVar?.size || activeVar?.variation_name} ጋግር (Bake)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HISTORY TAB (PAST BAKE BATCHES, TRANSFERS & WASTE LOGS) */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sub-tabs for History */}
          <div style={{ display: 'flex', gap: 10, borderBottom: '2px solid var(--border)', paddingBottom: 10 }}>
            <button
              onClick={() => {
                tactileFeedback('click');
                setHistorySubTab('batches');
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: 'none',
                background: historySubTab === 'batches' ? '#4f46e5' : 'var(--bg-app)',
                color: historySubTab === 'batches' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🎂 የተጋገሩ ኬኮች ({historyData.batches.length})
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
              🚚 ለካውንተር የተላኩ ({historyData.transfers.length})
            </button>
            <button
              onClick={() => {
                tactileFeedback('click');
                setHistorySubTab('waste');
              }}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: 'none',
                background: historySubTab === 'waste' ? '#dc2626' : 'var(--bg-app)',
                color: historySubTab === 'waste' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🗑️ ብክነት / የተበላሹ ({historyData.waste.length})
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              ታሪክ እየተጫነ ነው... (Loading history...)
            </div>
          ) : (
            <div>
              {/* SUBTAB 1: BAKE BATCHES */}
              {historySubTab === 'batches' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {historyData.batches.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      ምንም የተጋገረ ታሪክ የለም (No baking history yet)
                    </div>
                  ) : (
                    historyData.batches.map(b => (
                      <div
                        key={b.id}
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
                            background: b.status === 'READY' || b.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            flexShrink: 0
                          }}
                        >
                          {b.status === 'READY' || b.status === 'COMPLETED' ? '🎂' : '🔥'}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
                              {b.product_name_amharic || b.product_name}
                            </strong>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: '2px 8px',
                                borderRadius: 8,
                                background: b.status === 'READY' || b.status === 'COMPLETED' ? '#22c55e' : '#f59e0b',
                                color: '#ffffff'
                              }}
                            >
                              {b.status === 'COMPLETED' ? 'ተጠናቋል' : b.status === 'READY' ? 'በስሏል' : 'በእሳት ላይ'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                            {b.variation_name} {b.size && `(${b.size})`} • <strong style={{ color: '#16a34a' }}>{b.quantity_produced} ኬክ</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8 }}>
                            <span>🕒 {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>👤 {b.produced_by_name || 'Bakery Staff'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUBTAB 2: TRANSFERS */}
              {historySubTab === 'transfers' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {historyData.transfers.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      ምንም የተላከ ርክክብ የለም (No transfers sent yet)
                    </div>
                  ) : (
                    historyData.transfers.map(t => (
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
                            background: t.status === 'RECEIVED' ? '#e0f2fe' : '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            flexShrink: 0
                          }}
                        >
                          🚚
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
                              {t.product_name_amharic || t.product_name}
                            </strong>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: '2px 8px',
                                borderRadius: 8,
                                background: t.status === 'RECEIVED' ? '#0284c7' : '#f59e0b',
                                color: '#ffffff'
                              }}
                            >
                              {t.status === 'RECEIVED' ? 'ተረክበዋል' : 'መንገድ ላይ'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                            {t.variation_name} {t.size && `(${t.size})`} • <strong style={{ color: '#0284c7' }}>{t.quantity_sent} ኬክ ተልኳል</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            🕒 {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • የላከው: {t.sent_by_name || 'Bakery'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUBTAB 3: WASTE LOG */}
              {historySubTab === 'waste' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {historyData.waste.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      ምንም የተመዘገበ ብክነት የለም (No waste recorded)
                    </div>
                  ) : (
                    historyData.waste.map(w => (
                      <div
                        key={w.id}
                        style={{
                          background: 'var(--bg-card)',
                          borderRadius: 16,
                          border: '1px solid #fecaca',
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
                            background: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            flexShrink: 0
                          }}
                        >
                          🗑️
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <strong style={{ fontSize: 15, color: '#dc2626' }}>
                            {w.product_name_amharic || w.product_name}
                          </strong>
                          <div style={{ fontSize: 13, color: 'var(--text-main)', marginTop: 2 }}>
                            ብዛት: <strong style={{ color: '#dc2626' }}>{w.quantity} ኬክ</strong> • ምክንያት: {w.reason}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            🕒 {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • መዝጋቢ: {w.recorded_by || 'Staff'}
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
      {/* MODAL 1: START BAKE STEPPER */}
      {/* ========================================================================= */}
      {selectedCakeForBake && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 24, padding: 26, textAlign: 'center', boxShadow: 'var(--shadow-floating)' }}>
            <img
              src={getCakePhoto(selectedCakeForBake)}
              alt=""
              style={{ width: 120, height: 120, borderRadius: 22, objectFit: 'cover', margin: '0 auto 14px', border: '3px solid #fef08a', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
            />
            <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
              {selectedCakeForBake.product_name_amharic || selectedCakeForBake.product_name}
            </h3>
            <div style={{ fontSize: 14, color: '#ea580c', fontWeight: 800, marginTop: 4 }}>
              መጠን: {selectedCakeForBake.size || selectedCakeForBake.variation_name}
            </div>
            <p style={{ margin: '6px 0 20px', fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>
              ስንት ኬክ ይጋገራል? (How many cakes to bake?)
            </p>

            {/* Giant Touch Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
              <button
                onClick={() => {
                  tactileFeedback('click');
                  setBakeQty(Math.max(1, bakeQty - 5));
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

              <span style={{ fontSize: 44, fontWeight: 900, color: '#ea580c', minWidth: 80, textAlign: 'center' }}>
                {bakeQty}
              </span>

              <button
                onClick={() => {
                  tactileFeedback('click');
                  setBakeQty(bakeQty + 5);
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
                onClick={() => setSelectedCakeForBake(null)}
                style={{ flex: 1, padding: 16, borderRadius: 16, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                ተመለስ
              </button>

              <button
                disabled={isStartingBake}
                onClick={handleStartNewBake}
                style={{
                  flex: 2,
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 18px rgba(234, 88, 12, 0.35)'
                }}
              >
                <Flame size={22} />
                {isStartingBake ? 'እየጀመረ ነው...' : `🔥 ${bakeQty} ኬክ ጋግር`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SEND TRANSFER TO COUNTER STEPPER */}
      {/* ========================================================================= */}
      {transferTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', width: '100%', maxWidth: 440, borderRadius: 24, padding: 26, textAlign: 'center', boxShadow: 'var(--shadow-floating)' }}>
            <img
              src={getCakePhoto(transferTarget.cake)}
              alt=""
              style={{ width: 120, height: 120, borderRadius: 22, objectFit: 'cover', margin: '0 auto 14px', border: '3px solid #bae6fd', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
            />
            <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
              {transferTarget.cake.product_name_amharic || transferTarget.cake.product_name}
            </h3>
            <div style={{ fontSize: 14, color: '#0284c7', fontWeight: 800, marginTop: 4 }}>
              መጠን: {transferTarget.cake.size || transferTarget.cake.variation_name}
            </div>
            <p style={{ margin: '6px 0 20px', fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>
              ስንት ኬክ ወደ ፊት ካውንተር ይላክ? (Max: {transferTarget.maxQty})
            </p>

            {/* Giant Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
              <button
                onClick={() => {
                  tactileFeedback('click');
                  setTransferQty(Math.max(1, transferQty - 1));
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

              <span style={{ fontSize: 44, fontWeight: 900, color: '#0284c7', minWidth: 80, textAlign: 'center' }}>
                {transferQty}
              </span>

              <button
                onClick={() => {
                  tactileFeedback('click');
                  setTransferQty(Math.min(transferTarget.maxQty, transferQty + 1));
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
                onClick={() => setTransferTarget(null)}
                style={{ flex: 1, padding: 16, borderRadius: 16, border: '2px solid var(--border)', background: 'var(--bg-app)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                ተመለስ
              </button>

              <button
                disabled={isDispatchingTransfer}
                onClick={handleSendTransfer}
                style={{
                  flex: 2,
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 18px rgba(2, 132, 199, 0.35)'
                }}
              >
                <Send size={22} />
                {isDispatchingTransfer ? 'እየላከ ነው...' : `🚚 ${transferQty} ኬክ ላክ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD NEW CAKE MENU ITEM (BAKERY, ADMIN, OWNER) */}
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

              {/* Photo Section: tabbed Camera/Upload vs Preset */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  ፎቶ ይምረጡ (Select Photo)
                </label>

                {/* Tab toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setNewCakePhotoMode('upload')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: 'none',
                      background: newCakePhotoMode === 'upload'
                        ? 'linear-gradient(135deg, #b45309 0%, #d97706 100%)'
                        : 'var(--bg-app)',
                      color: newCakePhotoMode === 'upload' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: newCakePhotoMode === 'upload' ? '0 4px 12px rgba(180,83,9,0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📷 ፎቶ አንሳ / Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCakePhotoMode('preset')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: 'none',
                      background: newCakePhotoMode === 'preset'
                        ? 'linear-gradient(135deg, #b45309 0%, #d97706 100%)'
                        : 'var(--bg-app)',
                      color: newCakePhotoMode === 'preset' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: newCakePhotoMode === 'preset' ? '0 4px 12px rgba(180,83,9,0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🎨 ዝግጁ ፎቶዎች (Presets)
                  </button>
                </div>

                {/* Upload / Camera panel */}
                {newCakePhotoMode === 'upload' && (
                  <ImageUploadCompressor
                    value={PRESET_CAKE_PHOTOS.some(p => p.url === newCakePhoto) ? '' : newCakePhoto}
                    onChange={(url) => {
                      setNewCakePhoto(url);
                    }}
                    label="በካሜራ ያንሱ ወይም ከፋይል ይምረጡ (Camera shot or file upload)"
                  />
                )}

                {/* Preset grid panel */}
                {newCakePhotoMode === 'preset' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {PRESET_CAKE_PHOTOS.map(p => (
                      <div
                        key={p.url}
                        onClick={() => setNewCakePhoto(p.url)}
                        style={{
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: newCakePhoto === p.url ? '3px solid #b45309' : '2px solid var(--border)',
                          cursor: 'pointer',
                          position: 'relative',
                          height: 65,
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 0, insetInline: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 10, padding: '2px 4px', textAlign: 'center', fontWeight: 800 }}>
                          {p.label}
                        </span>
                        {newCakePhoto === p.url && (
                          <span style={{ position: 'absolute', top: 4, right: 4, background: '#b45309', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Current photo preview strip (always visible) */}
                {newCakePhoto && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-app)', borderRadius: 12, padding: '8px 12px' }}>
                    <img
                      src={newCakePhoto}
                      alt="preview"
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '2px solid #b45309', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', display: 'block' }}>✅ ፎቶ ተመርጧል (Photo Selected)</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {newCakePhoto.startsWith('data:') ? 'Uploaded photo (compressed)' : newCakePhoto.replace(/\?.*/, '').split('/').pop()}
                      </span>
                    </div>
                  </div>
                )}
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
                    style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
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
                    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
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
      {/* MODAL 4: DELETE CONFIRMATION MODAL (ADMIN & OWNER ONLY) */}
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
