import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Coffee, Clock, CheckCircle2, Play } from 'lucide-react';
import { gToast } from '../../utils/toast';

export const BaristaView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [barOrders, setBarOrders] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  const loadBarQueue = useCallback(() => {
    api.request<any[]>(`/orders/queue/bar?branchId=${currentBranchId}`)
      .then(setBarOrders)
      .catch(() => {});
  }, [currentBranchId]);

  useEffect(() => {
    loadCallbackRef.current = loadBarQueue;
  }, [loadBarQueue]);

  useEffect(() => {
    loadBarQueue();
    setIsConnected(api.isConnected);

    const unsub = api.onEvent((event) => {
      if (['BAR_NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_READY'].includes(event.type)) {
        setTimeout(() => {
          loadCallbackRef.current();
          if (event.type === 'BAR_NEW_ORDER') {
            gToast.info(`☕ New beverage order #${event.payload?.orderNumber} arrived!`);
          }
        }, 300);
      }
    });

    // Auto-refresh fallback every 30 seconds
    loadTimerRef.current = setInterval(() => {
      loadCallbackRef.current();
    }, 30000);

    // Listen for live WebSocket connection status changes
    const unsubStatus = api.onStatusChange(setIsConnected);

    return () => {
      unsub();
      unsubStatus();
      if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    };
  }, [currentBranchId]);

  const updateItemStatus = async (orderId: string, itemId: string, status: 'PREPARING' | 'READY') => {
    try {
      await api.request(`/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      gToast.success(
        status === 'READY'
          ? (language === 'am' ? 'መጠጡ ተጠናቋል!' : '☕ Beverage ready!')
          : (language === 'am' ? 'ማዘጋጀት ተጀምሯል' : 'Preparing...')
      );
      loadBarQueue();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update beverage status');
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadBarQueue();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#e0f2fe', padding: 10, borderRadius: 12, color: '#0284c7' }}>
            <Coffee size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>
              {language === 'am' ? 'የባሪስታ ተሰርቶች ተሰርት' : 'Bar & Beverage Queue'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'am' ? `መጠጥና ቡና (${barOrders.length})` : `Coffee, Juices & Drinks (${barOrders.length})`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: isConnected ? '#ecfdf5' : '#fef2f2',
            color: isConnected ? '#065f46' : '#991b1b',
            border: `1px solid ${isConnected ? '#a7f3d0' : '#fca5a5'}`
          }}>
            {isConnected ? '🟢' : '🔴'}
            {isConnected ? 'Live' : 'Offline'}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }}
          >
            <Clock size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {barOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <Coffee size={56} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>
            {language === 'am' ? 'ምንም የሚጠበቅ የመጠጥ ትዕዛዝ የለም!' : 'No beverage orders pending!'}
          </h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {barOrders.map(order => (
            <div key={order.id} style={{
              background: '#ffffff', border: '1.5px solid var(--border)',
              borderTop: '5px solid #0284c7', borderRadius: 14,
              padding: 16, boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>
                    ☕ ትኬት #{order.order_number}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    {order.table_number ? `Table ${order.table_number}` : order.order_type} • {order.waiter_name}
                  </span>
                </div>
                <span className="badge badge-preparing" style={{ fontSize: 12, padding: '4px 8px' }}>
                  <Clock size={12} /> {order.status}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {order.items?.map((item: any) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 10,
                    background: item.status === 'READY' ? '#ecfdf5' : 'var(--bg-subtle)',
                    border: item.status === 'READY' ? '1.5px solid #a7f3d0' : '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>
                      {item.quantity}x {item.name}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.status !== 'READY' ? (
                        <button onClick={() => updateItemStatus(order.id, item.id, 'READY')}
                          className="btn btn-success" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 800 }}>
                          <CheckCircle2 size={16} /> {language === 'am' ? 'ተጠናቋል' : 'Ready'}
                        </button>
                      ) : (
                        <span className="badge badge-ready" style={{ fontSize: 13, padding: '6px 12px' }}>✓ Done</span>
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
