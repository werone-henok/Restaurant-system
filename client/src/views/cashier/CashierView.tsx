import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Check, Printer, DollarSign, Tag, ShieldAlert, ArrowRight } from 'lucide-react';

export const CashierView: React.FC = () => {
  const { currentBranchId, t } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [paymentSplits, setPaymentSplits] = useState<{ method: string; amount: number }[]>([
    { method: 'CASH', amount: 0 }
  ]);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

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
      setSelectedOrder(null);
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Confirmation failed');
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
      setReceipt(res.receiptContent);
      setSelectedOrder(null);
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Payment settlement failed');
    } finally {
      setLoading(false);
    }
  };

  const pendingConfirmOrders = orders.filter(o => o.status === 'PENDING_CASHIER');
  const readyToPayOrders = orders.filter(o => ['DELIVERED', 'CONFIRMED', 'READY', 'PREPARING'].includes(o.status));

  return (
    <div className="view-body animate-fade-in">
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Cashier Operations</h2>

      {/* Pending Confirmation Alert Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            New Orders Awaiting Confirmation ({pendingConfirmOrders.length})
          </span>
        </div>

        {pendingConfirmOrders.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px dashed var(--border)', borderRadius: 12, padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No incoming orders pending confirmation
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingConfirmOrders.map(o => (
              <div key={o.id} style={{ background: '#ffffff', border: '1.5px solid #f97316', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Order #{o.order_number}</span>
                  <span className="badge badge-pending">Review & Confirm</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Waiter: <strong>{o.waiter_name}</strong> • Table: <strong>{o.table_number || o.order_type}</strong>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: 8, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                  {o.items?.map((it: any) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{it.quantity}x {it.name}</span>
                      <span>{it.price * it.quantity} {t('currency')}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)' }}>
                    Total: {o.total_amount} {t('currency')}
                  </span>
                  <button onClick={() => openOrderModal(o)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
                    Review & Confirm
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
          Active Orders for Payment Settlement
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {readyToPayOrders.map(o => (
            <div key={o.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, display: 'block' }}>Order #{o.order_number}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {o.table_number ? `Table: ${o.table_number}` : o.order_type} • {o.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', display: 'block', marginTop: 2 }}>
                  {o.total_amount} {t('currency')}
                </span>
              </div>
              <button
                onClick={() => openOrderModal(o)}
                className="btn btn-success"
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                <DollarSign size={15} /> Settle Bill
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
              <h3 style={{ fontSize: 17, fontWeight: 800 }}>Order #{selectedOrder.order_number} Details</h3>
              <button onClick={() => setSelectedOrder(null)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Items Breakdown */}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13 }}>
              {selectedOrder.items?.map((it: any) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{it.quantity}x {it.name}</span>
                  <span style={{ fontWeight: 600 }}>{it.price * it.quantity} {t('currency')}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span>Subtotal + VAT</span>
                <span>{selectedOrder.total_amount} {t('currency')}</span>
              </div>
            </div>

            {selectedOrder.status === 'PENDING_CASHIER' ? (
              <div>
                {/* Discount */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Apply Discount ({t('currency')})
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
                      placeholder="Discount reason (e.g. VIP guest, Manager promo)"
                      style={{ width: '100%' }}
                    />
                  )}
                </div>

                <button
                  disabled={loading}
                  onClick={handleConfirmOrder}
                  className="btn btn-primary btn-block"
                  style={{ height: 48 }}
                >
                  <Check size={18} />
                  {loading ? 'Confirming...' : t('confirm_and_route')}
                </button>
              </div>
            ) : (
              <div>
                {/* Payment Splits */}
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>
                  Split / Payment Configuration
                </label>

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
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}
                >
                  + Add Split Payment Method
                </button>

                <button
                  disabled={loading}
                  onClick={handleProcessPayment}
                  className="btn btn-success btn-block"
                  style={{ height: 48 }}
                >
                  <DollarSign size={18} />
                  {loading ? 'Processing...' : t('process_payment')}
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
