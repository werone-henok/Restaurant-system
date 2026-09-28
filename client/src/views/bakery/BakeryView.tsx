import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { resolveImageUrl } from '../../utils/imageUrl';
import { tactileFeedback } from '../../utils/feedback';
import { gToast } from '../../utils/toast';
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
  Sparkles
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
  status: 'REQUESTED' | 'ACCEPTED' | 'IN_PRODUCTION' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
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

export const BakeryView: React.FC = () => {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'requests' | 'ready' | 'bake_new' | 'waste'>('requests');

  // Operational states
  const [products, setProducts] = useState<Product[]>([]);
  const [requests, setRequests] = useState<BakeRequest[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Bake Modal
  const [selectedCakeForBake, setSelectedCakeForBake] = useState<Variation | null>(null);
  const [bakeQty, setBakeQty] = useState(10);
  const [isStartingBake, setIsStartingBake] = useState(false);

  // Send to Counter Transfer Modal
  const [transferTarget, setTransferTarget] = useState<{ cake: Variation; maxQty: number } | null>(null);
  const [transferQty, setTransferQty] = useState(5);
  const [isDispatchingTransfer, setIsDispatchingTransfer] = useState(false);

  // Simple Waste Modal
  const [wasteTarget, setWasteTarget] = useState<Variation | null>(null);
  const [wasteQty, setWasteQty] = useState(1);
  const [wasteReason, setWasteReason] = useState('🔥 ተቃጥሏል / Burnt');

  const loadData = useCallback(async () => {
    try {
      const [prodData, reqData, batchData] = await Promise.all([
        api.request<any>('/bakery/products').catch(() => ({ data: [] })),
        api.request<any>('/bakery/requests').catch(() => ({ data: [] })),
        api.request<any>('/bakery/batches').catch(() => ({ data: [] }))
      ]);

      setProducts(Array.isArray(prodData) ? prodData : prodData?.data || []);
      setRequests(Array.isArray(reqData) ? reqData : reqData?.data || []);
      setBatches(Array.isArray(batchData) ? batchData : batchData?.data || []);
    } catch (err) {
      console.error('Failed to load bakery kitchen data', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
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

  // All flat cakes
  const allCakes: Variation[] = products.flatMap(p =>
    (p.variations || []).map((v: any) => ({
      ...v,
      name: v.name || v.variation_name || 'Standard',
      bakery_stock: Number(v.bakery_stock ?? 0),
      counter_stock: Number(v.counter_stock ?? 0),
      selling_price: Number(v.selling_price ?? v.price ?? 0),
      product_name: p.name || 'Cake',
      product_name_amharic: p.name_amharic,
      photo_url: p.photo_url || v.photo_url
    }))
  );

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
          selling_price: selectedCakeForBake.selling_price || 200,
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

  // 1-Tap: Log Waste
  const handleLogWaste = async () => {
    if (!wasteTarget) return;
    tactileFeedback('click');
    try {
      await api.request('/bakery/waste', {
        method: 'POST',
        body: JSON.stringify({
          department: 'BAKERY',
          variation_id: wasteTarget.id,
          quantity: wasteQty,
          reason: wasteReason,
          notes: 'Bakery kitchen loss'
        })
      });
      tactileFeedback('success');
      gToast.success('ተመዝግቧል (Waste recorded)');
      setWasteTarget(null);
      loadData();
    } catch (err: any) {
      gToast.error(err.message || 'ስህተት ተፈጥሯል');
    }
  };

  // Counts
  const pendingRequests = requests.filter(r => r.status === 'REQUESTED' || r.status === 'IN_PRODUCTION');
  const activeBakingBatches = batches.filter(b => b.status === 'BAKING');
  const cakesWithBakeryStock = allCakes.filter(c => c.bakery_stock > 0);

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
          alignItems: 'center'
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
              Bakery Kitchen • {user?.username}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            tactileFeedback('click');
            setIsRefreshing(true);
            loadData();
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

      {/* 3 Large Picture-Driven Action Tabs - Optimized for Tablets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
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
            padding: '16px 10px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: activeTab === 'requests' ? '0 8px 20px rgba(180, 83, 9, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 28 }}>🔔</span>
          <span style={{ fontSize: 15, fontWeight: 900 }}>ምን ልጋግር?</span>
          <span style={{ fontSize: 12, opacity: 0.88 }}>Requests ({pendingRequests.length})</span>

          {pendingRequests.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -8,
                right: 8,
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 900,
                width: 28,
                height: 28,
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
            padding: '16px 10px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: activeTab === 'ready' ? '0 8px 20px rgba(2, 132, 199, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 28 }}>🚚</span>
          <span style={{ fontSize: 15, fontWeight: 900 }}>ለካውንተር ላክ</span>
          <span style={{ fontSize: 12, opacity: 0.88 }}>Send to Counter</span>

          {activeBakingBatches.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -8,
                right: 8,
                background: '#f59e0b',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 900,
                width: 28,
                height: 28,
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
            padding: '16px 10px',
            minHeight: 82,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: activeTab === 'bake_new' ? '0 8px 20px rgba(22, 163, 74, 0.35)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{ fontSize: 28 }}>🎂</span>
          <span style={{ fontSize: 15, fontWeight: 900 }}>አዲስ ጋግር</span>
          <span style={{ fontSize: 12, opacity: 0.88 }}>Bake New</span>
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
                Counter has plenty of stock. Tap "አዲስ ጋግር" to bake extra cakes.
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
                    <div
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '14px',
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
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. READY CAKES & SEND TO COUNTER */}
      {/* ========================================================================= */}
      {activeTab === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

          {/* Cakes Available to Send to Counter */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0284c7', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={20} /> የበሰሉ / ለካውንተር መላኪያ (Finished Cakes to Send)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {allCakes.map(cake => {
                const photo = getCakePhoto(cake);
                const hasStock = cake.bakery_stock > 0;

                return (
                  <div
                    key={cake.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 18,
                      border: '2px solid var(--border)',
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        <img
                          src={photo}
                          alt=""
                          style={{ width: 68, height: 68, borderRadius: 14, objectFit: 'cover' }}
                        />
                        <div>
                          <strong style={{ fontSize: 15, color: 'var(--text-main)', display: 'block' }}>
                            {cake.product_name_amharic || cake.product_name}
                          </strong>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cake.name}</span>
                        </div>
                      </div>

                      <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 12, textAlign: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>ዳቦ ቤት ያለ ክምችት</span>
                        <strong style={{ fontSize: 22, color: hasStock ? '#16a34a' : '#ef4444' }}>
                          {cake.bakery_stock} ኬክ አለ
                        </strong>
                      </div>
                    </div>

                    <button
                      disabled={!hasStock}
                      onClick={() => {
                        tactileFeedback('click');
                        setTransferTarget({ cake, maxQty: cake.bakery_stock });
                        setTransferQty(Math.min(cake.bakery_stock, 5));
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
                      ለካውንተር ላክ (Send)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISUAL CAKE PICKER TO BAKE NEW */}
      {/* ========================================================================= */}
      {activeTab === 'bake_new' && (
        <div>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text-muted)', fontWeight: 700 }}>
            የሚጋግሩትን ኬክ ፎቶ ይንኩ (Tap any cake to start baking):
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            {allCakes.map(cake => {
              const photo = getCakePhoto(cake);

              return (
                <div
                  key={cake.id}
                  onClick={() => {
                    tactileFeedback('click');
                    setSelectedCakeForBake(cake);
                    setBakeQty(10);
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: '2px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <div style={{ width: '100%', height: 150, position: 'relative' }}>
                    <img
                      src={photo}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  <div style={{ padding: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: 'var(--text-main)', lineHeight: 1.25 }}>
                      {cake.product_name_amharic || cake.product_name}
                    </h3>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                      {cake.name} {cake.size && `• ${cake.size}`}
                    </div>

                    <button
                      style={{
                        marginTop: 12,
                        width: '100%',
                        padding: '12px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                      }}
                    >
                      <Flame size={16} /> ጋግር (Bake)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
    </div>
  );
};
