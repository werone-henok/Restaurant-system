import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Check, Printer, DollarSign, Tag, ShieldAlert, ArrowRight, CreditCard, Banknote, Smartphone } from 'lucide-react';
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

  const loadOrders = () => {
    api.request<any[]>(`/orders?branchId=${currentBranchId}`)
      .then(setOrders)
      .catch(() => {});
  };

  useEffect(() => {
    loadOrders();
    const unsub = api.onEvent((event) => {
      if (['ORDER_PENDING_CASHIER', 'ORDER_CONFIRMED', 'ORDER_DELIVERED', 'ORDER_COMPLETED'].includes(event.type)) {
        loadOrders();
      }
    });
    return unsub;
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

  const pendingConfirmOrders = orders.filter(o => o.status === 'PENDING_CASHIER');
  const readyToPayOrders = orders.filter(o => ['DELIVERED', 'CONFIRMED', 'READY', 'PREPARING'].includes(o.status));

  return (
    <div className="view-body animate-fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
        {language === 'am' ? 'የካሸር የክፍያ እና ትዕዛዝ መስኮት' : 'Cashier Operations'}
      </h2>

      {/* Pending Confirmation Alert Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {language === 'am' ? `🔔 ማረጋገጫ የሚጠብቁ አዳዲስ ትዕዛዞች (${pendingConfirmOrders.length})` : `New Orders Awaiting Confirmation (${pendingConfirmOrders.length})`}
          </span>
        </div>

        {pendingConfirmOrders.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px dashed var(--border)', borderRadius: 12, padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {language === 'am' ? 'ምንም ማረጋገጫ የሚጠብቅ ትዕዛዝ የለም' : 'No incoming orders pending confirmation'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingConfirmOrders.map(o => (
              <div key={o.id} style={{ background: '#ffffff', border: '1.5px solid #f97316', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>ትዕዛዝ #{o.order_number}</span>
                  <span className="badge badge-pending">
                    {language === 'am' ? 'ማረጋገጫ ይጠብቃል' : 'Review & Confirm'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: <strong>{o.waiter_name}</strong> • {language === 'am' ? 'ጠረጴዛ' : 'Table'}: <strong>{o.table_number || o.order_type}</strong>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: 8, borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
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
                  <button onClick={() => openOrderModal(o)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
                    {language === 'am' ? 'መርምርና አረጋግጥ' : 'Review & Confirm'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settle Payment Section */}
      <div>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          {language === 'am' ? `💳 ሂሳብ ለመቀበል ዝግጁ የሆኑ (${readyToPayOrders.length})` : `Active Orders for Payment Settlement (${readyToPayOrders.length})`}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {readyToPayOrders.map(o => (
            <div key={o.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, display: 'block' }}>ትዕዛዝ #{o.order_number}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {o.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${o.table_number}` : o.order_type} • {o.status}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', display: 'block', marginTop: 3 }}>
                  {o.total_amount} {t('currency')}
                </span>
              </div>
              <button
                onClick={() => openOrderModal(o)}
                className="btn btn-success"
                style={{ padding: '10px 18px', fontSize: 14, fontWeight: 800 }}
              >
                <DollarSign size={16} /> {language === 'am' ? 'ሂሳብ ተቀበል' : 'Settle Bill'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Review / Payment Modal */}
      {selectedOrder && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>
                {language === 'am' ? `ትዕዛዝ #${selectedOrder.order_number} ዝርዝር` : `Order #${selectedOrder.order_number} Details`}
              </h3>
              <button onClick={() => setSelectedOrder(null)} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>✕</button>
            </div>

            {/* Items Breakdown */}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>
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
              <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>{language === 'am' ? 'ድምር + ቫት' : 'Subtotal + VAT'}</span>
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
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  {discountAmount > 0 && (
                    <input
                      type="text"
                      value={discountReason}
                      onChange={e => setDiscountReason(e.target.value)}
                      placeholder={language === 'am' ? 'የቅናሽ ምክንያት (ለምሳሌ፡ የክብር እንግዳ፣ ማናጀር)' : 'Discount reason (e.g. VIP guest, Manager promo)'}
                      style={{ width: '100%' }}
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
                      cursor: 'pointer'
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
                      cursor: 'pointer'
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
                      cursor: 'pointer'
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
                      border: paymentSplits.length === 1 && paymentSplits[0].method === 'CARD' ? '2.5px solid #0284c7' : '1.5px solid var(--border)',
                      background: paymentSplits.length === 1 && paymentSplits[0].method === 'CARD' ? '#f0f9ff' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 26 }}>💳</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0369a1' }}>ካርድ (POS Card)</span>
                    <span style={{ fontSize: 12, color: '#0284c7', fontWeight: 700 }}>{selectedOrder.total_amount} {t('currency')}</span>
                  </button>
                </div>

                {/* Custom split toggle */}
                <div style={{ marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => setShowCustomSplit(!showCustomSplit)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    {showCustomSplit 
                      ? (language === 'am' ? '▲ የተከፋፈለ ሂሳብ አዘጋጅ ደብቅ' : '▲ Hide Split Options') 
                      : (language === 'am' ? '▼ በከፊል የተከፋፈለ ሂሳብ (Split Bill)' : '▼ Split Bill / Custom Amounts')}
                  </button>

                  {showCustomSplit && (
                    <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-subtle)', borderRadius: 10 }}>
                      {paymentSplits.map((split, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, marginBottom: 8 }}>
                          <select
                            value={split.method}
                            onChange={e => {
                              const copy = [...paymentSplits];
                              copy[idx].method = e.target.value;
                              setPaymentSplits(copy);
                            }}
                          >
                            <option value="CASH">💵 {t('cash')}</option>
                            <option value="TELEBIRR">📱 {t('telebirr')}</option>
                            <option value="CBE_BIRR">🏦 {t('cbe_birr')}</option>
                            <option value="CARD">💳 {t('card')}</option>
                          </select>
                          <input
                            type="number"
                            value={split.amount}
                            onChange={e => {
                              const copy = [...paymentSplits];
                              copy[idx].amount = Number(e.target.value);
                              setPaymentSplits(copy);
                            }}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setPaymentSplits([...paymentSplits, { method: 'TELEBIRR', amount: 0 }])}
                        style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
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
        </div>
      )}

      {/* Printable Receipt Modal */}
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
            fontFamily: 'monospace'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>HABESHA GOURMET & LOUNGE</h3>
              <p style={{ fontSize: 11, color: '#666' }}>Bole Medhanealem Road, Addis Ababa</p>
              <p style={{ fontSize: 11, color: '#666' }}>TIN: 102948190 • VAT Reg: 015</p>
              <div style={{ borderBottom: '1px dashed #000', margin: '10px 0' }} />
              <p style={{ fontSize: 12, fontWeight: 700 }}>RECEIPT: {receipt.receiptNumber}</p>
              <p style={{ fontSize: 11 }}>Order #{receipt.orderNumber} • Cashier: {receipt.cashier}</p>
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
                <Printer size={16} /> Print
              </button>
              <button onClick={() => setReceipt(null)} className="btn btn-primary" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
