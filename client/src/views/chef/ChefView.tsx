import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ChefHat, Clock, CheckCircle2, Play, Flame } from 'lucide-react';

export const ChefView: React.FC = () => {
  const { currentBranchId, t } = useApp();
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      loadKitchenQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket status');
    }
  };

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#ffedd5', padding: 8, borderRadius: 10, color: '#ea580c' }}>
            <Flame size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>Kitchen Display System</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Active Food Tickets ({kitchenOrders.length})
            </span>
          </div>
        </div>
      </div>

      {kitchenOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ChefHat size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Kitchen is all caught up!</h3>
          <p style={{ fontSize: 13 }}>Incoming food tickets from Cashier will appear here instantly.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {kitchenOrders.map(order => (
            <div
              key={order.id}
              style={{
                background: '#ffffff',
                border: '1.5px solid var(--border)',
                borderTop: '4px solid #ea580c',
                borderRadius: 14,
                padding: 16,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* Order Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                    Ticket #{order.order_number}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>
                    {order.table_number ? `Table: ${order.table_number}` : order.order_type} • Waiter: {order.waiter_name}
                  </span>
                </div>
                <span className="badge badge-preparing">
                  <Clock size={12} /> {order.status}
                </span>
              </div>

              {order.special_notes && (
                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                  ⚠️ <strong>Note:</strong> {order.special_notes}
                </div>
              )}

              {/* Kitchen Food Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {order.items?.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: item.status === 'READY' ? '#ecfdf5' : 'var(--bg-subtle)',
                      border: item.status === 'READY' ? '1px solid #a7f3d0' : '1px solid transparent'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: item.status === 'READY' ? '#065f46' : 'var(--text-main)' }}>
                        {item.quantity}x {item.name}
                      </span>
                      {item.notes && (
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                          Instructions: {item.notes}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.status !== 'PREPARING' && item.status !== 'READY' && (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'PREPARING')}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700 }}
                        >
                          <Play size={12} /> Start
                        </button>
                      )}

                      {item.status !== 'READY' ? (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'READY')}
                          className="btn btn-success"
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
                        >
                          <CheckCircle2 size={14} /> Ready
                        </button>
                      ) : (
                        <span className="badge badge-ready">Done</span>
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
