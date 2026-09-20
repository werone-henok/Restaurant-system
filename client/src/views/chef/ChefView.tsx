import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ChefHat, Clock, CheckCircle2, Play, Flame } from 'lucide-react';
import { gToast } from '../../utils/toast';

export const ChefView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);

  const loadKitchenQueue = () => {
    api.request<any[]>(`/orders/queue/kitchen?branchId=${currentBranchId}`)
      .then(setKitchenOrders)
      .catch(() => {});
  };

  useEffect(() => {
    loadKitchenQueue();
    const unsub = api.onEvent((event) => {
      if (['KITCHEN_NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_CANCELLED'].includes(event.type)) {
        loadKitchenQueue();
      }
    });
    return unsub;
  }, [currentBranchId]);

  const updateItemStatus = async (orderId: string, itemId: string, status: 'PREPARING' | 'READY') => {
    try {
      await api.request(`/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      gToast.success(status === 'READY' ? (language === 'am' ? 'ምግቡ ተጠናቋል!' : 'Food marked ready!') : (language === 'am' ? 'ማዘጋጀት ተጀምሯል' : 'Preparation started'));
      loadKitchenQueue();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update ticket status');
    }
  };

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#ffedd5', padding: 10, borderRadius: 12, color: '#ea580c' }}>
            <Flame size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>
              {language === 'am' ? 'የማብሰያ ክፍል ማዘዣዎች (KDS)' : 'Kitchen Display System'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'am' ? `ንቁ የምግብ ትዕዛዞች (${kitchenOrders.length})` : `Active Food Tickets (${kitchenOrders.length})`}
            </span>
          </div>
        </div>
      </div>

      {kitchenOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ChefHat size={56} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>
            {language === 'am' ? 'ምንም የሚዘጋጅ ምግብ የለም!' : 'Kitchen is all caught up!'}
          </h3>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            {language === 'am' ? 'አዳዲስ ትዕዛዞች ከካሸር ሲረጋገጡ ወዲያውኑ እዚህ ይመጣሉ።' : 'Incoming food tickets from Cashier will appear here instantly.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {kitchenOrders.map(order => (
            <div
              key={order.id}
              style={{
                background: '#ffffff',
                border: '1.5px solid var(--border)',
                borderTop: '5px solid #ea580c',
                borderRadius: 14,
                padding: 16,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* Order Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                    ትኬት #{order.order_number}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    {order.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${order.table_number}` : order.order_type} • {language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: <strong>{order.waiter_name}</strong>
                  </span>
                </div>
                <span className="badge badge-preparing" style={{ fontSize: 12, padding: '4px 8px' }}>
                  <Clock size={12} /> {order.status === 'PREPARING' ? (language === 'am' ? 'በመዘጋጀት ላይ' : order.status) : order.status}
                </span>
              </div>

              {order.special_notes && (
                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 12, fontWeight: 600 }}>
                  ⚠️ <strong>{language === 'am' ? 'ልዩ ማስታወሻ' : 'Note'}:</strong> {order.special_notes}
                </div>
              )}

              {/* Kitchen Food Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {order.items?.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: item.status === 'READY' ? '#ecfdf5' : 'var(--bg-subtle)',
                      border: item.status === 'READY' ? '1.5px solid #a7f3d0' : '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: item.status === 'READY' ? '#065f46' : 'var(--text-main)' }}>
                        {item.quantity}x {item.name_amharic || item.name}
                      </span>
                      {item.name_amharic && item.name && (
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.name}
                        </span>
                      )}
                      {item.notes && (
                        <span style={{ display: 'block', fontSize: 12, color: '#ea580c', fontWeight: 700, marginTop: 2 }}>
                          📝 {item.notes}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.status !== 'PREPARING' && item.status !== 'READY' && (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'PREPARING')}
                          className="btn btn-secondary"
                          style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800 }}
                        >
                          <Play size={14} /> {language === 'am' ? 'ጀምር' : 'Start'}
                        </button>
                      )}

                      {item.status !== 'READY' ? (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'READY')}
                          className="btn btn-success"
                          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 800 }}
                        >
                          <CheckCircle2 size={16} /> {language === 'am' ? 'ተጠናቋል' : 'Ready'}
                        </button>
                      ) : (
                        <span className="badge badge-ready" style={{ fontSize: 13, padding: '6px 12px' }}>
                          ✓ {language === 'am' ? 'ተጠናቋል' : 'Done'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
