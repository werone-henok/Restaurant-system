import React from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, MapPin, User, Calendar, DollarSign, CheckCircle2, AlertTriangle, Utensils, Coffee, Tag, FileText } from 'lucide-react';
import { UniversalStatusBadge } from './UniversalStatusBadge';
import { useApp } from '../context/AppContext';
import { resolveImageUrl } from '../utils/imageUrl';
import { parseDbDate, formatOrderTime } from '../utils/timezone';

interface OrderHistoryModalProps {
  order: any | null;
  onClose: () => void;
  role?: 'waiter' | 'cashier' | 'chef' | 'barista' | 'admin' | 'owner';
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({ order, onClose, role }) => {
  const { language } = useApp();

  if (!order) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = parseDbDate(isoString);
      return d.toLocaleString(language === 'am' ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return isoString;
    }
  };

  const isDineIn = order.order_type === 'DINE_IN';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-in"
        style={{
          background: 'var(--surface, #ffffff)',
          color: 'var(--text, #0f172a)',
          borderRadius: 20,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          margin: 'auto',
          border: '1px solid var(--border, #e2e8f0)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-header, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16
              }}
            >
              #{order.order_number}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                  {language === 'am' ? `ትዕዛዝ #${order.order_number}` : `Order #${order.order_number}`}
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: isDineIn ? '#e0f2fe' : '#fef3c7',
                    color: isDineIn ? '#0369a1' : '#b45309'
                  }}
                >
                  {order.order_type}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                ID: {order.id}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UniversalStatusBadge status={order.status} size="md" />
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                color: 'var(--text-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Metadata Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
              background: 'var(--surface-muted, #f1f5f9)',
              padding: 12,
              borderRadius: 14
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} /> {language === 'am' ? 'ጠረጴዛ / ቦታ' : 'Table / Location'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                {order.table_number ? `Table ${order.table_number}` : (order.table_name || order.order_type)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} /> {language === 'am' ? 'የተፈጠረበት ቀን' : 'Placed At'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                {formatDate(order.created_at)}
              </div>
            </div>

            {order.waiter_name && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} /> {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {order.waiter_name}
                </div>
              </div>
            )}

            {order.cashier_name && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> {language === 'am' ? 'ያረጋገጠው ካሺየር' : 'Confirmed By'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {order.cashier_name}
                </div>
              </div>
            )}

            {order.approval_at && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {language === 'am' ? 'የተረጋገጠበት ሰዓት' : 'Approval Time'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                  {formatDate(order.approval_at)}
                </div>
              </div>
            )}

            {order.completion_time && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {language === 'am' ? 'የተጠናቀቀበት ሰዓት' : 'Prep Completed'}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                  {formatDate(order.completion_time)}
                </div>
              </div>
            )}
          </div>

          {/* Cancellation Notice if cancelled */}
          {order.status === 'CANCELLED' && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '12px 14px',
                borderRadius: 12,
                color: '#991b1b',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 13
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{language === 'am' ? 'የተሰረዘበት ምክንያት:' : 'Cancellation Reason:'}</strong>{' '}
                {order.cancellation_reason || (language === 'am' ? 'ምክንያት አልተገለጸም' : 'No reason provided')}
                {order.cancelled_at && (
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                    {formatDate(order.cancelled_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Special Notes */}
          {order.special_notes && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                padding: '10px 14px',
                borderRadius: 12,
                color: '#92400e',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FileText size={15} style={{ flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700 }}>{language === 'am' ? 'ማስታወሻ:' : 'Special Instructions:'}</span>{' '}
                {order.special_notes}
              </div>
            </div>
          )}

          {/* Items Section */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Utensils size={15} />
              {language === 'am' ? `የታዘዙ ምግቦችና መጠጦች (${order.items?.length || 0})` : `Ordered Items (${order.items?.length || 0})`}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.items && order.items.length > 0 ? (
                order.items.map((it: any) => {
                  const lineTotal = (it.price || 0) * (it.quantity || 1);
                  const isDrink = it.routing_destination === 'BAR';

                  return (
                    <div
                      key={it.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'var(--surface, #ffffff)',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        {it.photo_url ? (
                          <img
                            src={resolveImageUrl(it.photo_url)}
                            alt={it.name}
                            style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 8,
                              background: isDrink ? '#e0f2fe' : '#ffedd5',
                              color: isDrink ? '#0284c7' : '#ea580c',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {isDrink ? <Coffee size={18} /> : <Utensils size={18} />}
                          </div>
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {language === 'am' && it.name_amharic ? it.name_amharic : (it.menu_name || it.name)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{it.quantity} × {it.price?.toLocaleString()} ETB</span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: isDrink ? '#f0f9ff' : '#fff7ed',
                                color: isDrink ? '#0369a1' : '#c2410c'
                              }}
                            >
                              {it.routing_destination}
                            </span>
                            {it.status === 'READY' && (
                              <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <CheckCircle2 size={11} /> {language === 'am' ? 'ተጠናቋል' : 'Ready'}
                                {it.ready_at && ` (${formatOrderTime(it.ready_at, language === 'am' ? 'am-ET' : 'en-US')})`}
                              </span>
                            )}
                          </div>
                          {it.notes && (
                            <div style={{ fontSize: 11, color: '#d97706', fontStyle: 'italic', marginTop: 2 }}>
                              Note: {it.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 14, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {lineTotal.toLocaleString()} ETB
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)' }}>
                  {language === 'am' ? 'የተዘረዘሩ ምግቦች የሉም' : 'No items found for this order'}
                </div>
              )}
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div
            style={{
              marginTop: 4,
              padding: '14px 16px',
              borderRadius: 14,
              background: 'var(--surface-muted, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
              <span>{language === 'am' ? 'የምግብ ድምር (Subtotal):' : 'Subtotal:'}</span>
              <span>{(order.subtotal || 0).toLocaleString()} ETB</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
              <span>{language === 'am' ? 'ተ.እ.ታ / ቫት (15% VAT):' : 'VAT (15%):'}</span>
              <span>{(order.tax_amount || 0).toLocaleString()} ETB</span>
            </div>

            {order.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#dc2626' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={12} /> {language === 'am' ? 'ቅናሽ (Discount):' : 'Discount:'}
                  {order.discount_reason && ` (${order.discount_reason})`}
                </span>
                <span>-{(order.discount_amount).toLocaleString()} ETB</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text, #0f172a)',
                borderTop: '1px dashed var(--border, #cbd5e1)',
                paddingTop: 8,
                marginTop: 2
              }}
            >
              <span>{language === 'am' ? 'አጠቃላይ ድምር (Total):' : 'Total Amount:'}</span>
              <span style={{ color: '#059669' }}>{(order.total_amount || 0).toLocaleString()} ETB</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--surface-header, #f8fafc)'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 24px',
              borderRadius: 10,
              background: 'var(--primary, #f97316)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            {language === 'am' ? 'ዝጋ' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
