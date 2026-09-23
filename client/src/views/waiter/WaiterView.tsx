import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Plus, Minus, Send, CheckCircle2, Clock, UtensilsCrossed, AlertCircle, ShoppingBag, Check, RefreshCw } from 'lucide-react';
import { OrderProgressStepper } from '../../components/OrderProgressStepper';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { tactileFeedback, speak } from '../../utils/feedback';
import { gToast } from '../../utils/toast';
import { resolveImageUrl } from '../../utils/imageUrl';

const CATEGORY_EMOJIS: Record<string, string> = {
  cat_burgers: '🍔',
  cat_pizza: '🍕',
  cat_coffee: '☕',
  cat_cold_drinks: '🧃',
  cat_dessert: '🍰',
  cat_traditional: '🍲'
};

const CATEGORY_NAMES_AM: Record<string, string> = {
  cat_burgers: 'በርገር',
  cat_pizza: 'ፒዛ',
  cat_coffee: 'ቡናና ሻይ',
  cat_cold_drinks: 'ቀዝቃዛ መጠጦች',
  cat_dessert: 'ጣፋጭ',
  cat_traditional: 'ባህላዊ ምግቦች'
};

export const WaiterView: React.FC = () => {
  const { currentBranchId, t, user, language } = useApp();
  const [activeTab, setActiveTab] = useState<'create' | 'active' | 'ready'>('create');
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'>('DINE_IN');
  const [cart, setCart] = useState<{ [id: string]: { item: any; quantity: number; notes: string } }>({});
  const [specialNotes, setSpecialNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh fallback (30 seconds)
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  // Keep the ref current
  useEffect(() => {
    loadCallbackRef.current = loadData;
  });

  const triggerRefresh = () => {
    setIsRefreshing(true);
    if ('vibrate' in navigator) {
      try { navigator.vibrate(30); } catch (_) {}
    }
    loadData();
    setTimeout(() => {
      setIsRefreshing(false);
      gToast.success(language === 'am' ? 'መረጃዎች ታድሰዋል' : 'Data refreshed');
    }, 600);
  };

  const loadData = () => {
    api.request<any[]>(`/tables?branchId=${currentBranchId}`).then(setTables).catch(() => {});
    api.request<any[]>('/menu/categories').then(setCategories).catch(() => {});
    api.request<any[]>('/menu/items').then(setMenuItems).catch(() => {});
    api.request<any[]>(`/orders?branchId=${currentBranchId}&myOrders=true`).then(setMyOrders).catch(() => {});
  };

  useEffect(() => {
    loadData();
    setIsConnected(api.isConnected);

    const unsub = api.onEvent((event) => {
      if (['ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_DELIVERED', 'ORDER_PENDING_CASHIER'].includes(event.type)) {
        setTimeout(() => {
          loadCallbackRef.current();
          if (event.type === 'ORDER_READY') {
            gToast.success(`🔔 Order #${event.payload?.orderNumber} is ready for delivery!`);
          }
        }, 300);
      }
    });

    // Auto-refresh fallback every 30 seconds
    loadTimerRef.current = setInterval(() => {
      loadCallbackRef.current();
    }, 30000);

    // Live WebSocket connection status
    const unsubStatus = api.onStatusChange(setIsConnected);

    return () => {
      unsub();
      unsubStatus();
      if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    };
  }, [currentBranchId]);

  const addToCart = (item: any) => {
    setCart(prev => ({
      ...prev,
      [item.id]: {
        item,
        quantity: (prev[item.id]?.quantity || 0) + 1,
        notes: prev[item.id]?.notes || ''
      }
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemId].quantity > 1) {
        next[itemId].quantity -= 1;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const cartList = Object.values(cart);
  const subtotal = cartList.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const vat = +(subtotal * 0.15).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);

  const handleSubmitOrder = async () => {
    if (orderType === 'DINE_IN' && !selectedTable) {
      tactileFeedback('warning');
      gToast.error(t('select_table_first'));
      speak(language === 'am' ? 'እባክዎ መጀመሪያ ጠረጴዛ ይምረጡ' : 'Please select a table first', language);
      return;
    }
    if (cartList.length === 0) {
      tactileFeedback('warning');
      gToast.error(t('cart_empty'));
      speak(language === 'am' ? 'ትዕዛዝ አልተመረጠም' : 'Order is empty', language);
      return;
    }

    setLoading(true);
    try {
      const itemsPayload = cartList.map(c => ({
        menu_item_id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
        notes: c.notes,
        routing_destination: c.item.routing_destination
      }));

      const res = await api.request<any>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: currentBranchId,
          table_id: orderType === 'DINE_IN' ? selectedTable : null,
          order_type: orderType,
          items: itemsPayload,
          special_notes: specialNotes,
          client_tx_id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        })
      });

      tactileFeedback('success');
      speak(language === 'am' ? `ትዕዛዝ ቁጥር ${res.orderNumber || ''} ተልኳል` : `Order ${res.orderNumber || ''} sent to cashier`, language);

      gToast.success(t('order_sent_success'));
      setSuccessBanner(`Order #${res.orderNumber || ''} sent to Cashier!`);
      setCart({});
      setSpecialNotes('');
      loadData();
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async (orderId: string) => {
    try {
      await api.request(`/orders/${orderId}/deliver`, { method: 'POST' });
      tactileFeedback('success');
      speak(language === 'am' ? 'ትዕዛዙ ለደንበኛው ደርሷል' : 'Order delivered to table', language);
      gToast.success(t('delivered_btn'));
      loadData();
    } catch (err: any) {
      tactileFeedback('error');
      gToast.error(err.message || 'Error delivering order');
    }
  };

  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(m => m.category_id === selectedCategory);

  const readyOrders = myOrders.filter(o => o.status === 'READY');
  const activeOrders = myOrders.filter(o => ['PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY'].includes(o.status));

  return (
    <div className="view-body animate-fade-in">
      {/* Connection Status + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: isConnected ? '#065f46' : '#991b1b', background: isConnected ? '#ecfdf5' : '#fef2f2', padding: '3px 8px', borderRadius: 12 }}>
          {isConnected ? '🟢' : '🔴'} {isConnected ? 'Live' : 'Offline'}
        </div>
        <button onClick={triggerRefresh} disabled={isRefreshing} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('create')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'create' ? '#ffffff' : 'transparent', color: activeTab === 'create' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: activeTab === 'create' ? 'var(--shadow-sm)' : 'none' }}
        >
          Take Order
        </button>
        <button
          onClick={() => setActiveTab('ready')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'ready' ? '#ffffff' : 'transparent', color: activeTab === 'ready' ? 'var(--accent)' : 'var(--text-muted)', position: 'relative' }}
        >
          Ready ({readyOrders.length})
          {readyOrders.length > 0 && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', position: 'absolute', top: 6, right: 14 }} />}
        </button>
        <button
          onClick={() => setActiveTab('active')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'active' ? '#ffffff' : 'transparent', color: activeTab === 'active' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Active ({activeOrders.length})
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: isConnected ? '#ecfdf5' : '#fef2f2',
          color: isConnected ? '#065f46' : '#991b1b',
          border: `1px solid ${isConnected ? '#a7f3d0' : '#fca5a5'}`
        }}>
          <span>{isConnected ? '🟢' : '🔴'}</span>
          <span style={{ display: 'inline-block' }}>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        <button
          type="button"
          onClick={triggerRefresh}
          title={language === 'am' ? 'አድስ' : 'Refresh'}
          style={{
            padding: '8px',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {successBanner && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          <CheckCircle2 size={18} color="#059669" />
          {successBanner}
        </div>
      )}

      {activeTab === 'create' && (
        <div>
          {/* Order Type & Table Picker */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: orderType === type ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: orderType === type ? 'var(--primary-light)' : 'transparent',
                    color: orderType === type ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  {type === 'DINE_IN' ? t('dine_in') : type === 'TAKEAWAY' ? t('takeaway') : t('delivery')}
                </button>
              ))}
            </div>

            {orderType === 'DINE_IN' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>
                  📍 {t('select_table')} {selectedTable && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>({tables.find(tb => tb.id === selectedTable)?.table_number || ''})</span>}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {tables.map(tbl => {
                    const isSelected = selectedTable === tbl.id;
                    const isOccupied = tbl.status === 'OCCUPIED';
                    return (
                      <button
                        key={tbl.id}
                        type="button"
                        onClick={() => setSelectedTable(tbl.id)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 12,
                          textAlign: 'center',
                          border: isSelected ? '2.5px solid var(--primary)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--primary-light)' : isOccupied ? '#fef2f2' : 'var(--bg-card)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                          boxShadow: isSelected ? '0 0 0 2px var(--primary)' : 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 800 }}>
                          {tbl.table_number}
                        </span>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isOccupied ? '#ef4444' : '#10b981',
                          color: '#ffffff'
                        }}>
                          {isOccupied ? (language === 'am' ? 'የተያዘ' : 'Occupied') : (language === 'am' ? 'ነፃ' : 'Available')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Menu Categories Horizontal Scroller with Amharic Labels */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                background: selectedCategory === 'all' ? 'var(--primary)' : 'var(--bg-subtle)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🍽️</span> {language === 'am' ? 'ሁሉም' : 'All Items'}
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background: selectedCategory === c.id ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: selectedCategory === c.id ? '#ffffff' : 'var(--text-main)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{CATEGORY_EMOJIS[c.id] || '🍴'}</span>
                <span>{language === 'am' ? (c.name_amharic || CATEGORY_NAMES_AM[c.id] || c.name) : c.name}</span>
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {filteredMenuItems.map(m => {
              const inCart = cart[m.id]?.quantity || 0;
              return (
                <div
                  key={m.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {/* Photo or Gradient Avatar Banner */}
                  <div style={{ position: 'relative', width: '100%', height: 120, background: 'linear-gradient(135deg, #f97316, #ea580c)', overflow: 'hidden' }}>
                    {m.photo_url ? (
                      <img
                        src={resolveImageUrl(m.photo_url)}
                        alt={m.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.querySelector('.waiter-item-initial') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    {/* Fallback initial if no photo */}
                    <div
                      className="waiter-item-initial"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: m.photo_url ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 32,
                        fontWeight: 800
                      }}
                    >
                      {m.name.charAt(0)}
                    </div>

                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        fontSize: 9,
                        fontWeight: 800,
                        color: m.routing_destination === 'KITCHEN' ? '#b45309' : '#0284c7',
                        background: m.routing_destination === 'KITCHEN' ? 'rgba(254, 243, 199, 0.95)' : 'rgba(224, 242, 254, 0.95)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {m.routing_destination}
                    </span>
                  </div>

                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      {/* Amharic name primary, English subtitle secondary */}
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 2px', lineHeight: 1.3, color: 'var(--text-main)' }}>
                        {m.name_amharic || m.name}
                      </h4>
                      {m.name_amharic && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                          {m.name}
                        </span>
                      )}
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {m.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div>
                        <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)' }}>
                          {m.price}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 3 }}>
                          {t('currency')}
                        </span>
                      </div>

                      {inCart > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', borderRadius: 20, padding: '4px 8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              tactileFeedback('click');
                              removeFromCart(m.id);
                            }}
                            style={{ color: 'var(--primary)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={16} strokeWidth={3} />
                          </button>
                          <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--primary)', minWidth: 18, textAlign: 'center' }}>
                            {inCart}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              tactileFeedback('pop');
                              addToCart(m);
                            }}
                            style={{ color: 'var(--primary)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            tactileFeedback('pop');
                            addToCart(m);
                          }}
                          style={{
                            background: 'var(--primary)',
                            color: '#ffffff',
                            borderRadius: 12,
                            width: 44,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          title="Add item"
                        >
                          <Plus size={22} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Order Drawer / Summary */}
          {cartList.length > 0 && (
            <div style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              boxShadow: 'var(--shadow-lg)'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Current Order</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {cartList.map(line => (
                  <div key={line.item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{line.quantity}x {line.item.name}</span>
                    <span style={{ fontWeight: 700 }}>{line.item.price * line.quantity} {t('currency')}</span>
                  </div>
                ))}
              </div>

              {/* Quick Preset Note Chips */}
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'ፈጣን ማስታወሻ (ለመምረጥ ይንኩ):' : 'Quick Notes (Tap to add):'}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: language === 'am' ? '🌶️ ያለ በርበሬ' : '🌶️ No Spice', val: 'ያለ በርበሬ' },
                    { label: language === 'am' ? '🥩 በደንብ የበሰለ' : '🥩 Well Done', val: 'በደንብ የበሰለ' },
                    { label: language === 'am' ? '📦 በፓኬት' : '📦 Packaged', val: 'በፓኬት' },
                    { label: language === 'am' ? '⚡ በአስቸኳይ' : '⚡ Urgent', val: 'በአስቸኳይ' }
                  ].map(chip => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => setSpecialNotes(prev => prev ? `${prev}, ${chip.val}` : chip.val)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-main)'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                placeholder={t('special_instructions')}
                value={specialNotes}
                onChange={e => setSpecialNotes(e.target.value)}
                style={{ width: '100%', height: 60, marginBottom: 12, resize: 'none' }}
              />

              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{t('subtotal')}</span>
                  <span>{subtotal} {t('currency')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{t('tax_vat')}</span>
                  <span>{vat} {t('currency')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, marginTop: 4 }}>
                  <span>{t('total')}</span>
                  <span style={{ color: 'var(--primary)' }}>{total} {t('currency')}</span>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={handleSubmitOrder}
                className="btn btn-primary btn-block"
                style={{ height: 48 }}
              >
                <Send size={16} />
                {loading ? 'Sending...' : t('place_order_btn')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ready Orders Tab */}
      {activeTab === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {readyOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <Clock size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 600 }}>No orders currently waiting for delivery</p>
            </div>
          ) : (
            readyOrders.map(o => (
              <div key={o.id} style={{ background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UniversalStatusBadge status="READY" size="sm" />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#047857' }}>Order #{o.order_number}</span>
                  </div>
                  <span className="badge badge-ready">{t('status_READY')}</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 12 }}>
                  📍 {o.table_number ? `Table: ${o.table_number}` : o.order_type}
                </p>
                <div style={{ fontSize: 12, color: 'var(--text-main)', marginBottom: 12 }}>
                  {o.items?.map((it: any) => (
                    <div key={it.id}>• {it.quantity}x {it.name} ({it.routing_destination})</div>
                  ))}
                </div>
                <button
                  onClick={() => handleDeliver(o.id)}
                  className="btn btn-success btn-block"
                >
                  <CheckCircle2 size={16} />
                  {t('mark_delivered')}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Orders Tab */}
      {activeTab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <UtensilsCrossed size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 600 }}>No active pending orders</p>
            </div>
          ) : (
            activeOrders.map(o => (
              <div key={o.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UniversalStatusBadge status={o.status} size="sm" />
                    <span style={{ fontSize: 14, fontWeight: 800 }}>Order #{o.order_number}</span>
                  </div>
                  <span className={`badge badge-${o.status.toLowerCase().replace('_', '-')}`}>
                    {t(`status_${o.status}`) || o.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  {o.table_number ? `Table ${o.table_number}` : o.order_type} • {o.items?.length} items
                </span>

                {/* Status Progression Stepper */}
                <OrderProgressStepper status={o.status} />

                <div style={{ fontSize: 12, color: 'var(--text-main)', background: 'var(--bg-subtle)', padding: 8, borderRadius: 8, marginTop: 8 }}>
                  {o.items?.map((it: any) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{it.quantity}x {it.name}</span>
                      <span style={{ fontWeight: 600, color: it.status === 'READY' ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {it.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating Action Button for Cart Review */}
      {activeTab === 'create' && cartList.length > 0 && (
        <button
          className="fab-button"
          onClick={() => {
            const drawer = document.querySelector('.view-body');
            drawer?.scrollTo({ top: drawer.scrollHeight, behavior: 'smooth' });
          }}
          title="Review Order"
        >
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={22} />
            <span style={{
              position: 'absolute',
              top: -8,
              right: -10,
              background: '#ffffff',
              color: 'var(--primary)',
              borderRadius: '50%',
              width: 18,
              height: 18,
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {cartList.reduce((acc, curr: any) => acc + curr.quantity, 0)}
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
