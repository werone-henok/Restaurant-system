import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { ChefHat, Clock, CheckCircle2, Play, Flame, RefreshCw, Wifi, WifiOff, Search, History, Eye, Utensils, FolderPlus, Plus, Tag } from 'lucide-react';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { OrderHistoryModal } from '../../components/OrderHistoryModal';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { ModifyOrderModal } from '../../components/ModifyOrderModal';
import { ImageUploadCompressor } from '../../components/ImageUploadCompressor';
import { resolveImageUrl } from '../../utils/imageUrl';
import { gToast } from '../../utils/toast';
import { formatOrderTime, formatOrderDateTime } from '../../utils/timezone';

export const ChefView: React.FC = () => {
  const { currentBranchId, t, language } = useApp();
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'catalog'>('queue');
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [modifyingOrder, setModifyingOrder] = useState<any | null>(null);
  const [prepHistory, setPrepHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  // Catalog & Category State
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Chef Create Menu Item Modal
  const [showDishModal, setShowDishModal] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishNameAmharic, setDishNameAmharic] = useState('');
  const [dishCategory, setDishCategory] = useState('');
  const [dishPrice, setDishPrice] = useState<number>(100);
  const [dishPrepMinutes, setDishPrepMinutes] = useState<number>(15);
  const [dishRouting, setDishRouting] = useState<'KITCHEN' | 'BAR' | 'BOTH'>('KITCHEN');
  const [dishDesc, setDishDesc] = useState('');
  const [dishPhoto, setDishPhoto] = useState('');
  const [savingDish, setSavingDish] = useState(false);

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

  const loadCatalog = useCallback(() => {
    setLoadingCatalog(true);
    Promise.all([
      api.request<any[]>('/menu/categories'),
      api.request<any[]>('/menu/items?all=true')
    ])
      .then(([cats, items]) => {
        setCategories(cats || []);
        setMenuItems(items || []);
        if (cats && cats.length > 0 && !dishCategory) {
          setDishCategory(cats[0].id);
        }
      })
      .catch((err) => console.error('Failed to load menu catalog in chef view:', err))
      .finally(() => setLoadingCatalog(false));
  }, [dishCategory]);

  const refreshAll = useCallback(() => {
    loadKitchenQueue();
    loadPrepHistory();
    if (activeTab === 'catalog') {
      loadCatalog();
    }
  }, [loadKitchenQueue, loadPrepHistory, loadCatalog, activeTab]);

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

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName.trim()) {
      gToast.error(language === 'am' ? 'እባክዎ የምግብ ስም ያስገቡ' : 'Please enter dish name');
      return;
    }
    const catId = dishCategory || categories[0]?.id;
    if (!catId) {
      gToast.error(language === 'am' ? 'እባክዎ መጀመሪያ ምድብ ይፍጠሩ ወይም ይምረጡ' : 'Please create or select a category first');
      return;
    }

    setSavingDish(true);
    try {
      await api.request('/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          name: dishName.trim(),
          name_amharic: dishNameAmharic.trim() || null,
          category_id: catId,
          price: Number(dishPrice),
          prep_time_minutes: Number(dishPrepMinutes) || 15,
          routing_destination: dishRouting,
          description: dishDesc.trim() || null,
          photo_url: dishPhoto.trim() || null
        })
      });
      gToast.success(
        language === 'am'
          ? `አዲስ ምግብ "${dishNameAmharic || dishName}" በተሳካ ሁኔታ ተመዝግቧል!`
          : `New dish "${dishName}" created successfully!`
      );
      setShowDishModal(false);
      setDishName('');
      setDishNameAmharic('');
      setDishDesc('');
      setDishPhoto('');
      loadCatalog();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to create dish');
    } finally {
      setSavingDish(false);
    }
  };

  const toggleItemAvailability = async (item: any) => {
    try {
      const newStatus = !item.is_available;
      await api.request(`/menu/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_available: newStatus
        })
      });
      gToast.success(
        newStatus
          ? (language === 'am' ? `"${item.name_amharic || item.name}" ዝግጁ ነው` : `"${item.name}" marked Available`)
          : (language === 'am' ? `"${item.name_amharic || item.name}" አልቋል (Out of Stock)` : `"${item.name}" marked Out of Stock`)
      );
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: newStatus ? 1 : 0 } : m));
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update item availability');
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
        <button
          type="button"
          onClick={() => { setActiveTab('catalog'); loadCatalog(); }}
          style={{
            flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 8,
            background: activeTab === 'catalog' ? '#ffffff' : 'transparent',
            color: activeTab === 'catalog' ? '#ea580c' : 'var(--text-muted)',
            boxShadow: activeTab === 'catalog' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Utensils size={15} />
          {language === 'am' ? 'ምግቦችና ምድቦች' : 'Menu & Categories'}
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
                        {formatOrderTime(order.created_at, language === 'am' ? 'am-ET' : 'en-US')}
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

                    {/* Modify / Substitute button if an ingredient ran out */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setModifyingOrder(order)}
                        style={{
                          background: '#fff7ed',
                          border: '1.5px solid #fed7aa',
                          color: '#c2410c',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <span>✏️</span>
                        {language === 'am' ? 'የግብዓት እጥረት ካለ ምግብ ቀይር / አስተካክል' : 'Modify / Replace Missing Item'}
                      </button>
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
                          ✓ {language === 'am' ? 'የተጠናቀቀበት:' : 'Completed:'} {formatOrderDateTime(o.completion_time, language === 'am' ? 'am-ET' : 'en-US')}
                        </span>
                      ) : (
                        formatOrderDateTime(o.created_at, language === 'am' ? 'am-ET' : 'en-US')
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

      {/* ── Tab 3: Menu & Categories Studio ── */}
      {activeTab === 'catalog' && (
        <div className="animate-fade-in">
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {language === 'am' ? 'የምግብ ካታሎግና ምድቦች' : 'Menu Catalog & Categories'}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'ምድቦችን ይፍጠሩ፣ አዳዲስ ምግቦችን ያክሉ፣ እንዲሁም ዝግጁነታቸውን ይቆጣጠሩ' : 'Create categories, manage dishes & toggle availability'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <FolderPlus size={15} color="var(--primary)" />
                {language === 'am' ? 'አዲስ ምድብ' : '+ New Category'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDishName('');
                  setDishNameAmharic('');
                  setDishPrice(100);
                  setDishCategory(categories[0]?.id || '');
                  setDishRouting('KITCHEN');
                  setDishDesc('');
                  setDishPhoto('');
                  setShowDishModal(true);
                }}
                className="btn btn-primary"
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                {language === 'am' ? 'አዲስ ምግብ' : '+ New Dish'}
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
            <button
              onClick={() => setSelectedCategoryFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                border: selectedCategoryFilter === 'ALL' ? 'none' : '1px solid var(--border)',
                background: selectedCategoryFilter === 'ALL' ? '#ea580c' : 'var(--bg-card)',
                color: selectedCategoryFilter === 'ALL' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {language === 'am' ? 'ሁሉም ምግቦች' : 'All Categories'} ({menuItems.length})
            </button>
            {categories.map(cat => {
              const count = menuItems.filter(m => m.category_id === cat.id).length;
              const isSelected = selectedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: isSelected ? 'none' : '1px solid var(--border)',
                    background: isSelected ? '#ea580c' : 'var(--bg-card)',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>{cat.icon || '🍽️'}</span>
                  <span>{language === 'am' && cat.name_amharic ? cat.name_amharic : cat.name}</span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dishes Grid */}
          {loadingCatalog ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: '#ea580c', borderRadius: '50%', margin: '0 auto 12px' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{language === 'am' ? 'ምግቦች በመጫን ላይ...' : 'Loading menu items...'}</span>
            </div>
          ) : menuItems.filter(item => selectedCategoryFilter === 'ALL' || item.category_id === selectedCategoryFilter).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 14, border: '1px dashed var(--border)' }}>
              <Utensils size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                {language === 'am' ? 'በዚህ ምድብ ውስጥ ምንም ምግብ አልተገኘም' : 'No menu items in this category'}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'የመጀመሪያውን ምግብ ለመጨመር ከላይ ያለውን ቁልፍ ይጫኑ' : 'Click "+ New Dish" above to add the first item'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {menuItems
                .filter(item => selectedCategoryFilter === 'ALL' || item.category_id === selectedCategoryFilter)
                .map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 12,
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      boxShadow: 'var(--shadow-sm)',
                      opacity: item.is_available ? 1 : 0.65
                    }}
                  >
                    <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#fed7aa', position: 'relative' }}>
                      {item.photo_url ? (
                        <img
                          src={resolveImageUrl(item.photo_url)}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#ea580c', fontWeight: 800, fontSize: 20 }}>
                          {item.name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{item.name}</h4>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4, background: item.routing_destination === 'KITCHEN' ? '#fef3c7' : '#e0f2fe', color: item.routing_destination === 'KITCHEN' ? '#b45309' : '#0284c7' }}>
                          {item.routing_destination}
                        </span>
                      </div>
                      {item.name_amharic && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{item.name_amharic}</span>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#ea580c' }}>
                          {item.price} {t('currency')}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleItemAvailability(item)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: item.is_available ? '#ecfdf5' : '#fef2f2',
                            color: item.is_available ? '#065f46' : '#991b1b',
                            border: `1px solid ${item.is_available ? '#a7f3d0' : '#fca5a5'}`
                          }}
                        >
                          {item.is_available 
                            ? (language === 'am' ? '✅ ዝግጁ' : 'In Stock') 
                            : (language === 'am' ? '❌ አልቋል' : '86 / Out')}
                        </button>
                      </div>
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

      {/* Modal: Create Category */}
      <CreateCategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={(newCat) => {
          setCategories(prev => {
            if (prev.some(c => c.id === newCat.id)) return prev;
            return [...prev, newCat];
          });
          setDishCategory(newCat.id);
        }}
      />

      {/* Modal: Create Dish (Chef) */}
      {showDishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {language === 'am' ? 'አዲስ ምግብ መመዝገቢያ' : 'Add New Menu Dish'}
              </h3>
              <button onClick={() => setShowDishModal(false)} style={{ background: 'none', border: 'none', fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveDish} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የምግብ ስም (እንግሊዝኛ) *' : 'Dish Name (English) *'}
                </label>
                <input type="text" required placeholder="e.g. Special Doro Wat" value={dishName} onChange={e => setDishName(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የምግብ ስም (አማርኛ - አማራጭ)' : 'Dish Name (Amharic - Optional)'}
                </label>
                <input type="text" placeholder="e.g. ልዩ የዶሮ ወጥ" value={dishNameAmharic} onChange={e => setDishNameAmharic(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {language === 'am' ? 'ምድብ' : 'Category'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      + {language === 'am' ? 'አዲስ ምድብ' : 'New'}
                    </button>
                  </div>
                  <select
                    value={dishCategory}
                    onChange={e => {
                      if (e.target.value === '__NEW__') {
                        setShowCategoryModal(true);
                      } else {
                        setDishCategory(e.target.value);
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}{c.name} {c.name_amharic ? `(${c.name_amharic})` : ''}
                      </option>
                    ))}
                    <option value="__NEW__">+ {language === 'am' ? 'አዲስ ምድብ ፍጠር...' : 'Create New Category...'}</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? `ዋጋ (${t('currency')})` : `Price (${t('currency')})`}
                  </label>
                  <input type="number" min="0" step="0.5" required value={dishPrice} onChange={e => setDishPrice(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የማብሰያ ጣቢያ' : 'Station Routing'}
                  </label>
                  <select value={dishRouting} onChange={e => setDishRouting(e.target.value as any)} style={{ width: '100%' }}>
                    <option value="KITCHEN">🍳 KITCHEN (ወጥ ቤት)</option>
                    <option value="BAR">☕ BAR (መጠጥ ማዘጋጃ)</option>
                    <option value="BOTH">⚡ BOTH (ሁለቱም)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የማብሰያ ጊዜ (ደቂቃ)' : 'Prep Time (Mins)'}
                  </label>
                  <input type="number" min="1" max="180" value={dishPrepMinutes} onChange={e => setDishPrepMinutes(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>

              <ImageUploadCompressor
                value={dishPhoto}
                onChange={setDishPhoto}
                label={language === 'am' ? 'የምግብ ፎቶ' : 'Dish Photo'}
              />

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የአዘገጃጀት ማስታወሻ / መግለጫ' : 'Recipe Notes & Description'}
                </label>
                <textarea rows={2} placeholder="Ingredients, prep instructions, allergens..." value={dishDesc} onChange={e => setDishDesc(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setShowDishModal(false)} className="btn btn-secondary" style={{ flex: 1, height: 44 }}>
                  {language === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button type="submit" disabled={savingDish} className="btn btn-primary" style={{ flex: 2, height: 44, fontWeight: 800 }}>
                  {savingDish ? (language === 'am' ? 'በመመዝገብ ላይ...' : 'Saving...') : (language === 'am' ? 'ምግቡን መዝግብ' : 'Create Menu Dish')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modify Order Modal */}
      {modifyingOrder && (
        <ModifyOrderModal
          order={modifyingOrder}
          onClose={() => setModifyingOrder(null)}
          onSuccess={() => {
            setModifyingOrder(null);
            loadKitchenQueue();
          }}
        />
      )}
    </div>
  );
};
