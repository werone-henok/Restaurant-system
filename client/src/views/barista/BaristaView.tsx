import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Coffee, Clock, CheckCircle2, Play } from 'lucide-react';

export const BaristaView: React.FC = () => {
  const { currentBranchId, t } = useApp();
  const [barOrders, setBarOrders] = useState<any[]>([]);

  const loadBarQueue = () => {
    api.request<any[]>(`/orders/queue/bar?branchId=${currentBranchId}`)
      .then(setBarOrders)
      .catch(() => {});
  };

  useEffect(() => {
    loadBarQueue();
    const unsub = api.onEvent((event) => {
      if (['BAR_NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_CANCELLED'].includes(event.type)) {
        loadBarQueue();
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
      loadBarQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to update beverage status');
    }
  };

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ background: '#e0f2fe', padding: 8, borderRadius: 10, color: '#0284c7' }}>
          <Coffee size={20} />
        </div>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 800 }}>Bar & Beverage Queue</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Coffee, Juices & Drinks ({barOrders.length})
          </span>
        </div>
      </div>

      {barOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Coffee size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Bar queue is empty!</h3>
          <p style={{ fontSize: 13 }}>Beverage orders confirmed by Cashier will show up here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {barOrders.map(order => (
            <div
              key={order.id}
              style={{
                background: '#ffffff',
                border: '1.5px solid var(--border)',
                borderTop: '4px solid #0284c7',
                borderRadius: 14,
                padding: 16,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>Order #{order.order_number}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>
                    {order.table_number ? `Table: ${order.table_number}` : order.order_type} • Waiter: {order.waiter_name}
                  </span>
                </div>
                <span className="badge badge-preparing">
                  <Clock size={12} /> {order.status}
                </span>
              </div>

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
                    <span style={{ fontSize: 14, fontWeight: 700, color: item.status === 'READY' ? '#065f46' : 'var(--text-main)' }}>
                      {item.quantity}x {item.name}
                    </span>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.status !== 'PREPARING' && item.status !== 'READY' && (
                        <button
                          onClick={() => updateItemStatus(order.id, item.id, 'PREPARING')}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700 }}
                        >
                          <Play size={12} /> Brew / Blend
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
