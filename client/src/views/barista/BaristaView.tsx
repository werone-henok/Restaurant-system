import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Coffee, Clock, CheckCircle2, RefreshCw, Wifi, WifiOff, Search, History, Eye } from 'lucide-react';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { OrderHistoryModal } from '../../components/OrderHistoryModal';
import { gToast } from '../../utils/toast';

export const BaristaView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [barOrders, setBarOrders] = useState<any[]>([]);
  const [prepHistory, setPrepHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  const loadBarQueue = useCallback(() => {
    api.request<any[]>(`/orders/queue/bar?branchId=${currentBranchId}`)
      .then(data => setBarOrders(data || []))
      .catch(() => {});
  }, [currentBranchId]);

  const loadBaristaHistory = useCallback(() => {
    setLoadingHistory(true);
    api.request<any[]>(`/orders/history/barista?branchId=${currentBranchId}`)
      .then(data => setPrepHistory(data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [currentBranchId]);

  const refreshAll = useCallback(() => {
    loadBarQueue();
    loadBaristaHistory();
  }, [loadBarQueue, loadBaristaHistory]);

  useEffect(() => {
    loadCallbackRef.current = refreshAll;
  }, [refreshAll]);

  useEffect(() => {
    refreshAll();
    setIsConnected(api.isConnected);

    const unsub = api.onEvent((event) => {
      if (['BAR_NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_READY', 'ORDER_DELIVERED'].includes(event.type)) {
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
  }, [currentBranchId, refreshAll]);

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
      if (status === 'READY') {
        loadBaristaHistory();
      }
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update beverage status');
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    refreshAll();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredHistory = prepHistory.filter(o => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    const orderNum = String(o.order_number || '');
    const table = String(o.table_number || '').toLowerCase();
    const items = o.items?.some((it: any) =>
      it.name?.toLowerCase().includes(q) ||
      it.menu_name?.toLowerCase().includes(q) ||
      it.name_amharic?.includes(q)
    );
    return orderNum.includes(q) || table.includes(q) || items;
  });

  return (
    <div className="view-body animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#e0f2fe', padding: 10, borderRadius: 12, color: '#0284c7' }}>
            <Coffee size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>
              {language === 'am' ? 'የባሪስታ ክፍል ማዘዣዎች' : 'Bar & Beverage Station'}
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
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? (language === 'am' ? 'ዙመም' : 'Live') : (language === 'am' ? 'ውድ' : 'Offline')}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: isRefreshing ? 'var(--bg-subtle)' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* View Switcher: Active Queue vs Preparation History */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-subtle, #f1f5f9)', padding: 4, borderRadius: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          style={{
            flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: activeTab === 'queue' ? '#ffffff' : 'transparent',
            color: activeTab === 'queue' ? '#0284c7' : 'var(--text-muted)',
            boxShadow: activeTab === 'queue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Coffee size={15} />
          {language === 'am' ? 'ንቁ የመጠጥ ትዕዛዞች' : 'Active Bar Queue'} ({barOrders.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('history'); loadBaristaHistory(); }}
          style={{
            flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: activeTab === 'history' ? '#ffffff' : 'transparent',
            color: activeTab === 'history' ? '#0284c7' : 'var(--text-muted)',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <History size={15} />
          {language === 'am' ? 'የመጠጥ ዝግጅት ታሪክ' : 'Preparation History'} ({prepHistory.length})
        </button>
      </div>

      {/* ── Tab 1: Active Bar Queue ── */}
      {activeTab === 'queue' && (
        <div>
          {barOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 16 }}>
              <Coffee size={56} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                {language === 'am' ? 'ምንም የሚጠበቅ የመጠጥ ትዕዛዝ የለም!' : 'No beverage orders pending!'}
              </h3>
              <p style={{ margin: 0, fontSize: 13 }}>
                {language === 'am' ? 'አዳዲስ የመጠጥ ትዕዛዞች ሲመጡ ወዲያውኑ እዚህ ይታያሉ።' : 'Incoming beverage tickets from waitstaff will appear here in real-time.'}
              </p>
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
                        ☕ #{order.order_number}
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
      )}

      {/* ── Tab 2: Preparation History ── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={language === 'am' ? 'በትኬት ቁጥር፣ ጠረጴዛ ወይም መጠጥ ፈልግ...' : 'Search by ticket #, table, or drink name...'}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{language === 'am' ? 'በእርስዎ የተዘጋጁ መጠጦች' : 'Beverages Prepared by You'}</span>
            <span>{filteredHistory.length} {language === 'am' ? 'ትዕዛዞች' : 'tickets'}</span>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>{language === 'am' ? 'የመጠጥ ታሪክ እየተጫነ ነው...' : 'Loading beverage history...'}</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 14 }}>
              <History size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>{language === 'am' ? 'ምንም የመጠጥ ዝግጅት ታሪክ አልተገኘም' : 'No beverage preparation history found'}</p>
              <span style={{ fontSize: 12 }}>{language === 'am' ? 'ያዘጋጇቸውና ያጠናቀቋቸው መጠጦች እዚህ በሙሉ በዝርዝር ይመዘገባሉ' : 'Completed beverage items will automatically appear here.'}</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {filteredHistory.map(o => (
                <div
                  key={o.id}
                  onClick={() => setSelectedHistoryOrder(o)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        background: '#0284c7', color: '#ffffff',
                        fontWeight: 800, fontSize: 13, padding: '2px 8px', borderRadius: 6
                      }}>
                        #{o.order_number}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>
                        {o.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${o.table_number}` : o.order_type}
                      </span>
                    </div>

                    <UniversalStatusBadge status={o.status} size="sm" />
                  </div>

                  {/* Completion timestamp */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    <span>
                      {o.completion_time ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>
                          ✓ {language === 'am' ? 'የተጠናቀቀበት:' : 'Completed:'} {new Date(o.completion_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        new Date(o.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      )}
                    </span>
                  </div>

                  {/* Prepared beverage items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f0f9ff', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                    {o.items?.map((it: any) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>
                          {it.quantity}x {language === 'am' && it.name_amharic ? it.name_amharic : (it.menu_name || it.name)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: it.status === 'READY' ? '#dcfce7' : '#bae6fd',
                          color: it.status === 'READY' ? '#15803d' : '#0369a1'
                        }}>
                          {it.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {o.waiter_name ? `${language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: ${o.waiter_name}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedHistoryOrder(o); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 8,
                        background: '#f0f9ff', color: '#0284c7',
                        border: '1px solid #bae6fd', fontSize: 12, fontWeight: 700,
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

      {/* Detail Modal */}
      {selectedHistoryOrder && (
        <OrderHistoryModal
          order={selectedHistoryOrder}
          onClose={() => setSelectedHistoryOrder(null)}
          role="barista"
        />
      )}
    </div>
  );
};
