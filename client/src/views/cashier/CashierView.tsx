import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Check, Printer, DollarSign, Tag, ShieldAlert, ArrowRight, CreditCard, Banknote, Smartphone, Search, Filter, ShoppingBag, Clock, Sparkles, History, Eye, CheckCircle2 } from 'lucide-react';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { OrderHistoryModal } from '../../components/OrderHistoryModal';
import { gToast } from '../../utils/toast';

export const CashierView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [paymentSplits, setPaymentSplits] = useState<{ method: string; amount: number }[]>([
    { method: 'CASH', amount: 0 }
  ]);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCustomSplit, setShowCustomSplit] = useState(false);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'READY' | 'HISTORY'>('ALL');
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 960);

  // Responsive desktop detection
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 960);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-refresh fallback
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  const loadApprovalHistory = () => {
    setLoadingHistory(true);
    api.request<any[]>(`/orders/history/cashier?branchId=${currentBranchId}`)
      .then(data => setApprovalHistory(data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  const loadOrders = () => {
    api.request<any[]>(`/orders?branchId=${currentBranchId}`)
      .then(data => {
        setOrders(data);
        // If the selected order is updated in the list, keep it synchronized
        if (selectedOrder) {
          const fresh = data.find(o => o.id === selectedOrder.id);
          if (fresh) setSelectedOrder(fresh);
        }
      })
      .catch(() => {});
    loadApprovalHistory();
  };

  useEffect(() => {
    loadCallbackRef.current = loadOrders;
  }, []);



  useEffect(() => {
    loadOrders();
    setIsConnected(api.isConnected);

    const unsub = api.onEvent((event) => {
      if (['ORDER_PENDING_CASHIER', 'ORDER_CONFIRMED', 'ORDER_DELIVERED', 'ORDER_COMPLETED'].includes(event.type)) {
        setTimeout(() => {
          loadCallbackRef.current();
          if (event.type === 'ORDER_PENDING_CASHIER') {
            gToast.info(`📋 New order #${event.payload?.orderNumber} from waiter!`);
          }
        }, 300);
      }
    });

    loadTimerRef.current = setInterval(() => {
      loadCallbackRef.current();
    }, 30000);

    const unsubStatus = api.onStatusChange(setIsConnected);

    return () => {
      unsub();
      unsubStatus();
      if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    };
  }, [currentBranchId]);

  const openOrderModal = (order: any) => {
    setSelectedOrder(order);
    setDiscountAmount(0);
    setDiscountReason('');
    setPaymentSplits([{ method: 'CASH', amount: order.total_amount }]);
    setShowCustomSplit(false);
  };

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      await api.request(`/orders/${selectedOrder.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          discount_amount: discountAmount,
          discount_reason: discountReason
        })
      });
      gToast.success(language === 'am' ? 'ትዕዛዙ ተረጋግጦ ወደ ማብሰያ ተልኳል' : 'Order confirmed and routed');
      setSelectedOrder(null);
      loadOrders();
    } catch (err: any) {
      gToast.error(err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const res = await api.request<any>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          order_id: selectedOrder.id,
          splits: paymentSplits
        })
      });
      gToast.success(t('payment_success') || 'ክፍያው በተሳካ ሁኔታ ተጠናቋል!');
      setReceipt(res.receiptContent);
      setSelectedOrder(null);
      loadOrders();
    } catch (err: any) {
      gToast.error(err.message || 'Payment settlement failed');
    } finally {
      setLoading(false);
    }
  };

  // Filter orders
  const matchesSearch = (o: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const orderNum = String(o.order_number || '');
    const waiter = String(o.waiter_name || '').toLowerCase();
    const table = String(o.table_number || '').toLowerCase();
    return orderNum.includes(q) || waiter.includes(q) || table.includes(q);
  };

  const pendingConfirmOrders = orders.filter(o => o.status === 'PENDING_CASHIER' && matchesSearch(o));
  const readyToPayOrders = orders.filter(o => ['DELIVERED', 'CONFIRMED', 'READY', 'PREPARING'].includes(o.status) && matchesSearch(o));

  // Billing Panel Content (Used for both Desktop Right-Side and Mobile Drawer)
  const renderSettlementPanel = () => {
    if (!selectedOrder) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--bg-subtle, #f8fafc)',
          borderRadius: 16,
          border: '2px dashed var(--border)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(249, 115, 22, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            marginBottom: 16
          }}>
            <ShoppingBag size={32} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
            {language === 'am' ? 'ትዕዛዝ ይምረጡ' : 'Select an Order'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280, margin: 0 }}>
            {language === 'am'
              ? 'ዝርዝሩን ለማየት፣ ቅናሽ ለመስጠት ወይም ክፍያ ለመቀበል ከግራ በኩል ትዕዛዝ ይምረጡ።'
              : 'Click any order from the queue on the left to review, confirm, apply discounts, or settle bill.'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <span className="badge badge-pending">
              {pendingConfirmOrders.length} {language === 'am' ? 'ማረጋገጫ የሚጠብቅ' : 'Pending'}
            </span>
            <span className="badge badge-success">
              {readyToPayOrders.length} {language === 'am' ? 'ክፍያ ዝግጁ' : 'Ready to Bill'}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        {/* Panel Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {language === 'am' ? `ትዕዛዝ #${selectedOrder.order_number}` : `Order #${selectedOrder.order_number}`}
              </h3>
              <span className={`badge ${selectedOrder.status === 'PENDING_CASHIER' ? 'badge-pending' : 'badge-success'}`}>
                {selectedOrder.status === 'PENDING_CASHIER' 
                  ? (language === 'am' ? 'ማረጋገጫ ይጠብቃል' : 'Review & Confirm')
                  : (language === 'am' ? 'ክፍያ ዝግጁ' : 'Ready to Bill')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: <strong>{selectedOrder.waiter_name}</strong> • {selectedOrder.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${selectedOrder.table_number}` : selectedOrder.order_type}
            </div>
          </div>
          <button
            onClick={() => setSelectedOrder(null)}
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4
            }}
          >
            ✕
          </button>
        </div>

        {/* Items Breakdown */}
        <div style={{ background: 'var(--bg-subtle, #f8fafc)', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            {language === 'am' ? 'የታዘዙ ምግቦችና መጠጦች' : 'Ordered Items'}
          </div>
          {selectedOrder.items?.map((it: any) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-main)' }}>
                  {it.quantity}x {it.name_amharic || it.name}
                </span>
                {it.name_amharic && it.name && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                    {it.name}
                  </span>
                )}
                {it.notes && (
                  <span style={{ display: 'block', fontSize: 11, color: '#ea580c', fontWeight: 600 }}>
                    📝 {it.notes}
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{it.price * it.quantity} {t('currency')}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
            <span>{language === 'am' ? 'ጠቅላላ ሂሳብ (ከቫት ጋር)' : 'Total Bill (incl. VAT)'}</span>
            <span style={{ color: 'var(--primary)' }}>{selectedOrder.total_amount} {t('currency')}</span>
          </div>
        </div>

        {selectedOrder.status === 'PENDING_CASHIER' ? (
          <div>
            {/* Discount */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? `ቅናሽ ይስጡ (${t('currency')})` : `Apply Discount (${t('currency')})`}
              </label>
              <input
                type="number"
                value={discountAmount}
                onChange={e => setDiscountAmount(Number(e.target.value))}
                placeholder="0.00"
                style={{ width: '100%', marginBottom: 6, height: 42 }}
              />
              {discountAmount > 0 && (
                <input
                  type="text"
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder={language === 'am' ? 'የቅናሽ ምክንያት (ለምሳሌ፡ የክብር እንግዳ፣ ማናጀር)' : 'Discount reason (e.g. VIP guest, Manager promo)'}
                  style={{ width: '100%', height: 42 }}
                />
              )}
            </div>

            <button
              disabled={loading}
              onClick={handleConfirmOrder}
              className="btn btn-primary btn-block"
              style={{ height: 50, fontSize: 15, fontWeight: 800 }}
            >
              <Check size={20} />
              {loading ? (language === 'am' ? 'በማረጋገጥ ላይ...' : 'Confirming...') : (language === 'am' ? 'ትዕዛዙን አረጋግጥና ላክ' : t('confirm_and_route'))}
            </button>
          </div>
        ) : (
          <div>
            {/* 1-Tap Payment Selector */}
            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 10 }}>
              {language === 'am' ? 'የክፍያ ዘዴ ይምረጡ (አንድ ጊዜ ይንኩ)' : 'Select Payment Method (1-Tap)'}
            </label>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentSplits([{ method: 'CASH', amount: selectedOrder.total_amount }]);
                  setShowCustomSplit(false);
                }}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: paymentSplits.length === 1 && paymentSplits[0].method === 'CASH' ? '2.5px solid #10b981' : '1.5px solid var(--border)',
                  background: paymentSplits.length === 1 && paymentSplits[0].method === 'CASH' ? '#ecfdf5' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 26 }}>💵</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#065f46' }}>ጥሬ ገንዘብ (Cash)</span>
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>{selectedOrder.total_amount} {t('currency')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentSplits([{ method: 'TELEBIRR', amount: selectedOrder.total_amount }]);
                  setShowCustomSplit(false);
                }}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: paymentSplits.length === 1 && paymentSplits[0].method === 'TELEBIRR' ? '2.5px solid #eab308' : '1.5px solid var(--border)',
                  background: paymentSplits.length === 1 && paymentSplits[0].method === 'TELEBIRR' ? '#fefce8' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 26 }}>📱</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#854d0e' }}>ቴሌብር (Telebirr)</span>
                <span style={{ fontSize: 12, color: '#ca8a04', fontWeight: 700 }}>{selectedOrder.total_amount} {t('currency')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentSplits([{ method: 'CBE_BIRR', amount: selectedOrder.total_amount }]);
                  setShowCustomSplit(false);
                }}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: paymentSplits.length === 1 && paymentSplits[0].method === 'CBE_BIRR' ? '2.5px solid #8b5cf6' : '1.5px solid var(--border)',
                  background: paymentSplits.length === 1 && paymentSplits[0].method === 'CBE_BIRR' ? '#f5f3ff' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 26 }}>🏦</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#5b21b6' }}>ሲቢኢ ብር (CBE)</span>
                <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>{selectedOrder.total_amount} {t('currency')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentSplits([{ method: 'CARD', amount: selectedOrder.total_amount }]);
                  setShowCustomSplit(false);
                }}
                style={{
                  padding: '14px 10px',
                  borderRadius: 12,
                  border: paymentSplits.length === 1 && paymentSplits[0].method === 'CARD' ? '2.5px solid #3b82f6' : '1.5px solid var(--border)',
                  background: paymentSplits.length === 1 && paymentSplits[0].method === 'CARD' ? '#eff6ff' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 26 }}>💳</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1e40af' }}>ካርድ (POS Card)</span>
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{selectedOrder.total_amount} {t('currency')}</span>
              </button>
            </div>

            {/* Split payment toggle */}
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setShowCustomSplit(!showCustomSplit)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0
                }}
              >
                {showCustomSplit 
                  ? (language === 'am' ? '▲ አንድ ወጥ ክፍያ ተጠቀም' : '▲ Use 1-Tap Payment') 
                  : (language === 'am' ? '▼ የተከፈለ ክፍያ (ጥሬ ገንዘብ + ቴሌብር ወዘተ)' : '▼ Split Bill (e.g. Cash + Telebirr)')}
              </button>

              {showCustomSplit && (
                <div style={{ marginTop: 10, background: 'var(--bg-subtle, #f8fafc)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'የተከፋፈሉ ክፍያዎች:' : 'Split Amounts:'}
                  </div>
                  {paymentSplits.map((split, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select
                        value={split.method}
                        onChange={e => {
                          const updated = [...paymentSplits];
                          updated[index].method = e.target.value;
                          setPaymentSplits(updated);
                        }}
                        style={{ flex: 1, padding: 8, borderRadius: 8, fontSize: 12 }}
                      >
                        <option value="CASH">ጥሬ ገንዘብ (Cash)</option>
                        <option value="TELEBIRR">ቴሌብር (Telebirr)</option>
                        <option value="CBE_BIRR">ሲቢኢ ብር (CBE Birr)</option>
                        <option value="CARD">ካርድ (POS Card)</option>
                      </select>
                      <input
                        type="number"
                        value={split.amount || ''}
                        onChange={e => {
                          const updated = [...paymentSplits];
                          updated[index].amount = Number(e.target.value);
                          setPaymentSplits(updated);
                        }}
                        placeholder="ETB"
                        style={{ width: 100, padding: 8, borderRadius: 8, fontSize: 12 }}
                      />
                      {paymentSplits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPaymentSplits(paymentSplits.filter((_, i) => i !== index))}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '0 10px', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPaymentSplits([...paymentSplits, { method: 'TELEBIRR', amount: 0 }])}
                    style={{
                      background: 'none',
                      border: '1px dashed var(--border)',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      width: '100%',
                      marginTop: 4
                    }}
                  >
                    + {language === 'am' ? 'ሌላ የክፍያ ዘዴ ጨምር' : 'Add Split Payment Method'}
                  </button>
                </div>
              )}
            </div>

            <button
              disabled={loading}
              onClick={handleProcessPayment}
              className="btn btn-success btn-block"
              style={{ height: 52, fontSize: 16, fontWeight: 800 }}
            >
              <DollarSign size={20} />
              {loading 
                ? (language === 'am' ? 'በማስተናገድ ላይ...' : 'Processing...') 
                : (language === 'am' ? `ክፍያውን አጠናቅቅ (${selectedOrder.total_amount} ${t('currency')})` : `${t('process_payment')} (${selectedOrder.total_amount} ${t('currency')})`)}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="view-body animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            {language === 'am' ? 'የካሸር የክፍያ እንትዕዛዝ መስኮት' : 'Cashier Operations'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isDesktop ? '🖥️ Desktop POS Terminal Mode' : '📱 Mobile POS'}
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 700,
          background: isConnected ? '#ecfdf5' : '#fef2f2',
          color: isConnected ? '#065f46' : '#991b1b',
          border: `1px solid ${isConnected ? '#a7f3d0' : '#fca5a5'}`
        }}>
          {isConnected ? '🟢 Live Connected' : '🔴 Offline'}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'am' ? 'በትዕዛዝ ቁጥር፣ አስተናጋጅ ወይም ጠረጴዛ ይፈልጉ...' : 'Search order #, waiter, table...'}
            style={{ width: '100%', paddingLeft: 36, height: 40, borderRadius: 10, fontSize: 13 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setFilterTab('ALL')}
            className={`btn ${filterTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 10 }}
          >
            {language === 'am' ? 'ሁሉም' : 'All'} ({pendingConfirmOrders.length + readyToPayOrders.length})
          </button>
          <button
            onClick={() => setFilterTab('PENDING')}
            className={`btn ${filterTab === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 10 }}
          >
            🔔 {language === 'am' ? 'ማረጋገጫ' : 'Confirm'} ({pendingConfirmOrders.length})
          </button>
          <button
            onClick={() => setFilterTab('READY')}
            className={`btn ${filterTab === 'READY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 10 }}
          >
            💳 {language === 'am' ? 'ክፍያ' : 'Settle'} ({readyToPayOrders.length})
          </button>
          <button
            onClick={() => { setFilterTab('HISTORY'); loadApprovalHistory(); }}
            className={`btn ${filterTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 700, borderRadius: 10 }}
          >
            📜 {language === 'am' ? 'የማረጋገጫ ታሪክ' : 'Approval History'} ({approvalHistory.length})
          </button>
        </div>
      </div>

      {/* Main Grid: Responsive 2-Column on Desktop */}
      <div className="cashier-pos-grid">
        {/* Left Column: Order Stream */}
        <div className="cashier-orders-column">
          {/* Pending Confirmation Alert Section */}
          {(filterTab === 'ALL' || filterTab === 'PENDING') && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'am' ? `🔔 ማረጋገጫ የሚጠብቁ አዳዲስ ትዕዛዞች (${pendingConfirmOrders.length})` : `New Orders Awaiting Confirmation (${pendingConfirmOrders.length})`}
                </span>
              </div>

              {pendingConfirmOrders.length === 0 ? (
                <div style={{ background: '#ffffff', border: '1px dashed var(--border)', borderRadius: 14, padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {language === 'am' ? 'ምንም ማረጋገጫ የሚጠብቅ ትዕዛዝ የለም' : 'No incoming orders pending confirmation'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingConfirmOrders.map(o => {
                    const isSelected = selectedOrder?.id === o.id;
                    return (
                      <div
                        key={o.id}
                        onClick={() => openOrderModal(o)}
                        style={{
                          background: isSelected ? 'rgba(249, 115, 22, 0.04)' : '#ffffff',
                          border: isSelected ? '2px solid var(--primary)' : '1.5px solid #f97316',
                          borderRadius: 14,
                          padding: 14,
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 800 }}>ትዕዛዝ #{o.order_number}</span>
                          <span className="badge badge-pending">
                            {language === 'am' ? 'ማረጋገጫ ይጠብቃል' : 'Review & Confirm'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                          {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: <strong>{o.waiter_name}</strong> • {language === 'am' ? 'ጠረጴዛ' : 'Table'}: <strong>{o.table_number || o.order_type}</strong>
                        </div>
                        <div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: 8, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                          {o.items?.map((it: any) => (
                            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ fontWeight: 600 }}>{it.quantity}x {it.name_amharic || it.name}</span>
                              <span>{it.price * it.quantity} {t('currency')}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>
                            {language === 'am' ? 'ጠቅላላ' : 'Total'}: {o.total_amount} {t('currency')}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrderModal(o);
                            }}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}
                          >
                            {language === 'am' ? 'መርምርና አረጋግጥ' : 'Review & Confirm'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Settle Payment Section */}
          {(filterTab === 'ALL' || filterTab === 'READY') && (
            <div>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                {language === 'am' ? `💳 ሂሳብ ለመቀበል ዝግጁ የሆኑ (${readyToPayOrders.length})` : `Active Orders for Payment Settlement (${readyToPayOrders.length})`}
              </span>
              {readyToPayOrders.length === 0 ? (
                <div style={{ background: '#ffffff', border: '1px dashed var(--border)', borderRadius: 14, padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {language === 'am' ? 'ምንም ክፍያ የሚጠብቅ ትዕዛዝ የለም' : 'No active orders awaiting settlement'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {readyToPayOrders.map(o => {
                    const isSelected = selectedOrder?.id === o.id;
                    return (
                      <div
                        key={o.id}
                        onClick={() => openOrderModal(o)}
                        style={{
                          background: isSelected ? 'rgba(16, 185, 129, 0.04)' : '#ffffff',
                          border: isSelected ? '2px solid #10b981' : '1px solid var(--border)',
                          borderRadius: 14,
                          padding: 14,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 15, fontWeight: 800, display: 'block' }}>ትዕዛዝ #{o.order_number}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {o.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${o.table_number}` : o.order_type} • <strong style={{ color: '#059669' }}>{o.status}</strong>
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', display: 'block', marginTop: 3 }}>
                            {o.total_amount} {t('currency')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderModal(o);
                          }}
                          className="btn btn-success"
                          style={{ padding: '10px 18px', fontSize: 14, fontWeight: 800 }}
                        >
                          <DollarSign size={16} /> {language === 'am' ? 'ሂሳብ ተቀበል' : 'Settle Bill'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Approval History Section */}
          {filterTab === 'HISTORY' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'am' ? `📜 በእርስዎ የተረጋገጡ ትዕዛዞች (${approvalHistory.filter(o => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    const orderNum = String(o.order_number || '');
                    const waiter = String(o.waiter_name || '').toLowerCase();
                    const table = String(o.table_number || '').toLowerCase();
                    const items = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                    return orderNum.includes(q) || waiter.includes(q) || table.includes(q) || items;
                  }).length})` : `Orders Approved / Released by You (${approvalHistory.filter(o => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    const orderNum = String(o.order_number || '');
                    const waiter = String(o.waiter_name || '').toLowerCase();
                    const table = String(o.table_number || '').toLowerCase();
                    const items = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                    return orderNum.includes(q) || waiter.includes(q) || table.includes(q) || items;
                  }).length})`}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {language === 'am' ? 'የቅርብ ጊዜ በቅድሚያ' : 'Newest first'}
                </span>
              </div>

              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 8 }}>🔄</div>
                  <div>{language === 'am' ? 'የማረጋገጫ ታሪክ በመጫን ላይ...' : 'Loading approval history...'}</div>
                </div>
              ) : approvalHistory.filter(o => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                const orderNum = String(o.order_number || '');
                const waiter = String(o.waiter_name || '').toLowerCase();
                const table = String(o.table_number || '').toLowerCase();
                const items = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                return orderNum.includes(q) || waiter.includes(q) || table.includes(q) || items;
              }).length === 0 ? (
                <div style={{ background: '#ffffff', border: '1px dashed var(--border)', borderRadius: 14, padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <History size={36} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 700 }}>{language === 'am' ? 'ምንም የማረጋገጫ ታሪክ አልተገኘም' : 'No approval history found'}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>{language === 'am' ? 'ያረጋገጧቸውና የለቀቋቸው ትዕዛዞች እዚህ ይመዘገባሉ' : 'Orders you confirm and release will appear here.'}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {approvalHistory.filter(o => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    const orderNum = String(o.order_number || '');
                    const waiter = String(o.waiter_name || '').toLowerCase();
                    const table = String(o.table_number || '').toLowerCase();
                    const items = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                    return orderNum.includes(q) || waiter.includes(q) || table.includes(q) || items;
                  }).map(o => (
                    <div
                      key={o.id}
                      onClick={() => setSelectedHistoryOrder(o)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 14,
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            background: '#0284c7', color: '#fff',
                            fontWeight: 800, fontSize: 12, padding: '2px 8px', borderRadius: 6
                          }}>
                            #{o.order_number}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: 14 }}>
                            {o.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${o.table_number}` : o.order_type}
                          </span>
                          {o.waiter_name && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              • {o.waiter_name}
                            </span>
                          )}
                        </div>
                        <UniversalStatusBadge status={o.status} size="sm" />
                      </div>

                      {/* Approval time and items summary */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                        <span>
                          {o.approval_at ? (
                            <span style={{ color: '#0369a1', fontWeight: 600 }}>
                              ✓ {language === 'am' ? 'የተረጋገጠበት:' : 'Approved:'} {new Date(o.approval_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            new Date(o.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          )}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {o.items?.length || 0} {language === 'am' ? 'ምግቦች' : 'items'}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-main)', background: '#f8fafc', padding: '6px 10px', borderRadius: 8, marginBottom: 8 }}>
                        {o.items?.map((it: any, idx: number) => (
                          <span key={it.id || idx}>
                            {it.quantity}x {language === 'am' && it.name_amharic ? it.name_amharic : (it.menu_name || it.name)}{idx < o.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>
                          {(o.total_amount || 0).toLocaleString()} {t('currency')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedHistoryOrder(o); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 8,
                            background: '#eff6ff', color: '#1d4ed8',
                            border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={13} /> {language === 'am' ? 'ዝርዝር ይመልከቱ' : 'View Details'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (Desktop Billing Workstation) */}
        {isDesktop && (
          <div className="cashier-billing-panel">
            {renderSettlementPanel()}
          </div>
        )}
      </div>

      {/* Mobile Modal Drawer (Only shown on small screens < 960px) */}
      {!isDesktop && selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: 540,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: '90vh',
            overflowY: 'auto'
          }} className="animate-fade-in">
            {renderSettlementPanel()}
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal (Shared by Desktop & Mobile) */}
      {receipt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 60
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 380,
            fontFamily: 'monospace',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0' }}>HABESHA GOURMET & LOUNGE</h3>
              <p style={{ fontSize: 11, color: '#666', margin: 0 }}>Bole Medhanealem Road, Addis Ababa</p>
              <p style={{ fontSize: 11, color: '#666', margin: 0 }}>TIN: 102948190 • VAT Reg: 015</p>
              <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }} />
              <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 2px 0' }}>RECEIPT: {receipt.receiptNumber}</p>
              <p style={{ fontSize: 11, margin: 0 }}>Order #{receipt.orderNumber} • Cashier: {receipt.cashier}</p>
            </div>

            <div style={{ borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>{receipt.subtotal} ETB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VAT (15%):</span>
                <span>{receipt.taxAmount} ETB</span>
              </div>
              {receipt.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red' }}>
                  <span>Discount:</span>
                  <span>-{receipt.discountAmount} ETB</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                <span>TOTAL PAID:</span>
                <span>{receipt.totalAmount} ETB</span>
              </div>
            </div>

            <div style={{ fontSize: 11, marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>Settled via:</span>
              {receipt.paymentMethods?.map((pm: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>• {pm.method}</span>
                  <span>{pm.amount} ETB</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: 10, color: '#666', borderTop: '1px dashed #000', paddingTop: 8, marginBottom: 14 }}>
              Thank you for your visit! / በጉብኝትዎ እናመሰግናለን!
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} className="btn btn-secondary" style={{ flex: 1 }}>
                <Printer size={16} /> Print Receipt
              </button>
              <button onClick={() => setReceipt(null)} className="btn btn-primary" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History Inspection Modal */}
      {selectedHistoryOrder && (
        <OrderHistoryModal
          order={selectedHistoryOrder}
          onClose={() => setSelectedHistoryOrder(null)}
          role="cashier"
        />
      )}
    </div>
  );
};
