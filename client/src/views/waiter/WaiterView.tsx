import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { Plus, Minus, Send, CheckCircle2, Clock, UtensilsCrossed, AlertCircle, ShoppingBag, Check, RefreshCw, Search, History, Eye } from 'lucide-react';
import { OrderProgressStepper } from '../../components/OrderProgressStepper';
import { UniversalStatusBadge } from '../../components/UniversalStatusBadge';
import { OrderHistoryModal } from '../../components/OrderHistoryModal';
import { ModifyOrderModal } from '../../components/ModifyOrderModal';
import { tactileFeedback, speak } from '../../utils/feedback';
import { gToast } from '../../utils/toast';
import { resolveImageUrl } from '../../utils/imageUrl';
import { formatOrderDateTime } from '../../utils/timezone';

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
  const [activeTab, setActiveTab] = useState<'create' | 'active' | 'ready' | 'history'>('create');
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
  const [modifyingOrder, setModifyingOrder] = useState<any | null>(null);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 860);

  useEffect(() => {
    const handleResize = () => setIsWide(window.innerWidth >= 860);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


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

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    api.request<any[]>(`/orders/history/waiter?branchId=${currentBranchId}`)
      .then(data => setHistoryOrders(data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [currentBranchId]);

  const loadData = () => {
    api.request<any[]>(`/tables?branchId=${currentBranchId}`).then(setTables).catch(() => {});
    api.request<any[]>('/menu/categories').then(setCategories).catch(() => {});
    api.request<any[]>('/menu/items').then(setMenuItems).catch(() => {});
    api.request<any[]>(`/orders?branchId=${currentBranchId}&myOrders=true`).then(setMyOrders).catch(() => {});
    loadHistory();
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

  const readyOrders = myOrders.filter(o => o.status === 'READY' || (o.status === 'PARTIALLY_READY' && o.items?.some((it: any) => it.status === 'READY')));
  const activeOrders = myOrders.filter(o => ['PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'DELIVERED'].includes(o.status));

  const renderTablePicker = () => (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      boxShadow: 'var(--shadow-sm)',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, width: '100%', boxSizing: 'border-box' }}>
        {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map(type => {
          const isSelected = orderType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setOrderType(type)}
              style={{
                flex: 1,
                padding: '9px 2px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                border: isSelected ? '2px solid #ea580c' : '1px solid var(--border, #e2e8f0)',
                background: isSelected ? '#fff7ed' : 'var(--bg-subtle, #f8fafc)',
                color: isSelected ? '#ea580c' : 'var(--text-main, #334155)',
                cursor: 'pointer',
                textAlign: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
            >
              {type === 'DINE_IN' ? t('dine_in') : type === 'TAKEAWAY' ? t('takeaway') : t('delivery')}
            </button>
          );
        })}
      </div>

      {orderType === 'DINE_IN' && (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main, #0f172a)', display: 'block', marginBottom: 8 }}>
            📍 {t('select_table')} {selectedTable && <span style={{ color: '#ea580c', fontWeight: 900 }}>({tables.find(tb => tb.id === selectedTable)?.table_number || ''})</span>}
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))',
            gap: 6,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}>
            {tables.map(tbl => {
              const isSelected = selectedTable === tbl.id;
              const isOccupied = tbl.status === 'OCCUPIED';
              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => setSelectedTable(tbl.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 12,
                    textAlign: 'center',
                    border: isSelected ? '2.5px solid #ea580c' : '1px solid var(--border, #e2e8f0)',
                    background: isSelected ? '#fff7ed' : isOccupied ? '#fef2f2' : 'var(--bg-card, #ffffff)',
                    color: isSelected ? '#ea580c' : 'var(--text-main, #0f172a)',
                    boxShadow: isSelected ? '0 0 0 2px rgba(234, 88, 12, 0.25)' : 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {tbl.table_number}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: isOccupied ? '#ef4444' : '#10b981',
                    color: '#ffffff',
                    whiteSpace: 'nowrap'
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
  );

  const renderCategories = () => (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
      <button
        onClick={() => setSelectedCategory('all')}
        style={{
          padding: '8px 16px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          background: selectedCategory === 'all' ? '#1e293b' : 'var(--bg-subtle, #f1f5f9)',
          color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-main, #334155)',
          border: selectedCategory === 'all' ? '1px solid #1e293b' : '1px solid var(--border, #e2e8f0)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <span>🍽️</span> {language === 'am' ? 'ሁሉም' : 'All Items'}
      </button>
      {categories.map(c => {
        const isSelected = selectedCategory === c.id;
        return (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              background: isSelected ? '#1e293b' : 'var(--bg-subtle, #f1f5f9)',
              color: isSelected ? '#ffffff' : 'var(--text-main, #334155)',
              border: isSelected ? '1px solid #1e293b' : '1px solid var(--border, #e2e8f0)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{CATEGORY_EMOJIS[c.id] || '🍴'}</span>
            <span>{language === 'am' ? (c.name_amharic || CATEGORY_NAMES_AM[c.id] || c.name) : c.name}</span>
          </button>
        );
      })}
    </div>
  );

  // Format variation label for display (supporting Amharic localization)
  const formatVariationTitle = (title: string) => {
    if (!title) return '';
    if (language !== 'am') return title;
    return title
      .replace(/Single Slice/gi, 'አንድ ቁራጭ')
      .replace(/Single Piece/gi, 'አንድ ፍሬ')
      .replace(/Pastry Box of (\d+)/gi, 'የ $1 ሳጥን')
      .replace(/Box of (\d+)/gi, 'የ $1 ሳጥን')
      .replace(/Large/gi, 'ትልቅ')
      .replace(/Medium/gi, 'መካከለኛ')
      .replace(/Small/gi, 'ትንሽ');
  };

  // Helper to group similar bakery items by product while keeping standard items separate
  interface GroupedMenuItem {
    id: string;
    isGroup: boolean;
    baseItem: any;
    productName: string;
    productNameAmharic: string;
    description: string;
    photoUrl: string;
    categoryId: string;
    routingDestination: string;
    variations: any[];
  }

  const groupMenuItems = (items: any[]): GroupedMenuItem[] => {
    const groups: { [key: string]: GroupedMenuItem } = {};
    const result: GroupedMenuItem[] = [];

    for (const item of items) {
      const hasBakeryProduct = Boolean(item.bakery_product_id);
      const isBakery = item.category_id === 'cat_bakery' || item.routing_destination === 'FRONT_COUNTER';

      const nameMatch = item.name.match(/^(.*?)\s*\((.*?)\)$/);
      const amharicMatch = item.name_amharic ? item.name_amharic.match(/^(.*?)\s*\((.*?)\)$/) : null;

      let groupKey: string;
      let isBakeryGroup = false;

      if (hasBakeryProduct) {
        groupKey = `bp_${item.bakery_product_id}`;
        isBakeryGroup = true;
      } else if (isBakery && (nameMatch || item.bakery_variation_id)) {
        const baseEnglish = nameMatch ? nameMatch[1].trim() : item.name;
        groupKey = `bakery_base_${baseEnglish.toLowerCase()}`;
        isBakeryGroup = true;
      } else {
        groupKey = `item_${item.id}`;
      }

      // Variation title extraction
      const variationTitle = item.bakery_variation_name || (nameMatch ? nameMatch[2].trim() : (item.bakery_size || 'Standard'));
      const variationTitleAmharic = amharicMatch ? amharicMatch[2].trim() : variationTitle;

      const variationItem = {
        ...item,
        variationTitle,
        variationTitleAmharic
      };

      if (!groups[groupKey]) {
        const baseAmharic = item.bakery_product_name_amharic 
          || (amharicMatch ? amharicMatch[1].trim() : (item.name_amharic || item.name));
        const baseEnglish = item.bakery_product_name 
          || (nameMatch ? nameMatch[1].trim() : item.name);
        const baseDesc = item.bakery_product_description 
          || (item.description ? item.description.replace(/\s*—\s*.*$/, '').trim() : '');
        const photo = item.bakery_product_photo || item.photo_url;

        groups[groupKey] = {
          id: groupKey,
          isGroup: isBakeryGroup,
          baseItem: item,
          productName: baseEnglish,
          productNameAmharic: baseAmharic,
          description: baseDesc,
          photoUrl: photo,
          categoryId: item.category_id,
          routingDestination: item.routing_destination || 'FRONT_COUNTER',
          variations: [variationItem]
        };
        result.push(groups[groupKey]);
      } else {
        groups[groupKey].variations.push(variationItem);
        groups[groupKey].isGroup = true;
      }
    }

    // Sort variations within each group by price ascending
    for (const group of result) {
      if (group.variations.length > 1) {
        group.variations.sort((a, b) => (a.price || 0) - (b.price || 0));
      }
    }

    return result;
  };

  const renderMenuItems = () => {
    const groupedList = groupMenuItems(filteredMenuItems);

    return (
      <div className="waiter-menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        {groupedList.map(group => {
          // If combined bakery group with multiple sizes/types
          if (group.isGroup && group.variations.length > 1) {
            const totalInCart = group.variations.reduce((sum, v) => sum + (cart[v.id]?.quantity || 0), 0);

            return (
              <div
                key={group.id}
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  border: totalInCart > 0 ? '1.5px solid #ea580c' : '1px solid var(--border, #e2e8f0)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: totalInCart > 0 ? '0 4px 14px rgba(234, 88, 12, 0.16)' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Photo Banner with Badges */}
                <div style={{ position: 'relative', width: '100%', height: 120, background: 'linear-gradient(135deg, #f97316, #ea580c)', overflow: 'hidden' }}>
                  {group.photoUrl ? (
                    <img
                      src={resolveImageUrl(group.photoUrl)}
                      alt={group.productName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.waiter-item-initial') as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {/* Fallback initial */}
                  <div
                    className="waiter-item-initial"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: group.photoUrl ? 'none' : 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: 32,
                      fontWeight: 800
                    }}
                  >
                    {group.productName.charAt(0)}
                  </div>

                  {/* Routing Badge */}
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      fontSize: 9,
                      fontWeight: 800,
                      color: group.routingDestination === 'KITCHEN' ? '#b45309' : '#0284c7',
                      background: group.routingDestination === 'KITCHEN' ? 'rgba(254, 243, 199, 0.95)' : 'rgba(224, 242, 254, 0.95)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    {group.routingDestination}
                  </span>

                  {/* Floating In-Cart Badge for this bakery item */}
                  {totalInCart > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 10,
                        fontWeight: 900,
                        color: '#ffffff',
                        background: '#ea580c',
                        padding: '3px 8px',
                        borderRadius: 12,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                    >
                      <span>🛒</span> {totalInCart} {language === 'am' ? 'በትዕዛዝ' : 'in cart'}
                    </span>
                  )}
                </div>

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    {/* Amharic name primary, English subtitle secondary */}
                    <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 2px', lineHeight: 1.3, color: 'var(--text-main, #0f172a)' }}>
                      {group.productNameAmharic || group.productName}
                    </h4>
                    {group.productNameAmharic && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>
                        {group.productName}
                      </span>
                    )}
                    {group.description && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {group.description}
                      </p>
                    )}

                    {/* Section Header: Sizes & Types */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '8px 0 6px',
                      paddingBottom: 4,
                      borderBottom: '1px dashed var(--border, #e2e8f0)'
                    }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {language === 'am' ? 'መጠኖችና አይነቶች' : 'Sizes & Types'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#ea580c', background: '#fff7ed', padding: '1px 6px', borderRadius: 10 }}>
                        {group.variations.length} {language === 'am' ? 'አማራጮች' : 'types'}
                      </span>
                    </div>

                    {/* Variations Buttons List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.variations.map(v => {
                        const qty = cart[v.id]?.quantity || 0;
                        const stock = v.bakery_counter_stock ?? v.counter_stock;
                        const hasStock = stock !== undefined && stock !== null && stock > 0;
                        const isOutOfStock = stock !== undefined && stock !== null && stock <= 0;
                        const isItemDisabled = v.is_available === 0;
                        const isBakeryPaused = v.bakery_variation_available === 0;

                        // Can sell if counter stock exists, even if bakery paused new baking batches
                        const isUnavailable = isItemDisabled || isOutOfStock || (isBakeryPaused && !hasStock);
                        const title = formatVariationTitle(v.variationTitle);
                        const reason = v.bakery_unavailable_reason || v.unavailable_reason;

                        return (
                          <div
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '7px 9px',
                              borderRadius: 9,
                              border: qty > 0 
                                ? '1.5px solid #ea580c' 
                                : isUnavailable
                                  ? '1px dashed #fca5a5'
                                  : '1px solid var(--border, #e2e8f0)',
                              background: qty > 0 
                                ? '#fff7ed' 
                                : isUnavailable
                                  ? '#fff1f2'
                                  : 'var(--bg-subtle, #f8fafc)',
                              opacity: isUnavailable ? 0.75 : 1,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {/* Left: Size/Type Name & Price */}
                            <div style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
                              <div style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                color: qty > 0 ? '#c2410c' : isUnavailable ? '#991b1b' : 'var(--text-main, #0f172a)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 900, color: qty > 0 ? '#ea580c' : 'var(--text-main, #334155)' }}>
                                  {v.price} <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>{t('currency')}</span>
                                </span>
                                {!isUnavailable && stock !== undefined && stock !== null && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: stock <= 2 ? '#dc2626' : '#16a34a' }}>
                                    {stock} {language === 'am' ? 'ቀሪ' : 'left'}
                                    {isBakeryPaused && <span style={{ color: '#d97706', marginLeft: 3 }}>({language === 'am' ? 'የመጨረሻ' : 'Last batch'})</span>}
                                  </span>
                                )}
                                {isUnavailable && reason && (
                                  <span style={{ fontSize: 9, fontWeight: 600, color: '#dc2626' }}>
                                    ({reason})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right: Add Button or Stepper */}
                            {isUnavailable ? (
                              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#ef4444', background: '#fee2e2', padding: '3px 6px', borderRadius: 5 }}>
                                {language === 'am' ? 'አልቋል' : 'Unavailable'}
                              </span>
                            ) : qty > 0 ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                background: '#ffffff',
                                border: '1.5px solid #ea580c',
                                borderRadius: 16,
                                padding: '2px 5px',
                                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.15)'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    tactileFeedback('click');
                                    removeFromCart(v.id);
                                  }}
                                  style={{
                                    color: '#ea580c',
                                    width: 22,
                                    height: 22,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                  title="Remove one"
                                >
                                  <Minus size={13} strokeWidth={3} />
                                </button>
                                <span style={{ fontSize: 12.5, fontWeight: 900, color: '#ea580c', minWidth: 16, textAlign: 'center' }}>
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    tactileFeedback('pop');
                                    addToCart(v);
                                  }}
                                  style={{
                                    color: '#ea580c',
                                    width: 22,
                                    height: 22,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                  title="Add one more"
                                >
                                  <Plus size={13} strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  tactileFeedback('pop');
                                  addToCart(v);
                                }}
                                style={{
                                  background: 'linear-gradient(135deg, #ff9e01, #ea580c)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '5px 11px',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  boxShadow: '0 2px 5px rgba(234, 88, 12, 0.25)',
                                  transition: 'all 0.15s ease'
                                }}
                                title={`Add ${title}`}
                              >
                                <Plus size={13} strokeWidth={3} />
                                <span>{language === 'am' ? 'ጨምር' : 'Add'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Bottom Summary Footer (eliminates bottom empty space) */}
                  <div style={{
                    marginTop: 12,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border, #f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    {totalInCart > 0 ? (
                      <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#fff7ed',
                        border: '1px solid #fdba74',
                        borderRadius: 8,
                        padding: '5px 9px'
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#c2410c' }}>
                          🛒 {totalInCart} {language === 'am' ? 'በትዕዛዝ' : 'in order'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: '#ea580c' }}>
                          {group.variations.reduce((sum, v) => sum + (v.price || 0) * (cart[v.id]?.quantity || 0), 0)} {t('currency')}
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        color: 'var(--text-muted, #64748b)',
                        fontSize: 11
                      }}>
                        <span style={{ fontWeight: 600 }}>{language === 'am' ? 'የዋጋ ክልል' : 'Price range'}</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-main, #334155)' }}>
                          {(() => {
                            const prices = group.variations.map(v => v.price || 0).filter(p => p > 0);
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return min === max ? `${min} ${t('currency')}` : `${min} – ${max} ${t('currency')}`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Single Item Card (for non-grouped standard menu items)
          const m = group.variations[0] || group.baseItem;
          const inCart = cart[m.id]?.quantity || 0;

          return (
            <div
              key={m.id}
              style={{
                background: 'var(--bg-card, #ffffff)',
                border: inCart > 0 ? '1.5px solid #ea580c' : '1px solid var(--border, #e2e8f0)',
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: inCart > 0 ? '0 4px 14px rgba(234, 88, 12, 0.16)' : '0 2px 8px rgba(0,0,0,0.06)'
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

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  {/* Amharic name primary, English subtitle secondary */}
                  <h4 style={{ fontSize: 15, fontWeight: 800, margin: '2px 0 2px', lineHeight: 1.3, color: 'var(--text-main, #0f172a)' }}>
                    {m.name_amharic || m.name}
                  </h4>
                  {m.name_amharic && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>
                      {m.name}
                    </span>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
                      {m.price}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', marginLeft: 3 }}>
                      {t('currency')}
                    </span>
                  </div>

                  {inCart > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1.5px solid #ea580c', borderRadius: 20, padding: '4px 8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          tactileFeedback('click');
                          removeFromCart(m.id);
                        }}
                        style={{ color: '#ea580c', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Minus size={16} strokeWidth={3} />
                      </button>
                      <span style={{ fontSize: 15, fontWeight: 900, color: '#ea580c', minWidth: 18, textAlign: 'center' }}>
                        {inCart}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          tactileFeedback('pop');
                          addToCart(m);
                        }}
                        style={{ color: '#ea580c', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
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
                        background: 'linear-gradient(135deg, #ff9e01, #ea580c)',
                        color: '#ffffff',
                        borderRadius: 12,
                        width: 44,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 3px 10px rgba(234, 88, 12, 0.35)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      title="Add item"
                    >
                      <Plus size={22} strokeWidth={3} color="#ffffff" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCartDrawer = () => {
    if (cartList.length === 0) {
      if (!isWide) return null;
      return (
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1.5px dashed var(--border, #cbd5e1)',
          borderRadius: 16,
          padding: '28px 14px',
          textAlign: 'center',
          color: 'var(--text-muted, #64748b)',
          boxShadow: 'var(--shadow-sm)',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          <ShoppingBag size={36} style={{ margin: '0 auto 10px', opacity: 0.4, color: '#ea580c' }} />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
            {language === 'am' ? 'ምንም ትዕዛዝ አልተመረጠም' : 'No items selected'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted, #64748b)' }}>
            {language === 'am' ? 'ምግቦችን ለመጨመር ካታሎጉን ይጫኑ' : 'Click menu items to add to order'}
          </div>
        </div>
      );
    }

    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 16,
        padding: 14,
        boxShadow: 'var(--shadow-lg)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--text-main, #0f172a)' }}>
          {language === 'am' ? 'የአሁኑ ትዕዛዝ' : 'Current Order'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {cartList.map(line => (
            <div key={line.item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{line.quantity}x {line.item.name}</span>
              <span style={{ fontWeight: 800 }}>{line.item.price * line.quantity} {t('currency')}</span>
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
                  background: 'var(--bg-subtle, #f1f5f9)',
                  border: '1px solid var(--border, #e2e8f0)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-main, #334155)',
                  cursor: 'pointer'
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
          style={{ width: '100%', height: 60, marginBottom: 12, resize: 'none', padding: 8, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}
        />

        <div style={{ borderTop: '1px dashed var(--border, #e2e8f0)', paddingTop: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{t('subtotal')}</span>
            <span>{subtotal} {t('currency')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{t('tax_vat')}</span>
            <span>{vat} {t('currency')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, marginTop: 4 }}>
            <span>{t('total')}</span>
            <span style={{ color: '#ea580c' }}>{total} {t('currency')}</span>
          </div>
        </div>

        <button
          disabled={loading}
          onClick={handleSubmitOrder}
          className="btn btn-primary btn-block"
          style={{ height: 48, background: 'linear-gradient(135deg, #ff9e01, #ea580c)', color: '#ffffff', fontWeight: 800, fontSize: 15 }}
        >
          <Send size={16} />
          {loading ? 'Sending...' : t('place_order_btn')}
        </button>
      </div>
    );
  };

  return (
    <div className="view-body animate-fade-in">
      {/* Connection Status + Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: isConnected ? '#065f46' : '#991b1b', background: isConnected ? '#ecfdf5' : '#fef2f2', padding: '4px 10px', borderRadius: 20 }}>
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
        <button onClick={triggerRefresh} disabled={isRefreshing} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>{language === 'am' ? 'አድስ' : 'Refresh'}</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-subtle, #f1f5f9)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          style={{
            flex: 1,
            padding: '10px 6px',
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 8,
            background: activeTab === 'create' ? '#1e293b' : 'transparent',
            color: activeTab === 'create' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'create' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {language === 'am' ? 'ትዕዛዝ መውሰጃ' : 'Take Order'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ready')}
          style={{
            flex: 1,
            padding: '10px 6px',
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 8,
            background: activeTab === 'ready' ? '#059669' : 'transparent',
            color: activeTab === 'ready' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'ready' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.15s ease'
          }}
        >
          {language === 'am' ? 'የደረሱ' : 'Ready'} ({readyOrders.length})
          {readyOrders.length > 0 && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', position: 'absolute', top: 6, right: 10 }} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          style={{
            flex: 1,
            padding: '10px 6px',
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 8,
            background: activeTab === 'active' ? '#ea580c' : 'transparent',
            color: activeTab === 'active' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'active' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {language === 'am' ? 'ንቁ' : 'Active'} ({activeOrders.length})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('history'); loadHistory(); }}
          style={{
            flex: 1,
            padding: '10px 6px',
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 8,
            background: activeTab === 'history' ? '#4f46e5' : 'transparent',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'history' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease'
          }}
        >
          <History size={14} />
          {language === 'am' ? 'ታሪክ' : 'History'}
        </button>
      </div>

      {successBanner && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          <CheckCircle2 size={18} color="#059669" />
          {successBanner}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="waiter-view-layout">
          {/* Main Column: Categories & Menu Grid (plus Table Picker on mobile) */}
          <div className="waiter-main-column">
            {!isWide && renderTablePicker()}
            {renderCategories()}
            {renderMenuItems()}
            {!isWide && cartList.length > 0 && renderCartDrawer()}
          </div>

          {/* Sticky Side Column on Tablet / Desktop: Table Picker + Live Cart */}
          {isWide && (
            <div className="waiter-side-column">
              {renderTablePicker()}
              {renderCartDrawer()}
            </div>
          )}
        </div>
      )}

      {/* Ready Orders Tab */}
      {activeTab === 'ready' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
          alignItems: 'start'
        }}>
          {readyOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
          alignItems: 'start'
        }}>
          {activeOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
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

                {['PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY'].includes(o.status) && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setModifyingOrder(o)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>✏️</span>
                      {language === 'am' ? 'ትዕዛዝ አስተካክል / ምግብ ቀይር' : 'Modify Order'}
                    </button>
                  </div>
                )}

                {o.status === 'DELIVERED' && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#065f46' }}>
                      ✓ {language === 'am' ? 'ለደንበኛ ደርሷል (ክፍያ በመጠባበቅ ላይ)' : 'Delivered to Customer (Awaiting Payment)'}
                    </span>
                    <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>
                      {language === 'am' ? 'ካሸር ጋር አስጨርስ' : 'Settle at Cashier'}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Order History Tab */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={language === 'am' ? 'የትዕዛዝ ቁጥር፣ ጠረጴዛ ወይም የምግብ ስም ፈልግ...' : 'Search by order #, table, or item name...'}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* List count */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{language === 'am' ? 'ያስተናገዷቸው ትዕዛዞች' : 'Orders Taken by You'}</span>
            <span>
              {historyOrders.filter(o => {
                if (!historySearch.trim()) return true;
                const q = historySearch.toLowerCase();
                const matchNum = String(o.order_number).includes(q);
                const matchTable = (o.table_number && String(o.table_number).toLowerCase().includes(q)) || (o.table_name && o.table_name.toLowerCase().includes(q));
                const matchItems = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                const matchStatus = o.status?.toLowerCase().includes(q);
                return matchNum || matchTable || matchItems || matchStatus;
              }).length} {language === 'am' ? 'ትዕዛዞች' : 'orders'}
            </span>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <p>{language === 'am' ? 'የታሪክ መረጃዎች እየተጫኑ ነው...' : 'Loading order history...'}</p>
            </div>
          ) : historyOrders.filter(o => {
            if (!historySearch.trim()) return true;
            const q = historySearch.toLowerCase();
            const matchNum = String(o.order_number).includes(q);
            const matchTable = (o.table_number && String(o.table_number).toLowerCase().includes(q)) || (o.table_name && o.table_name.toLowerCase().includes(q));
            const matchItems = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
            const matchStatus = o.status?.toLowerCase().includes(q);
            return matchNum || matchTable || matchItems || matchStatus;
          }).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', background: 'var(--surface-muted, #f8fafc)', borderRadius: 14 }}>
              <History size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>{language === 'am' ? 'ምንም የትዕዛዝ ታሪክ አልተገኘም' : 'No order history found'}</p>
              <span style={{ fontSize: 12 }}>{language === 'am' ? 'የፈጠሯቸው ትዕዛዞች እዚህ በሙሉ በዝርዝር ይመዘገባሉ' : 'Orders you take from tables will automatically appear here.'}</span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
              alignItems: 'start'
            }}>
              {historyOrders.filter(o => {
                if (!historySearch.trim()) return true;
                const q = historySearch.toLowerCase();
                const matchNum = String(o.order_number).includes(q);
                const matchTable = (o.table_number && String(o.table_number).toLowerCase().includes(q)) || (o.table_name && o.table_name.toLowerCase().includes(q));
                const matchItems = o.items?.some((it: any) => it.name?.toLowerCase().includes(q) || it.menu_name?.toLowerCase().includes(q) || it.name_amharic?.includes(q));
                const matchStatus = o.status?.toLowerCase().includes(q);
                return matchNum || matchTable || matchItems || matchStatus;
              }).map(o => (
                <div
                  key={o.id}
                  onClick={() => setSelectedHistoryOrder(o)}
                  style={{
                    background: 'var(--surface, #ffffff)',
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
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: '#f97316', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 13
                      }}>
                        #{o.order_number}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>
                          {o.table_number ? `Table ${o.table_number}` : (o.table_name || o.order_type)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatOrderDateTime(o.created_at, language === 'am' ? 'am-ET' : 'en-US')}
                        </div>
                      </div>
                    </div>

                    <UniversalStatusBadge status={o.status} size="sm" />
                  </div>

                  {/* Items summary */}
                  <div style={{ fontSize: 12, color: 'var(--text-main)', background: 'var(--bg-subtle, #f8fafc)', padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {o.items?.map((it: any, idx: number) => (
                        <span key={it.id || idx} style={{ fontWeight: 500 }}>
                          {it.quantity}x {language === 'am' && it.name_amharic ? it.name_amharic : (it.menu_name || it.name)}{idx < o.items.length - 1 ? ' • ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {o.items?.length || 0} {language === 'am' ? 'ዓይነት ምግቦች' : 'items'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>
                        {(o.total_amount || 0).toLocaleString()} ETB
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedHistoryOrder(o); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 8,
                          background: '#eff6ff', color: '#1d4ed8',
                          border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} /> {language === 'am' ? 'ዝርዝር' : 'View'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button for Cart Review on mobile */}
      {activeTab === 'create' && !isWide && cartList.length > 0 && (
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

      {/* Order Detail Modal */}
      {selectedHistoryOrder && (
        <OrderHistoryModal
          order={selectedHistoryOrder}
          onClose={() => setSelectedHistoryOrder(null)}
          role="waiter"
        />
      )}

      {/* Modify Order Modal */}
      {modifyingOrder && (
        <ModifyOrderModal
          order={modifyingOrder}
          onClose={() => setModifyingOrder(null)}
          onSuccess={() => {
            setModifyingOrder(null);
            // Refresh waiter orders
            api.request<any[]>('/orders?myOrders=true').then(res => setMyOrders(res || [])).catch(() => {});
          }}
        />
      )}
    </div>
  );
};

