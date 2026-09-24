import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, Trash2, Search, AlertCircle, CheckCircle2, ShoppingBag, Utensils } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { gToast } from '../utils/toast';

interface OrderItem {
  id?: string;
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  routing_destination?: 'KITCHEN' | 'BAR' | 'BOTH';
}

interface ModifyOrderModalProps {
  order: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModifyOrderModal: React.FC<ModifyOrderModalProps> = ({ order, onClose, onSuccess }) => {
  const { currentBranchId, language, t } = useApp();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [menuCatalog, setMenuCatalog] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modificationReason, setModificationReason] = useState(
    language === 'am' ? 'የግብዓት እጥረት / የምግብ ለውጥ' : 'Insufficient ingredients / item substitution'
  );
  const [saving, setSaving] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Initialize with current order items
  useEffect(() => {
    if (order && order.items) {
      setItems(
        order.items.map((it: any) => ({
          menu_item_id: it.menu_item_id,
          name: it.menu_name || it.name,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          notes: it.notes || '',
          routing_destination: it.routing_destination || 'KITCHEN'
        }))
      );
    }
  }, [order]);

  // Load menu items for adding replacement dishes
  useEffect(() => {
    if (!order) return;
    const fetchMenu = async () => {
      setLoadingMenu(true);
      try {
        const branchParam = order.branch_id || currentBranchId;
        const res = await api.request<any[]>(`/menu/items?branchId=${branchParam}`);
        setMenuCatalog(res || []);
      } catch (err) {
        console.error('Failed to load menu catalog for modification:', err);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchMenu();
  }, [order, currentBranchId]);

  if (!order) return null;

  const handleUpdateQuantity = (idx: number, delta: number) => {
    setItems(prev => {
      const copy = [...prev];
      const newQty = copy[idx].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== idx);
      }
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddItem = (dish: any) => {
    setItems(prev => {
      const existingIdx = prev.findIndex(it => it.menu_item_id === dish.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: dish.id,
          name: dish.name,
          price: Number(dish.price) || 0,
          quantity: 1,
          notes: '',
          routing_destination: dish.routing_destination || 'KITCHEN'
        }
      ];
    });
    gToast.info(language === 'am' ? `+1 ${dish.name} ተጨምሯል` : `Added ${dish.name}`);
  };

  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const vat = +(subtotal * 0.15).toFixed(2);
  const discount = order.discount_amount || 0;
  const total = +(Math.max(0, subtotal + vat - discount)).toFixed(2);

  const handleSave = async () => {
    if (items.length === 0) {
      gToast.error(language === 'am' ? 'ትዕዛዙ ቢያንስ አንድ ምግብ ሊኖረው ይገባል' : 'Order must contain at least one item');
      return;
    }

    setSaving(true);
    try {
      await api.request(`/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          items,
          modification_reason: modificationReason
        })
      });

      gToast.success(language === 'am' ? 'ትዕዛዙ በተሳካ ሁኔታ ተሻሽሏል' : 'Order modified successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenu = menuCatalog.filter(m => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    const nameMatch = m.name?.toLowerCase().includes(q);
    const amharicMatch = m.name_amharic?.includes(q);
    return nameMatch || amharicMatch;
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          borderRadius: 18,
          width: '100%',
          maxWidth: 620,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-subtle, #f8fafc)'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✏️</span>
              {language === 'am' ? `ትዕዛዝ #${order.order_number} ማስተካከያ` : `Modify Order #${order.order_number}`}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {order.table_number ? `${language === 'am' ? 'ጠረጴዛ' : 'Table'} ${order.table_number}` : order.order_type}
              {' • '}
              {order.status}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Notice banner */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#b45309',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              {language === 'am'
                ? 'ምግብ ወይም ግብዓት ሲያልቅ እዚህ ጋር ሌላ ምግብ መቀየር፣ መጠኑን መቀነስ ወይም ማስወገድ ይችላሉ።'
                : 'Replace unavailable dishes, adjust quantities, or remove items that lack required ingredients.'}
            </span>
          </div>

          {/* Current Order Items */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, display: 'block' }}>
              {language === 'am' ? 'በትዕዛዙ ውስጥ ያሉ ምግቦች:' : 'Current Order Items:'}
            </label>

            {items.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
                {language === 'am' ? 'ሁሉም ምግቦች ተወግደዋል። እባክዎ አዲስ ምግብ ይጨምሩ።' : 'All items removed. Please add replacement dishes below.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border)',
                      padding: '10px 12px',
                      borderRadius: 12
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {it.price} {t('currency')} × {it.quantity} = {(it.price * it.quantity).toLocaleString()} {t('currency')}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(idx, -1)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Minus size={14} />
                      </button>

                      <span style={{ fontWeight: 800, fontSize: 14, minWidth: 22, textAlign: 'center' }}>
                        {it.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(idx, 1)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Plus size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          border: '1px solid #fee2e2',
                          background: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 4
                        }}
                        title={language === 'am' ? 'አስወግድ' : 'Remove'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & Add Replacement Item */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, display: 'block' }}>
              {language === 'am' ? '+ ተተኪ ምግብ ፈልገው ይጨምሩ:' : '+ Search & Add Replacement Dish:'}
            </label>

            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={language === 'am' ? 'የተተኪ ምግብ ስም ይተይቡ (ለምሳሌ ፒዛ፣ በርገር...)' : 'Type to search menu item (e.g. Burger, Pizza)...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  fontSize: 13
                }}
              />
            </div>

            {searchQuery.trim() && (
              <div style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {filteredMenu.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {loadingMenu ? 'Loading menu...' : (language === 'am' ? 'ምግብ አልተገኘም' : 'No dishes found')}
                  </div>
                ) : (
                  filteredMenu.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleAddItem(m)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle, #f8fafc)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</span>
                        {m.name_amharic && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({m.name_amharic})</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, display: 'block' }}>
                          {m.price} {t('currency')}
                        </span>
                      </div>
                      <span className="btn btn-sm btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>
                        + {language === 'am' ? 'ጨምር' : 'Add'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Modification Reason */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, display: 'block' }}>
              {language === 'am' ? 'የማሻሻያ ምክንያት (ለምርመራ ይመዘገባል):' : 'Reason for Modification (Logged in Audit):'}
            </label>
            <input
              type="text"
              value={modificationReason}
              onChange={e => setModificationReason(e.target.value)}
              placeholder={language === 'am' ? 'የማሻሻያ ምክንያት ያስገቡ...' : 'Enter reason for modifying...'}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                fontSize: 13
              }}
            />
          </div>

          {/* Summary Calculation */}
          <div style={{
            background: 'var(--bg-subtle, #f8fafc)',
            padding: 14,
            borderRadius: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 13
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>{language === 'am' ? 'የምግቦች ድምር:' : 'Subtotal:'}</span>
              <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} {t('currency')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>{language === 'am' ? 'ተ.እ.ታ (15% VAT):' : 'VAT (15%):'}</span>
              <span style={{ fontWeight: 600 }}>{vat.toLocaleString()} {t('currency')}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                <span>{language === 'am' ? 'ቅናሽ:' : 'Discount:'}</span>
                <span style={{ fontWeight: 600 }}>-{discount.toLocaleString()} {t('currency')}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 800,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              marginTop: 4
            }}>
              <span>{language === 'am' ? 'አዲስ አጠቃላይ ሂሳብ:' : 'New Total Bill:'}</span>
              <span style={{ color: 'var(--primary)' }}>{total.toLocaleString()} {t('currency')}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: 'var(--bg-subtle, #f8fafc)'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontWeight: 600 }}
          >
            {language === 'am' ? 'ሰርዝ' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={saving || items.length === 0}
            onClick={handleSave}
            className="btn btn-primary"
            style={{ padding: '8px 22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CheckCircle2 size={16} />
            {saving ? (language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving...') : (language === 'am' ? 'ትዕዛዝ አስተካክልና አስቀምጥ' : 'Save & Update Order')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
