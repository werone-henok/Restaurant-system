import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  Cake,
  Clock,
  CheckCircle2,
  Play,
  Send,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  History,
  Tag,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Package,
  Calendar,
  Sparkles,
  Camera,
  X,
  FileText,
  Trash2
} from 'lucide-react';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import { resolveImageUrl } from '../../utils/imageUrl';
import { tactileFeedback } from '../../utils/feedback';
import { gToast } from '../../utils/toast';

export const BakeryView: React.FC = () => {
  const { currentBranchId, user, language } = useApp();
  const [activeTab, setActiveTab] = useState<'queue' | 'batches' | 'transfers' | 'inventory' | 'prices' | 'waste'>('queue');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [products, setProducts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [priceSuggestions, setPriceSuggestions] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any>(null);

  // New Production Batch Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariationId, setSelectedVariationId] = useState('');
  const [batchQuantity, setBatchQuantity] = useState<number>(10);
  const [batchPrice, setBatchPrice] = useState<number>(0);
  const [batchPhoto, setBatchPhoto] = useState('');
  const [batchExpDays, setBatchExpDays] = useState<number>(3);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchMarkReady, setBatchMarkReady] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Create Physical Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferVariationId, setTransferVariationId] = useState('');
  const [transferBatchId, setTransferBatchId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(5);
  const [transferNotes, setTransferNotes] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Price Suggestion Modal State
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceVariationId, setPriceVariationId] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);
  const [priceReason, setPriceReason] = useState('');
  const [submittingPrice, setSubmittingPrice] = useState(false);

  // Log Waste Modal State
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [wasteVariationId, setWasteVariationId] = useState('');
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Spoiled');
  const [wasteNotes, setWasteNotes] = useState('');
  const [wastePhoto, setWastePhoto] = useState('');
  const [submittingWaste, setSubmittingWaste] = useState(false);

  // Auto-refresh interval
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.request<any[]>(`/bakery/products?branchId=${currentBranchId}`),
      api.request<any[]>(`/bakery/requests?branchId=${currentBranchId}`),
      api.request<any[]>(`/bakery/batches?branchId=${currentBranchId}`),
      api.request<any[]>(`/bakery/transfers?branchId=${currentBranchId}`),
      api.request<any>(`/bakery/inventory/summary?branchId=${currentBranchId}`),
      api.request<any[]>(`/bakery/price-suggestions?branchId=${currentBranchId}`)
    ])
      .then(([prods, reqs, bts, trfs, inv, ps]) => {
        setProducts(prods || []);
        setRequests(reqs || []);
        setBatches(bts || []);
        setTransfers(trfs || []);
        setInventorySummary(inv || null);
        setPriceSuggestions(ps || []);
      })
      .catch((err) => {
        console.error('Failed to load bakery dashboard:', err);
      })
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [currentBranchId]);

  useEffect(() => {
    loadAll();

    const unsub = api.onEvent((event) => {
      if (
        event?.type === 'BAKERY_REQUEST_NEW' ||
        event?.type === 'BAKERY_REQUEST_UPDATED' ||
        event?.type === 'BAKERY_TRANSFER_PENDING' ||
        event?.type === 'BAKERY_TRANSFER_RECEIVED' ||
        event?.type === 'BAKERY_TRANSFER_REJECTED' ||
        event?.type === 'BAKERY_BATCH_CREATED' ||
        event?.type === 'BAKERY_BATCH_READY' ||
        event?.type === 'BAKERY_STOCK_UPDATED'
      ) {
        loadAll();
      }
    });

    timerRef.current = setInterval(loadAll, 25000);
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadAll]);

  // Handle selected product change in batch modal to auto-populate variations
  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];
  const availableVariations = selectedProduct?.variations || [];
  const selectedVariation = availableVariations.find((v: any) => v.id === selectedVariationId) || availableVariations[0];

  useEffect(() => {
    if (selectedProduct && !selectedProductId) {
      setSelectedProductId(selectedProduct.id);
    }
    if (availableVariations.length > 0 && !selectedVariationId) {
      setSelectedVariationId(availableVariations[0].id);
      setBatchPrice(availableVariations[0].price);
    }
  }, [selectedProduct, availableVariations, selectedProductId, selectedVariationId]);

  // Start production on a request
  const handleStartBaking = async (requestId: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/bakery/requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PRODUCTION' })
      });
      gToast.success(language === 'am' ? 'ምርት ተጀምሯል' : 'Production started');
      loadAll();
    } catch (e: any) {
      gToast.error(e.message || 'Failed to update request');
    }
  };

  // Mark request ready
  const handleMarkRequestReady = async (requestId: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/bakery/requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' })
      });
      gToast.success(language === 'am' ? 'ኬክ ዝግጁ ሆኗል' : 'Marked as Ready in Bakery');
      loadAll();
    } catch (e: any) {
      gToast.error(e.message || 'Failed to update request');
    }
  };

  // Create new production batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedVariationId || batchQuantity <= 0) {
      gToast.error('Please select product, variation, and positive quantity');
      return;
    }

    setSubmittingBatch(true);
    try {
      const expDate = new Date(Date.now() + batchExpDays * 24 * 60 * 60 * 1000).toISOString();
      await api.request('/bakery/batches', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProductId,
          variation_id: selectedVariationId,
          quantity_produced: batchQuantity,
          selling_price: batchPrice || selectedVariation?.price,
          photo_url: batchPhoto || selectedVariation?.photo_url,
          expiration_date: expDate,
          notes: batchNotes,
          mark_ready: batchMarkReady
        })
      });

      tactileFeedback('success');
      gToast.success(batchMarkReady ? 'Batch created and marked ready for transfer!' : 'Production batch started!');
      setShowBatchModal(false);
      setBatchNotes('');
      setBatchPhoto('');
      loadAll();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to create batch');
    } finally {
      setSubmittingBatch(false);
    }
  };

  // Mark an active batch as Ready
  const handleMarkBatchReady = async (batchId: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/bakery/batches/${batchId}/ready`, { method: 'PATCH' });
      gToast.success('Batch is now READY for physical transfer!');
      loadAll();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to mark batch ready');
    }
  };

  // Dispatch physical transfer to Front Counter
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferVariationId || transferQty <= 0) {
      gToast.error('Please select variation and positive quantity');
      return;
    }

    setSubmittingTransfer(true);
    try {
      await api.request('/bakery/transfers', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: transferVariationId,
          batch_id: transferBatchId || null,
          quantity_sent: transferQty,
          notes: transferNotes
        })
      });

      tactileFeedback('success');
      gToast.success('Transfer dispatched! Awaiting Front Counter physical receipt confirmation.');
      setShowTransferModal(false);
      setTransferNotes('');
      loadAll();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to dispatch transfer');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  // Submit price suggestion
  const handleSubmitPriceSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceVariationId || suggestedPrice <= 0 || !priceReason.trim()) {
      gToast.error('Please provide suggested price and reason for management review');
      return;
    }

    setSubmittingPrice(true);
    try {
      await api.request('/bakery/price-suggestions', {
        method: 'POST',
        body: JSON.stringify({
          variation_id: priceVariationId,
          suggested_price: suggestedPrice,
          reason: priceReason
        })
      });

      tactileFeedback('success');
      gToast.success('Price change suggestion submitted to Admin & Owner for review');
      setShowPriceModal(false);
      setPriceReason('');
      loadAll();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to submit price suggestion');
    } finally {
      setSubmittingPrice(false);
    }
  };

  // Log waste in bakery
  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteVariationId || wasteQty <= 0) {
      gToast.error('Please enter variation and quantity');
      return;
    }

    setSubmittingWaste(true);
    try {
      await api.request('/bakery/waste', {
        method: 'POST',
        body: JSON.stringify({
          department: 'BAKERY',
          variation_id: wasteVariationId,
          quantity: wasteQty,
          reason: wasteReason,
          notes: wasteNotes,
          photo_url: wastePhoto
        })
      });

      tactileFeedback('success');
      gToast.success('Bakery loss/waste recorded and stock adjusted');
      setShowWasteModal(false);
      setWasteNotes('');
      setWastePhoto('');
      loadAll();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to log waste');
    } finally {
      setSubmittingWaste(false);
    }
  };

  // Compute pending requests count
  const pendingRequestsCount = requests.filter(r => r.status === 'REQUESTED' || r.status === 'IN_PRODUCTION').length;
  const inTransitCount = transfers.filter(t => t.status === 'PENDING').length;

  return (
    <div className="view-content" style={{ paddingBottom: 90 }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
        color: '#ffffff',
        padding: '24px 20px',
        borderRadius: 20,
        marginBottom: 20,
        boxShadow: '0 10px 25px -5px rgba(180, 83, 9, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26
          }}>
            🍰
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
                Bakery Production Operations
              </h2>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                Live
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
              Production Batches • Physical Transfers • Front Counter Requests
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              tactileFeedback('click');
              setIsRefreshing(true);
              loadAll();
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
              setShowBatchModal(true);
            }}
            className="btn"
            style={{
              background: '#ffffff',
              color: '#92400e',
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
            <Plus size={16} /> New Bake Entry
          </button>
        </div>
      </div>

      {/* Quick KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 12,
        marginBottom: 20
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bakery Stock</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#b45309', marginTop: 4 }}>
            {inventorySummary?.metrics?.total_bakery_units || 0} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Counter Requests</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: pendingRequestsCount > 0 ? '#ef4444' : '#10b981', marginTop: 4 }}>
            {pendingRequestsCount} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>active</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Transit</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: inTransitCount > 0 ? '#f59e0b' : '#64748b', marginTop: 4 }}>
            {inTransitCount} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>pending</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Front Counter</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0284c7', marginTop: 4 }}>
            {inventorySummary?.metrics?.total_counter_units || 0} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>units</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 18,
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'queue', label: 'Production Queue', badge: pendingRequestsCount > 0 ? pendingRequestsCount : null },
          { id: 'batches', label: 'Batches & Baking', badge: batches.filter(b => b.status === 'BAKING').length || null },
          { id: 'transfers', label: 'Physical Transfers', badge: inTransitCount > 0 ? inTransitCount : null },
          { id: 'inventory', label: 'Bakery Inventory', badge: null },
          { id: 'prices', label: 'Price Suggestions', badge: priceSuggestions.filter(p => p.status === 'PENDING').length || null },
          { id: 'waste', label: 'Loss & Waste', badge: null }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              tactileFeedback('click');
              setActiveTab(tab.id as any);
            }}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 13,
              whiteSpace: 'nowrap',
              border: activeTab === tab.id ? '2px solid #b45309' : '1px solid var(--border)',
              background: activeTab === tab.id ? '#fef3c7' : 'var(--bg-card)',
              color: activeTab === tab.id ? '#78350f' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
            {tab.badge !== null && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: 10
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCTION QUEUE & FRONT COUNTER REQUESTS */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
              Front Counter Reorder Requests & Production Queue
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {requests.length} requests
            </span>
          </div>

          {requests.length === 0 ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border)',
              borderRadius: 16,
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <Cake size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No active bake requests</p>
              <span style={{ fontSize: 12 }}>Front Counter will request reorders when stocks run low.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {requests.map(req => {
                const urgencyColors: Record<string, { bg: string; text: string }> = {
                  URGENT: { bg: '#fee2e2', text: '#b91c1c' },
                  HIGH: { bg: '#ffedd5', text: '#c2410c' },
                  NORMAL: { bg: '#e0f2fe', text: '#0369a1' },
                  LOW: { bg: '#f1f5f9', text: '#475569' }
                };
                const urgencyStyle = urgencyColors[req.urgency] || urgencyColors.NORMAL;

                return (
                  <div
                    key={req.id}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 18,
                      border: '1px solid var(--border)',
                      padding: 16,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: urgencyStyle.bg,
                          color: urgencyStyle.text,
                          textTransform: 'uppercase'
                        }}>
                          {req.urgency} Priority
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: req.status === 'READY' ? '#dcfce7' : req.status === 'IN_PRODUCTION' ? '#fef3c7' : '#f1f5f9',
                          color: req.status === 'READY' ? '#166534' : req.status === 'IN_PRODUCTION' ? '#92400e' : '#475569'
                        }}>
                          {req.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{
                          width: 60,
                          height: 60,
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: '#fef3c7',
                          flexShrink: 0
                        }}>
                          {req.product_photo ? (
                            <img src={resolveImageUrl(req.product_photo)} alt={req.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍰</div>
                          )}
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800 }}>{req.product_name}</h4>
                          <span style={{ fontSize: 13, color: '#b45309', fontWeight: 700 }}>{req.variation_name}</span>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Requested by {req.requested_by_name}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        background: 'var(--bg-subtle)',
                        borderRadius: 12,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 6,
                        textAlign: 'center'
                      }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Requested</span>
                          <strong style={{ fontSize: 14, color: '#b45309' }}>{req.quantity_requested}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Counter Stock</span>
                          <strong style={{ fontSize: 14, color: req.current_counter_stock <= req.min_stock_level ? '#ef4444' : 'var(--text-main)' }}>
                            {req.current_counter_stock}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Min Stock</span>
                          <strong style={{ fontSize: 14 }}>{req.min_stock_level}</strong>
                        </div>
                      </div>

                      {req.notes && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          "{req.notes}"
                        </p>
                      )}
                    </div>

                    {/* Action buttons based on status */}
                    <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      {req.status === 'REQUESTED' && (
                        <>
                          <button
                            onClick={() => handleStartBaking(req.id)}
                            className="btn btn-primary"
                            style={{ flex: 1, height: 38, fontSize: 12, fontWeight: 800, background: '#b45309', border: 'none' }}
                          >
                            <Play size={14} /> Start Baking
                          </button>
                        </>
                      )}

                      {req.status === 'IN_PRODUCTION' && (
                        <button
                          onClick={() => handleMarkRequestReady(req.id)}
                          className="btn"
                          style={{ flex: 1, height: 38, fontSize: 12, fontWeight: 800, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10 }}
                        >
                          <CheckCircle2 size={14} /> Mark Ready
                        </button>
                      )}

                      {(req.status === 'READY' || req.status === 'IN_PRODUCTION') && (
                        <button
                          onClick={() => {
                            tactileFeedback('click');
                            setTransferVariationId(req.variation_id);
                            setTransferQty(req.quantity_requested);
                            setShowTransferModal(true);
                          }}
                          className="btn"
                          style={{
                            flex: 1,
                            height: 38,
                            fontSize: 12,
                            fontWeight: 800,
                            background: '#0284c7',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <Send size={14} /> Create Transfer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRODUCTION BATCHES & ACTIVE BAKING */}
      {activeTab === 'batches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Active Production & Batches</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>FIFO prioritization: older batches should be transferred first</span>
            </div>
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowBatchModal(true);
              }}
              className="btn btn-primary"
              style={{ background: '#b45309', border: 'none', height: 38, fontSize: 12, fontWeight: 800 }}
            >
              <Plus size={14} /> New Batch
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {batches.map(batch => (
              <div
                key={batch.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 18,
                  border: '1px solid var(--border)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', color: '#b45309' }}>
                      {batch.batch_number}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: batch.status === 'READY' ? '#dcfce7' : '#fef3c7',
                      color: batch.status === 'READY' ? '#15803d' : '#92400e'
                    }}>
                      {batch.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', background: '#fef3c7', flexShrink: 0 }}>
                      {batch.photo_url ? (
                        <img src={resolveImageUrl(batch.photo_url)} alt={batch.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍰</div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800 }}>{batch.product_name}</h4>
                      <span style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>{batch.variation_name}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Baker: {batch.baker_name}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    fontSize: 11,
                    textAlign: 'center'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Produced</span>
                      <strong style={{ display: 'block', fontSize: 13 }}>{batch.quantity_produced}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Transferred</span>
                      <strong style={{ display: 'block', fontSize: 13, color: '#0284c7' }}>{batch.quantity_transferred}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
                      <strong style={{ display: 'block', fontSize: 13, color: '#b45309' }}>{batch.quantity_remaining}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Expires: {new Date(batch.expiration_date).toLocaleDateString()}</span>
                    <span style={{
                      fontWeight: 700,
                      color: batch.freshness_status === 'EXPIRED' ? '#ef4444' : batch.freshness_status === 'EXPIRING_SOON' ? '#f59e0b' : '#10b981'
                    }}>
                      {batch.freshness_status === 'EXPIRED' ? '⚠️ EXPIRED' : batch.freshness_status === 'EXPIRING_SOON' ? '⏳ EXPIRING SOON' : '✓ FRESH'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  {batch.status === 'BAKING' && (
                    <button
                      onClick={() => handleMarkBatchReady(batch.id)}
                      className="btn"
                      style={{ flex: 1, height: 36, fontSize: 12, fontWeight: 800, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10 }}
                    >
                      <CheckCircle2 size={14} /> Mark Ready for Transfer
                    </button>
                  )}

                  {batch.status === 'READY' && batch.quantity_remaining > 0 && (
                    <button
                      onClick={() => {
                        tactileFeedback('click');
                        setTransferVariationId(batch.variation_id);
                        setTransferBatchId(batch.id);
                        setTransferQty(Math.min(batch.quantity_remaining, 5));
                        setShowTransferModal(true);
                      }}
                      className="btn btn-primary"
                      style={{ flex: 1, height: 36, fontSize: 12, fontWeight: 800, background: '#0284c7', border: 'none', borderRadius: 10 }}
                    >
                      <Send size={14} /> Transfer to Counter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PHYSICAL TRANSFERS (BAKERY -> FRONT CAKE COUNTER) */}
      {activeTab === 'transfers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Physical Transfers to Front Cake Counter</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Products remain in transit until Front Counter staff verifies and confirms receipt
              </span>
            </div>
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowTransferModal(true);
              }}
              className="btn btn-primary"
              style={{ background: '#0284c7', border: 'none', height: 38, fontSize: 12, fontWeight: 800 }}
            >
              <Send size={14} /> New Transfer
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Transfer #</th>
                    <th style={{ padding: '12px 14px' }}>Product & Variation</th>
                    <th style={{ padding: '12px 14px' }}>Sent</th>
                    <th style={{ padding: '12px 14px' }}>Received</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Sent By / Time</th>
                    <th style={{ padding: '12px 14px' }}>Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No transfers recorded yet
                      </td>
                    </tr>
                  ) : (
                    transfers.map(trf => {
                      const statusStyles: Record<string, { bg: string; text: string }> = {
                        RECEIVED: { bg: '#dcfce7', text: '#15803d' },
                        PENDING: { bg: '#fef3c7', text: '#b45309' },
                        IN_TRANSIT: { bg: '#e0f2fe', text: '#0369a1' },
                        REJECTED: { bg: '#fee2e2', text: '#b91c1c' },
                        CANCELLED: { bg: '#f1f5f9', text: '#64748b' }
                      };
                      const st = statusStyles[trf.status] || statusStyles.PENDING;

                      return (
                        <tr key={trf.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 800 }}>{trf.transfer_number}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <strong style={{ display: 'block' }}>{trf.product_name}</strong>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trf.variation_name}</span>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#b45309' }}>{trf.quantity_sent}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#16a34a' }}>{trf.quantity_received}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: st.bg,
                              color: st.text
                            }}>
                              {trf.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                            {trf.created_by_name} <br />
                            {new Date(trf.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12 }}>
                            {trf.received_by_name || '—'}
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

      {/* TAB 4: BAKERY INVENTORY */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Current Physical Stock in Bakery</h3>
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowWasteModal(true);
              }}
              className="btn btn-secondary"
              style={{ height: 38, fontSize: 12, fontWeight: 700 }}
            >
              <Trash2 size={14} /> Log Spoilage / Waste
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {inventorySummary?.variations?.map((item: any) => (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800 }}>{item.product_name}</h4>
                      <span style={{ fontSize: 13, color: '#b45309', fontWeight: 700 }}>{item.variation_name}</span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: item.bakery_stock > 0 ? '#dcfce7' : '#fee2e2',
                      color: item.bakery_stock > 0 ? '#15803d' : '#b91c1c'
                    }}>
                      {item.bakery_stock > 0 ? `${item.bakery_stock} in Bakery` : 'Out of Stock'}
                    </span>
                  </div>

                  <div style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                    fontSize: 11,
                    textAlign: 'center'
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Bakery</span>
                      <strong style={{ display: 'block', fontSize: 14, color: '#b45309' }}>{item.bakery_stock}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Counter</span>
                      <strong style={{ display: 'block', fontSize: 14, color: '#0284c7' }}>{item.counter_stock}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>In Transit</span>
                      <strong style={{ display: 'block', fontSize: 14, color: '#f59e0b' }}>{item.in_transit_stock}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      tactileFeedback('click');
                      setTransferVariationId(item.id);
                      setTransferQty(Math.min(item.bakery_stock, 5) || 1);
                      setShowTransferModal(true);
                    }}
                    disabled={item.bakery_stock <= 0}
                    className="btn btn-primary"
                    style={{ flex: 1, height: 36, fontSize: 12, fontWeight: 800, background: '#0284c7', border: 'none' }}
                  >
                    Transfer to Counter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PRICE SUGGESTIONS */}
      {activeTab === 'prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Price Suggestion Workflow</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Bakery submits price-change proposals with reason; official selling prices require Admin/Owner approval
              </span>
            </div>
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowPriceModal(true);
              }}
              className="btn btn-primary"
              style={{ background: '#b45309', border: 'none', height: 38, fontSize: 12, fontWeight: 800 }}
            >
              <DollarSign size={14} /> Suggest New Price
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Product & Variation</th>
                    <th style={{ padding: '12px 14px' }}>Current Price</th>
                    <th style={{ padding: '12px 14px' }}>Suggested Price</th>
                    <th style={{ padding: '12px 14px' }}>Justification Reason</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Suggested By</th>
                    <th style={{ padding: '12px 14px' }}>Admin Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {priceSuggestions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No price suggestions submitted yet
                      </td>
                    </tr>
                  ) : (
                    priceSuggestions.map(ps => (
                      <tr key={ps.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <strong style={{ display: 'block' }}>{ps.product_name}</strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ps.variation_name}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700 }}>{ps.current_price} ETB</td>
                        <td style={{ padding: '12px 14px', fontWeight: 800, color: '#b45309' }}>{ps.suggested_price} ETB</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, maxWidth: 220 }}>"{ps.reason}"</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: ps.status === 'APPROVED' ? '#dcfce7' : ps.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                            color: ps.status === 'APPROVED' ? '#15803d' : ps.status === 'REJECTED' ? '#b91c1c' : '#92400e'
                          }}>
                            {ps.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12 }}>{ps.suggested_by_name}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12 }}>
                          {ps.reviewed_by_name ? `${ps.reviewed_by_name} (${ps.approved_price || ps.current_price} ETB)` : 'Pending Review'}
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

      {/* TAB 6: WASTE & SPOILAGE */}
      {activeTab === 'waste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Bakery Spoilage, Damage & Loss Records</h3>
            <button
              onClick={() => {
                tactileFeedback('click');
                setShowWasteModal(true);
              }}
              className="btn btn-secondary"
              style={{ height: 38, fontSize: 12, fontWeight: 700 }}
            >
              <Trash2 size={14} /> Log Spoilage / Loss
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
              All lost or damaged cakes decrease inventory via auditable records with timestamp and actor tracking.
            </p>
            <button
              onClick={() => setShowWasteModal(true)}
              className="btn btn-primary"
              style={{ background: '#b45309', border: 'none', height: 44, fontSize: 14, fontWeight: 800 }}
            >
              <Plus size={16} /> Record Cake Loss / Damage
            </button>
          </div>
        </div>
      )}

      {/* MODAL: NEW PRODUCTION BATCH */}
      {showBatchModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            maxWidth: 520,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🍰</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Create Production Entry</h3>
              </div>
              <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const prod = products.find(p => p.id === e.target.value);
                    if (prod && prod.variations?.length > 0) {
                      setSelectedVariationId(prod.variations[0].id);
                      setBatchPrice(prod.variations[0].price);
                    }
                  }}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Size & Variation</label>
                <select
                  value={selectedVariationId}
                  onChange={(e) => {
                    setSelectedVariationId(e.target.value);
                    const v = availableVariations.find((item: any) => item.id === e.target.value);
                    if (v) setBatchPrice(v.price);
                  }}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                >
                  {availableVariations.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.variation_name} — {v.flavor_type || ''} ({v.price} ETB)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Quantity Produced</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input"
                    style={{ width: '100%', height: 42 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Selling Price (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={batchPrice}
                    onChange={(e) => setBatchPrice(parseFloat(e.target.value) || 0)}
                    className="input"
                    style={{ width: '100%', height: 42 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Freshness Shelf Life (Days to Expiry)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={batchExpDays}
                  onChange={(e) => setBatchExpDays(Math.max(1, parseInt(e.target.value) || 3))}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Product Photo</label>
                <ImageUploadCompressor
                  value={batchPhoto}
                  onChange={setBatchPhoto}
                  label="Upload Cake Photo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Production Notes / Ingredients</label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="e.g. Belgian cocoa, gluten-free base, special morning batch"
                  className="input"
                  rows={2}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-subtle)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <input
                  type="checkbox"
                  id="markReadyCheckbox"
                  checked={batchMarkReady}
                  onChange={(e) => setBatchMarkReady(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#b45309', cursor: 'pointer' }}
                />
                <label htmlFor="markReadyCheckbox" style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Mark Ready for Sale Immediately
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                    Adds to Bakery Inventory and makes eligible for physical transfer to Front Counter
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 46 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBatch}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 46, background: '#b45309', border: 'none', fontWeight: 800 }}
                >
                  {submittingBatch ? 'Saving...' : 'Save Production Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PHYSICAL TRANSFER */}
      {showTransferModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            maxWidth: 480,
            width: '100%',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🚚</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Dispatch Physical Transfer</h3>
              </div>
              <button onClick={() => setShowTransferModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Physical cakes will be sent to the Front Cake Counter. Front Counter must explicitly confirm physical receipt before inventory moves into sales stock.
            </p>

            <form onSubmit={handleCreateTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Product & Variation</label>
                <select
                  value={transferVariationId}
                  onChange={(e) => setTransferVariationId(e.target.value)}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                >
                  <option value="">Select Variation</option>
                  {inventorySummary?.variations?.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} — {item.variation_name} (In Bakery: {item.bakery_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Quantity to Transfer</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Transfer Notes / Instructions</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Delivered with cooling tray, glass display case replenishment"
                  className="input"
                  style={{ width: '100%', height: 42 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: 46 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="btn btn-primary"
                  style={{ flex: 1, height: 46, background: '#0284c7', border: 'none', fontWeight: 800 }}
                >
                  {submittingTransfer ? 'Dispatching...' : 'Dispatch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRICE CHANGE SUGGESTION */}
      {showPriceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            maxWidth: 480,
            width: '100%',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>💡</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Suggest Price Change</h3>
              </div>
              <button onClick={() => setShowPriceModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitPriceSuggestion} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Product Variation</label>
                <select
                  value={priceVariationId}
                  onChange={(e) => {
                    setPriceVariationId(e.target.value);
                    const item = inventorySummary?.variations?.find((v: any) => v.id === e.target.value);
                    if (item) setSuggestedPrice(item.price);
                  }}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                >
                  <option value="">Select Variation</option>
                  {inventorySummary?.variations?.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} — {item.variation_name} (Current: {item.price} ETB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Suggested New Price (ETB)</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={suggestedPrice}
                  onChange={(e) => setSuggestedPrice(parseFloat(e.target.value) || 0)}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Justification Reason</label>
                <textarea
                  required
                  rows={3}
                  value={priceReason}
                  onChange={(e) => setPriceReason(e.target.value)}
                  placeholder="e.g. Belgian chocolate and imported whipping cream prices rose by 20%"
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowPriceModal(false)} className="btn btn-secondary" style={{ flex: 1, height: 46 }}>Cancel</button>
                <button type="submit" disabled={submittingPrice} className="btn btn-primary" style={{ flex: 1, height: 46, background: '#b45309', border: 'none', fontWeight: 800 }}>
                  {submittingPrice ? 'Submitting...' : 'Submit Suggestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG WASTE */}
      {showWasteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            maxWidth: 480,
            width: '100%',
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🗑️</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Log Bakery Spoilage / Damage</h3>
              </div>
              <button onClick={() => setShowWasteModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleLogWaste} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Variation</label>
                <select
                  value={wasteVariationId}
                  onChange={(e) => setWasteVariationId(e.target.value)}
                  className="input"
                  style={{ width: '100%', height: 42 }}
                >
                  <option value="">Select Variation</option>
                  {inventorySummary?.variations?.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} — {item.variation_name} (In Bakery: {item.bakery_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={wasteQty}
                    onChange={(e) => setWasteQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input"
                    style={{ width: '100%', height: 42 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Reason</label>
                  <select
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    className="input"
                    style={{ width: '100%', height: 42 }}
                  >
                    <option value="Damaged">Damaged / Dropped</option>
                    <option value="Expired">Expired</option>
                    <option value="Spoiled">Spoiled</option>
                    <option value="Overbaked">Overbaked / Burnt</option>
                    <option value="Staff consumption">Staff Tasting / QC</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Notes</label>
                <input
                  type="text"
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="Details of loss"
                  className="input"
                  style={{ width: '100%', height: 42 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowWasteModal(false)} className="btn btn-secondary" style={{ flex: 1, height: 46 }}>Cancel</button>
                <button type="submit" disabled={submittingWaste} className="btn btn-danger" style={{ flex: 1, height: 46, fontWeight: 800 }}>
                  {submittingWaste ? 'Recording...' : 'Deduct Lost Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
