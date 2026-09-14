import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Plus, Minus, Send, CheckCircle2, Clock, UtensilsCrossed, AlertCircle } from 'lucide-react';

export const WaiterView: React.FC = () => {
  const { currentBranchId, t, user } = useApp();
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

  const loadData = () => {
    api.request<any[]>(`/tables?branchId=${currentBranchId}`).then(setTables).catch(() => {});
    api.request<any[]>('/menu/categories').then(setCategories).catch(() => {});
    api.request<any[]>('/menu/items').then(setMenuItems).catch(() => {});
    api.request<any[]>(`/orders?branchId=${currentBranchId}&myOrders=true`).then(setMyOrders).catch(() => {});
  };

  useEffect(() => {
    loadData();
    const unsub = api.onEvent((event) => {
      if (['ORDER_CONFIRMED', 'ORDER_READY', 'ORDER_DELIVERED'].includes(event.type)) {
        loadData();
      }
    });
    return unsub;
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
      alert('Please select a table for Dine-In order');
      return;
    }
    if (cartList.length === 0) {
      alert('Cart is empty');
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

      setSuccessBanner(`Order #${res.orderNumber || ''} sent to Cashier for confirmation!`);
      setCart({});
      setSpecialNotes('');
      loadData();
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async (orderId: string) => {
    try {
      await api.request(`/orders/${orderId}/deliver`, { method: 'POST' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error delivering order');
    }
  };

  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(m => m.category_id === selectedCategory);

  const readyOrders = myOrders.filter(o => o.status === 'READY');
  const activeOrders = myOrders.filter(o => ['PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY'].includes(o.status));

  return (
    <div className="view-body animate-fade-in">
      {/* Tab Switcher */}
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
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
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  {t('select_table')}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {tables.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTable(t.id)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        border: selectedTable === t.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: selectedTable === t.id ? 'var(--primary-light)' : t.status === 'OCCUPIED' ? '#fef2f2' : '#ffffff',
                        color: selectedTable === t.id ? 'var(--primary)' : t.status === 'OCCUPIED' ? '#ef4444' : 'var(--text-main)'
                      }}
                    >
                      {t.table_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Menu Categories Horizontal Scroller */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: selectedCategory === 'all' ? 'var(--primary)' : 'var(--bg-subtle)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-main)'
              }}
            >
              All Items
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  background: selectedCategory === c.id ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: selectedCategory === c.id ? '#ffffff' : 'var(--text-main)'
                }}
              >
                {c.name}
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
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: m.routing_destination === 'KITCHEN' ? '#b45309' : '#0284c7', background: m.routing_destination === 'KITCHEN' ? '#fef3c7' : '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>
                      {m.routing_destination}
                    </span>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{m.name}</h4>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {m.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>
                      {m.price} {t('currency')}
                    </span>

                    {inCart > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', borderRadius: 20, padding: '2px 6px' }}>
                        <button onClick={() => removeFromCart(m.id)} style={{ color: 'var(--primary)' }}><Minus size={14} /></button>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>{inCart}</span>
                        <button onClick={() => addToCart(m)} style={{ color: 'var(--primary)' }}><Plus size={14} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(m)}
                        style={{
                          background: 'var(--primary)',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Plus size={16} />
                      </button>
                    )}
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
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#047857' }}>Order #{o.order_number}</span>
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
              <div key={o.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>Order #{o.order_number}</span>
                  <span className={`badge badge-${o.status.toLowerCase().replace('_', '-')}`}>
                    {t(`status_${o.status}`) || o.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                  {o.table_number ? `Table ${o.table_number}` : o.order_type} • {o.items?.length} items
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-main)', background: 'var(--bg-subtle)', padding: 8, borderRadius: 8 }}>
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
    </div>
  );
};
