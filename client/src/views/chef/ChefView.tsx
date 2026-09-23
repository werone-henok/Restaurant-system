import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ChefHat, Clock, CheckCircle2, Play, Flame, RefreshCw, Wifi, WifiOff, Search, History, Eye, Utensils } from 'lucide-react';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { OrderHistoryModal } from '../../components/OrderHistoryModal';
import { gToast } from '../../utils/toast';

export const ChefView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [prepHistory, setPrepHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  // Stable load function reference
  const loadKitchenQueue = useCallback(() => {
    api.request<any[]>(`/orders/queue/kitchen?branchId=${currentBranchId}`)
      .then(data => {
        setKitchenOrders(data || []);
        setLastUpdate(new Date());
      })
      .catch(() => {});
  }, [currentBranchId]);

  const loadPrepHistory = useCallback(() => {
    setLoadingHistory(true);
    api.request<any[]>(`/orders/history/chef?branchId=${currentBranchId}`)
      .then(data => setPrepHistory(data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [currentBranchId]);

  const refreshAll = useCallback(() => {
    loadKitchenQueue();
    loadPrepHistory();
  }, [loadKitchenQueue, loadPrepHistory]);

  // Keep the ref current
  useEffect(() => {
    loadCallbackRef.current = refreshAll;
  }, [refreshAll]);

  useEffect(() => {
    // Initial load
    refreshAll();
    setIsConnected(api.isConnected);

    // WebSocket listener for real-time updates
    const unsub = api.onEvent((event) => {
      if (['KITCHEN_NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_READY', 'ORDER_DELIVERED'].includes(event.type)) {
        setTimeout(() => {
          loadCallbackRef.current();
          if (event.type === 'KITCHEN_NEW_ORDER') {
            gToast.info(`🔥 New order #${event.payload?.orderNumber} arrived!`);
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
  }, [currentBranchId, refreshAll]);

  const updateItemStatus = async (orderId: string, itemId: string, status: 'PREPARING' | 'READY') => {
    try {
      await api.request(`/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      gToast.success(
        status === 'READY'
          ? (language === 'am' ? 'ምግቡ ተጠናቋል!' : '✅ Food marked ready!')
          : (language === 'am' ? 'ማዘጋጀት ተጀምሯል' : '🔥 Preparation started!')
      );
      loadKitchenQueue();
      if (status === 'READY') {
        loadPrepHistory();
      }
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update ticket status');
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
    const items = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
    return orderNum.includes(q) || table.includes(q) || items;
  });

  return (
    <div className="view-body animate-fade-in">
      {/* Header with connection status */}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Connection Status Indicator */}
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

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: isRefreshing ? 'var(--bg-subtle)' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.3s'
            }}
          >
            <RefreshCw size={14} style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
            }} />
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
            color: activeTab === 'queue' ? '#ea580c' : 'var(--text-muted)',
            boxShadow: activeTab === 'queue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Flame size={15} />
          {language === 'am' ? 'ንቁ የማብሰያ ትዕዛዞች' : 'Active Kitchen Queue'} ({kitchenOrders.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('history'); loadPrepHistory(); }}
          style={{
            flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: activeTab === 'history' ? '#ffffff' : 'transparent',
            color: activeTab === 'history' ? '#ea580c' : 'var(--text-muted)',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <History size={15} />
          {language === 'am' ? 'የማብሰያ ታሪክ' : 'Preparation History'} ({prepHistory.length})
        </button>
      </div>

      {/* ── Tab 1: Active Queue ── */}
      {activeTab === 'queue' && (
        <div>
          {kitchenOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 16 }}>
              <CheckCircle2 size={48} style={{ margin: '0 auto 12px', color: '#10b981', opacity: 0.8 }} />
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                {language === 'am' ? 'ሁሉም ምግቦች ተዘጋጅተዋል!' : 'All Kitchen Orders Clear!'}
              </h3>
              <p style={{ margin: 0, fontSize: 13 }}>
                {language === 'am' ? 'አዳዲስ ትዕዛዞች ሲመጡ ወዲያውኑ እዚህ ይታያሉ።' : 'Incoming food orders from waitstaff will appear here in real-time.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {kitchenOrders.map(order => (
                <div
                  key={order.id}
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #fdba74',
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {/* Ticket Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            background: '#ea580c', color: '#ffffff',
                            fontWeight: 800, fontSize: 14, padding: '2px 8px', borderRadius: 6
                          }}>
                            #{order.order_number}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>
                            {order.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${order.table_number}` : order.order_type}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                          {order.waiter_name ? `${language === 'am' ? 'አስተናጋጅ' : 'Waiter'}: ${order.waiter_name}` : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ea580c', fontSize: 12, fontWeight: 700 }}>
                        <Clock size={13} />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Order Special Notes */}
                    {order.special_notes && (
                      <div style={{
                        background: '#fef3c7', color: '#92400e',
                        padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        marginBottom: 10, border: '1px solid #fde68a'
                      }}>
                        ⚠️ {order.special_notes}
                      </div>
                    )}

                    {/* Items List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {order.items?.map((item: any) => (
                        <div
                          key={item.id}
                          style={{
                            background: item.status === 'READY' ? '#f0fdf4' : item.status === 'PREPARING' ? '#fff7ed' : '#f8fafc',
                            border: `1px solid ${item.status === 'READY' ? '#bbf7d0' : item.status === 'PREPARING' ? '#fed7aa' : '#e2e8f0'}`,
                            borderRadius: 10,
                            padding: '8px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 800, fontSize: 14, color: item.status === 'READY' ? '#15803d' : '#0f172a' }}>
                              {item.quantity}x {language === 'am' && item.name_amharic ? item.name_amharic : item.name}
                            </span>
                            {item.notes && (
                              <span style={{ display: 'block', fontSize: 11, color: '#c2410c', fontStyle: 'italic', marginTop: 1 }}>
                                • {item.notes}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
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
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={language === 'am' ? 'የትዕዛዝ ቁጥር፣ ጠረጴዛ ወይም የምግብ ስም ፈልግ...' : 'Search by order #, table, or food item...'}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text, #0f172a)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{language === 'am' ? 'በእርስዎ የተዘጋጁ የምግብ ትዕዛዞች' : 'Food Orders Prepared by You'}</span>
            <span>{filteredHistory.length} {language === 'am' ? 'ትዕዛዞች' : 'tickets'}</span>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>{language === 'am' ? 'የማብሰያ ታሪክ እየተጫነ ነው...' : 'Loading preparation history...'}</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 14 }}>
              <History size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>{language === 'am' ? 'ምንም የማብሰያ ታሪክ አልተገኘም' : 'No preparation history found'}</p>
              <span style={{ fontSize: 12 }}>{language === 'am' ? 'ያዘጋጇቸውና ያጠናቀቋቸው ምግቦች እዚህ በሙሉ በዝርዝር ይመዘገባሉ' : 'Completed kitchen food items will automatically appear here.'}</span>
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
                        background: '#ea580c', color: '#ffffff',
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

                  {/* Prepared food items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f8fafc', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                    {o.items?.map((it: any) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>
                          {it.quantity}x {language === 'am' && it.name_amharic ? it.name_amharic : (it.menu_name || it.name)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: it.status === 'READY' ? '#dcfce7' : '#fed7aa',
                          color: it.status === 'READY' ? '#15803d' : '#c2410c'
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
                        background: '#fff7ed', color: '#ea580c',
                        border: '1px solid #fed7aa', fontSize: 12, fontWeight: 700,
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
          role="chef"
        />
      )}
    </div>
  );
};
