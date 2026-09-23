import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { 
  Package, 
  AlertTriangle, 
  ArrowDownLeft, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Edit, 
  Search, 
  Wifi, 
  WifiOff, 
  X, 
  Check,
  MapPin,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { gToast } from '../../utils/toast';
import { tactileFeedback } from '../../utils/feedback';
import { resolveImageUrl } from '../../utils/imageUrl';

const CATEGORIES = [
  { id: 'Vegetables', label: 'Vegetables', labelAm: 'አትክልቶች', emoji: '🥦' },
  { id: 'Meat', label: 'Meat & Poultry', labelAm: 'ስጋና ዶሮ', emoji: '🥩' },
  { id: 'Dairy', label: 'Dairy & Eggs', labelAm: 'የወተት ተዋፅኦ', emoji: '🧀' },
  { id: 'Dry Goods', label: 'Dry Goods & Grains', labelAm: 'እህልና ደረቅ ዕቃዎች', emoji: '🌾' },
  { id: 'Beverages', label: 'Beverages', labelAm: 'መጠጦች', emoji: '🥤' },
  { id: 'Bakery', label: 'Bakery', labelAm: 'ዳቦና ኬክ', emoji: '🍞' },
  { id: 'Spices', label: 'Spices & Sauces', labelAm: 'ቅመማ ቅመም', emoji: '🌶️' },
  { id: 'Packaging', label: 'Packaging', labelAm: 'ማሸጊያዎች', emoji: '📦' },
  { id: 'Cleaning', label: 'Cleaning & Hygiene', labelAm: 'የጽዳት ዕቃዎች', emoji: '🧼' },
  { id: 'Other', label: 'Other', labelAm: 'ሌሎች', emoji: '🥫' }
];

const UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'bottle', 'can', 'box', 'bag', 'pack'];

interface IngredientFormData {
  id?: string;
  name: string;
  name_amharic: string;
  category: string;
  sku: string;
  unit: string;
  unit_cost: number;
  min_stock_level: number;
  max_stock_level: number;
  shelf_location: string;
  expiration_date: string;
  photo_url: string | null;
}

const initialFormData: IngredientFormData = {
  name: '',
  name_amharic: '',
  category: 'Vegetables',
  sku: '',
  unit: 'kg',
  unit_cost: 0,
  min_stock_level: 5,
  max_stock_level: 100,
  shelf_location: 'Main Store',
  expiration_date: '',
  photo_url: null
};

export const StorekeeperView: React.FC = () => {
  const { currentBranchId, user, language, t } = useApp();
  const [stockList, setStockList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'receive' | 'waste'>('stock');
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(api.isConnected);

  // Permissions:
  // Storekeeper: create and edit, CANNOT delete
  // Admin & Owner: create, edit, AND delete
  const canDelete = user?.role === 'admin' || user?.role === 'owner';
  const canManage = user?.role === 'storekeeper' || user?.role === 'admin' || user?.role === 'owner';

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Ingredient Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<IngredientFormData>(initialFormData);
  const [formSaving, setFormSaving] = useState(false);

  // Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Receive stock form
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(100);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivingDate, setReceivingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);

  // Waste form
  const [wasteIngredient, setWasteIngredient] = useState('');
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Spoiled');
  const [wastePhoto, setWastePhoto] = useState<string | null>(null);

  // Stable callback ref for 30s auto-refresh fallback
  const loadCallbackRef = useRef<() => void>(() => {});

  const loadStock = () => {
    setIsRefreshing(true);
    api.request<any[]>(`/inventory?branchId=${currentBranchId}`)
      .then(data => {
        setStockList(data);
        if (data.length > 0) {
          if (!selectedIngredient) setSelectedIngredient(data[0].id);
          if (!wasteIngredient) setWasteIngredient(data[0].id);
        }
      })
      .catch(err => {
        console.error('Failed to load inventory:', err);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    loadCallbackRef.current = loadStock;
  });

  // WebSocket event listening & 30s auto-refresh fallback
  useEffect(() => {
    loadStock();

    const unsubStatus = api.onStatusChange(setIsConnected);

    const unsubEvent = api.onEvent((event) => {
      if (['STOCK_UPDATED', 'LOW_STOCK_ALERT'].includes(event.type)) {
        loadStock();
      }
    });

    const timer = setInterval(() => {
      loadCallbackRef.current();
    }, 30000);

    return () => {
      unsubStatus();
      unsubEvent();
      clearInterval(timer);
    };
  }, [currentBranchId]);

  const triggerRefresh = () => {
    tactileFeedback('click');
    loadStock();
    gToast.success(language === 'am' ? 'የክምችት መረጃዎች ታድሰዋል' : 'Inventory refreshed');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    tactileFeedback('click');
    setFormData(initialFormData);
    setModalMode('create');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: any) => {
    tactileFeedback('click');
    setFormData({
      id: item.id,
      name: item.name,
      name_amharic: item.name_amharic || '',
      category: item.category || 'Vegetables',
      sku: item.sku || '',
      unit: item.unit || 'kg',
      unit_cost: item.unit_cost || 0,
      min_stock_level: item.min_stock_level || 5,
      max_stock_level: item.max_stock_level || 100,
      shelf_location: item.shelf_location || 'Main Store',
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
      photo_url: item.photo_url || null
    });
    setModalMode('edit');
    setShowModal(true);
  };

  // Save Ingredient (Create or Edit)
  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      gToast.error(language === 'am' ? 'እባክዎ የግብዓቱን ስም ያስገቡ' : 'Please enter ingredient name');
      return;
    }

    setFormSaving(true);
    try {
      if (modalMode === 'create') {
        await api.request('/inventory/ingredients', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name.trim(),
            name_amharic: formData.name_amharic.trim() || null,
            category: formData.category,
            sku: formData.sku.trim() || null,
            unit: formData.unit,
            unit_cost: Number(formData.unit_cost) || 0,
            min_stock_level: Number(formData.min_stock_level) || 5,
            max_stock_level: Number(formData.max_stock_level) || 100,
            shelf_location: formData.shelf_location.trim() || 'Main Store',
            photo_url: formData.photo_url || null,
            expiration_date: formData.expiration_date || null
          })
        });
        gToast.success(language === 'am' ? 'አዲስ ግብዓት በተሳካ ሁኔታ ተመዝግቧል!' : 'Ingredient added to master catalog!');
      } else {
        await api.request(`/inventory/ingredients/${formData.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name.trim(),
            name_amharic: formData.name_amharic.trim() || null,
            category: formData.category,
            sku: formData.sku.trim() || null,
            unit: formData.unit,
            unit_cost: Number(formData.unit_cost) || 0,
            min_stock_level: Number(formData.min_stock_level) || 5,
            max_stock_level: Number(formData.max_stock_level) || 100,
            shelf_location: formData.shelf_location.trim() || 'Main Store',
            photo_url: formData.photo_url || null,
            expiration_date: formData.expiration_date || null
          })
        });
        gToast.success(language === 'am' ? 'ግብዓቱ በተሳካ ሁኔታ ተሻሽሏል!' : 'Ingredient updated successfully!');
      }
      tactileFeedback('success');
      setShowModal(false);
      loadStock();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to save ingredient');
      tactileFeedback('error');
    } finally {
      setFormSaving(false);
    }
  };

  // Open Delete Confirmation (Admin / Owner only)
  const handleOpenDelete = (item: any) => {
    if (!canDelete) {
      gToast.error(language === 'am' ? 'ግብዓት የመሰረዝ ፈቃድ የለዎትም' : 'You do not have permission to delete ingredients');
      return;
    }
    tactileFeedback('warning');
    setItemToDelete(item);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await api.request(`/inventory/ingredients/${itemToDelete.id}`, {
        method: 'DELETE'
      });
      gToast.success(language === 'am' ? `"${itemToDelete.name}" በተሳካ ሁኔታ ተሰርዟል` : `"${itemToDelete.name}" deleted successfully`);
      tactileFeedback('success');
      setItemToDelete(null);
      loadStock();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete ingredient');
      tactileFeedback('error');
    } finally {
      setDeleting(false);
    }
  };

  // Receive Stock Handler
  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.request('/inventory/receive', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: currentBranchId,
          invoice_number: invoiceNumber,
          receiving_date: receivingDate,
          receipt_photo_url: receiptPhoto,
          items: [{
            ingredient_id: selectedIngredient,
            quantity: Number(receiveQuantity),
            unit_price: Number(unitCost)
          }]
        })
      });
      gToast.success(language === 'am' ? 'ዕቃው ተረክቧል፣ በወጪዎች መዝገብ ላይ ተመዝግቧል!' : 'Stock received and expense recorded!');
      tactileFeedback('success');
      setInvoiceNumber('');
      setReceiptPhoto(null);
      setReceivingDate(new Date().toISOString().split('T')[0]);
      loadStock();
      setActiveTab('stock');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to receive stock');
      tactileFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  // Log Waste Handler
  const handleLogWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ing = stockList.find(s => s.id === wasteIngredient);
      await api.request('/inventory/waste', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: currentBranchId,
          ingredient_id: wasteIngredient,
          quantity: Number(wasteQuantity),
          unit: ing?.unit || 'g',
          reason: wasteReason,
          photo_url: wastePhoto
        })
      });
      gToast.success(language === 'am' ? 'የብልሽት መዝገብ ተይዞ ከክምችት ተቀንሷል' : 'Waste recorded and stock deducted');
      tactileFeedback('success');
      setWastePhoto(null);
      loadStock();
      setActiveTab('stock');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to record waste');
      tactileFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Stock Items
  const filteredStock = stockList.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name_amharic && item.name_amharic.includes(searchQuery)) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.shelf_location && item.shelf_location.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesLowStock = !onlyLowStock || Boolean(item.is_low_stock);

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const lowStockCount = stockList.filter(s => s.is_low_stock).length;

  const getCategoryEmoji = (category: string) => {
    const found = CATEGORIES.find(c => c.id.toLowerCase() === (category || '').toLowerCase());
    return found ? found.emoji : '🥫';
  };

  return (
    <div className="view-body animate-fade-in" style={{ paddingBottom: 80 }}>
      {/* Header bar with Live Status & Manual Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
            {t('store_management')}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {stockList.length} {language === 'am' ? 'ግብዓቶች በክምችት ውስጥ' : 'items tracked'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Connection state pill */}
          <span 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 5, 
              padding: '4px 10px', 
              borderRadius: 20, 
              fontSize: 11, 
              fontWeight: 700,
              background: isConnected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: isConnected ? '#16a34a' : '#dc2626',
              border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}
          >
            {isConnected ? <Wifi size={12} className="animate-pulse" /> : <WifiOff size={12} />}
            {isConnected ? (language === 'am' ? 'ቀጥታ' : 'Live') : (language === 'am' ? 'ኦፍላይን' : 'Offline')}
          </span>

          {/* Refresh button */}
          <button 
            onClick={triggerRefresh}
            disabled={isRefreshing}
            style={{ 
              background: 'var(--bg-subtle)', 
              border: '1px solid var(--border)', 
              borderRadius: 10, 
              width: 36, 
              height: 36, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-main)'
            }}
            title={language === 'am' ? 'አድስ' : 'Refresh'}
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <button
          onClick={() => { tactileFeedback('click'); setActiveTab('stock'); }}
          style={{ 
            flex: 1, 
            padding: '10px 0', 
            fontSize: 13, 
            fontWeight: 800, 
            borderRadius: 10, 
            border: 'none',
            background: activeTab === 'stock' ? '#ffffff' : 'transparent', 
            color: activeTab === 'stock' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'stock' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {language === 'am' ? 'የክምችት ዝርዝር' : 'Stock Catalog'}
        </button>
        <button
          onClick={() => { tactileFeedback('click'); setActiveTab('receive'); }}
          style={{ 
            flex: 1, 
            padding: '10px 0', 
            fontSize: 13, 
            fontWeight: 800, 
            borderRadius: 10, 
            border: 'none',
            background: activeTab === 'receive' ? '#ffffff' : 'transparent', 
            color: activeTab === 'receive' ? 'var(--accent)' : 'var(--text-muted)',
            boxShadow: activeTab === 'receive' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {t('receive_goods')}
        </button>
        <button
          onClick={() => { tactileFeedback('click'); setActiveTab('waste'); }}
          style={{ 
            flex: 1, 
            padding: '10px 0', 
            fontSize: 13, 
            fontWeight: 800, 
            borderRadius: 10, 
            border: 'none',
            background: activeTab === 'waste' ? '#ffffff' : 'transparent', 
            color: activeTab === 'waste' ? 'var(--danger)' : 'var(--text-muted)',
            boxShadow: activeTab === 'waste' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {t('record_waste')}
        </button>
      </div>

      {/* ────────────────── Tab 1: Stock Catalog ────────────────── */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Action Header: Search & + Add Ingredient Button */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={language === 'am' ? 'ግብዓት ወይም ምድብ ፈልግ...' : 'Search ingredient, category, shelf...'}
                style={{ width: '100%', paddingLeft: 36, height: 40, borderRadius: 10, fontSize: 13 }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Create Ingredient Button (Storekeeper, Admin, Owner) */}
            {canManage && (
              <button
                onClick={handleOpenCreate}
                className="btn btn-primary"
                style={{ height: 40, padding: '0 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>{language === 'am' ? '+ አዲስ ግብዓት' : '+ New Item'}</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            <button
              onClick={() => { tactileFeedback('click'); setSelectedCategory('ALL'); }}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                border: 'none',
                background: selectedCategory === 'ALL' ? 'var(--primary)' : 'var(--bg-subtle)',
                color: selectedCategory === 'ALL' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              {language === 'am' ? 'ሁሉም' : 'All'} ({stockList.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = stockList.filter(s => (s.category || '').toLowerCase() === cat.id.toLowerCase()).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => { tactileFeedback('click'); setSelectedCategory(cat.id); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    border: 'none',
                    background: selectedCategory === cat.id ? 'var(--primary)' : 'var(--bg-subtle)',
                    color: selectedCategory === cat.id ? '#ffffff' : 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>{cat.emoji}</span>
                  <span>{language === 'am' ? cat.labelAm : cat.label}</span>
                  {count > 0 && <span style={{ opacity: 0.7, fontSize: 10 }}>({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Low Stock Filter Bar */}
          {lowStockCount > 0 && (
            <div 
              onClick={() => { tactileFeedback('click'); setOnlyLowStock(!onlyLowStock); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 10,
                background: onlyLowStock ? '#fef3c7' : 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                <AlertTriangle size={15} />
                <span>
                  {language === 'am' 
                    ? `${lowStockCount} ግብዓቶች ዝቅተኛ ክምችት ላይ ናቸው` 
                    : `${lowStockCount} item${lowStockCount > 1 ? 's' : ''} below minimum threshold`}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textDecoration: 'underline' }}>
                {onlyLowStock ? (language === 'am' ? 'ሁሉንም አሳይ' : 'Show All') : (language === 'am' ? 'እነሱን ብቻ አሳይ' : 'Filter Low')}
              </span>
            </div>
          )}

          {/* Stock Items List */}
          {filteredStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', background: '#ffffff', borderRadius: 16, border: '1px solid var(--border)' }}>
              <Package size={40} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px 0' }}>
                {language === 'am' ? 'ምንም ግብዓት አልተገኘም' : 'No ingredients found'}
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
                {searchQuery 
                  ? (language === 'am' ? 'ከፍለጋዎ ጋር የሚዛመድ ግብዓት የለም' : 'Try adjusting your search criteria')
                  : (language === 'am' ? 'አዲስ ግብዓት በመመዝገብ ይጀምሩ' : 'Add an ingredient to get started')}
              </p>
              {canManage && (
                <button onClick={handleOpenCreate} className="btn btn-primary" style={{ fontSize: 13 }}>
                  <Plus size={16} /> {language === 'am' ? 'አዲስ ግብዓት መዝግብ' : 'Add First Ingredient'}
                </button>
              )}
            </div>
          ) : (
            filteredStock.map(item => {
              const isLow = Boolean(item.is_low_stock);
              const percentage = Math.min(100, Math.round(((item.current_quantity || 0) / (item.min_stock_level || 1)) * 50));

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: isLow ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  {/* Top Row: Photo/Avatar + Title + Badges */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Photo or Category Emoji Avatar */}
                    {item.photo_url ? (
                      <img
                        src={resolveImageUrl(item.photo_url)}
                        alt={item.name}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          objectFit: 'cover',
                          border: '1px solid var(--border)',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          background: 'var(--bg-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          flexShrink: 0
                        }}
                      >
                        {getCategoryEmoji(item.category)}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                            {item.name}
                          </h4>
                          {item.name_amharic && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>
                              {item.name_amharic}
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        {isLow ? (
                          <span className="badge badge-pending" style={{ fontSize: 10, padding: '2px 8px' }}>
                            <AlertTriangle size={11} /> {language === 'am' ? 'ዝቅተኛ' : 'Low Stock'}
                          </span>
                        ) : (
                          <span className="badge badge-ready" style={{ fontSize: 10, padding: '2px 8px' }}>
                            {language === 'am' ? 'በቂ' : 'In Stock'}
                          </span>
                        )}
                      </div>

                      {/* Category & Shelf location */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 11, background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 6, color: 'var(--text-muted)' }}>
                          {item.category}
                        </span>
                        {item.shelf_location && (
                          <span style={{ fontSize: 11, background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 6, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={10} /> {item.shelf_location}
                          </span>
                        )}
                        {item.expiration_status === 'EXPIRING_SOON' && (
                          <span style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                            {language === 'am' ? 'በቅርቡ ያበቃል' : 'Expiring Soon'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Stock Level bar */}
                  <div style={{ background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {language === 'am' ? 'ያለ መጠን' : 'Current Stock'}:
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isLow ? '#d97706' : 'var(--text-main)' }}>
                        {item.current_quantity} {item.unit}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>{language === 'am' ? 'ዝቅተኛ ወሰን' : 'Min'}: {item.min_stock_level} {item.unit}</span>
                      <span>{language === 'am' ? 'ዋጋ' : 'Cost'}: {item.unit_cost} {t('currency')}/{item.unit}</span>
                    </div>
                  </div>

                  {/* Actions Row: Edit (Storekeeper, Admin, Owner) + Delete (Admin & Owner ONLY) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {/* Edit button: available to Storekeeper, Admin, and Owner */}
                    {canManage && (
                      <button
                        onClick={() => handleOpenEdit(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          color: 'var(--text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit size={13} color="var(--primary)" />
                        <span>{language === 'am' ? 'አሻሽል' : 'Edit'}</span>
                      </button>
                    )}

                    {/* Delete button: ONLY visible to Admin and Owner (Storekeeper CANNOT delete) */}
                    {canDelete && (
                      <button
                        onClick={() => handleOpenDelete(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          border: '1px solid #fee2e2',
                          background: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>{language === 'am' ? 'ሰርዝ' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ────────────────── Tab 2: Receive Stock ────────────────── */}
      {activeTab === 'receive' && (
        <form onSubmit={handleReceiveStock} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{t('receive_goods')}</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'ግብዓት ምረጥ' : 'Ingredient'}
            </label>
            <select value={selectedIngredient} onChange={e => setSelectedIngredient(e.target.value)} style={{ width: '100%' }}>
              {stockList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.name_amharic ? `(${s.name_amharic})` : ''} — {s.unit}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'የተቀበሉት መጠን' : 'Quantity'}
              </label>
              <input type="number" step="any" required min="0.01" value={receiveQuantity} onChange={e => setReceiveQuantity(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'የአንዱ ዋጋ' : 'Unit Cost'} ({t('currency')})
              </label>
              <input type="number" step="any" required min="0" value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'የተረከቡበት ቀን *' : 'Date of Receiving *'}
              </label>
              <input
                type="date"
                required
                value={receivingDate}
                onChange={e => setReceivingDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'የደረሰኝ / ኢንቮይስ ቁጥር' : 'Invoice / Delivery Reference'}
              </label>
              <input
                type="text"
                placeholder="e.g. INV-9042"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <CameraCapture
            label={language === 'am' ? 'የክፍያ ወይም የርክክብ ደረሰኝ ፎቶ (ካሜራ ወይም ፋይል)' : 'Delivery / Supplier Receipt Photo (Camera or Upload)'}
            photoUrl={receiptPhoto}
            onPhotoCaptured={setReceiptPhoto}
            onPhotoCleared={() => setReceiptPhoto(null)}
          />

          {/* Automatic Expense Sync Banner */}
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🧾</span>
            <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.4 }}>
              <strong>{language === 'am' ? 'ራስ-ሰር የወጪ መዝገብ' : 'Automatic Expense Tracking'}:</strong>{' '}
              {language === 'am'
                ? `ይህ ርክክብ ሲጠናቀቅ አጠቃላይ ${((Number(receiveQuantity) || 0) * (Number(unitCost) || 0)).toLocaleString()} ብር በወጪዎች ላይ በራስ-ሰር ይመዘገባል እንዲሁም ለአስተዳዳሪው እና ለባለቤቱ ማሳወቂያ ይደርሳል።`
                : `Receiving this delivery will automatically record a ${((Number(receiveQuantity) || 0) * (Number(unitCost) || 0)).toLocaleString()} ${t('currency')} expense voucher and notify the Admin & Owner.`}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-success btn-block" style={{ height: 48 }}>
            <ArrowDownLeft size={16} />
            {loading ? (language === 'am' ? 'በመቀበል ላይ...' : 'Receiving...') : (language === 'am' ? 'ወደ ክምችት ጨምርና ወጪውን መዝግብ' : 'Add to Stock & Record Expense')}
          </button>
        </form>
      )}

      {/* ────────────────── Tab 3: Record Waste ────────────────── */}
      {activeTab === 'waste' && (
        <form onSubmit={handleLogWaste} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{t('record_waste')}</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'የተበላሸ ግብዓት' : 'Ingredient'}
            </label>
            <select value={wasteIngredient} onChange={e => setWasteIngredient(e.target.value)} style={{ width: '100%' }}>
              {stockList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.name_amharic ? `(${s.name_amharic})` : ''} — {s.unit}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'የባከነው መጠን' : 'Wasted Quantity'}
              </label>
              <input type="number" step="any" required min="0.01" value={wasteQuantity} onChange={e => setWasteQuantity(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                {language === 'am' ? 'ምክንያት' : 'Reason'}
              </label>
              <select value={wasteReason} onChange={e => setWasteReason(e.target.value)} style={{ width: '100%' }}>
                <option value="Spoiled">{language === 'am' ? 'የበሰበሰ / የተበላሸ' : 'Spoiled / Rot'}</option>
                <option value="Expired">{language === 'am' ? 'ጊዜው ያለፈበት' : 'Expired'}</option>
                <option value="Burned">{language === 'am' ? 'በዝግጅት ጊዜ የተቃጠለ' : 'Burned during prep'}</option>
                <option value="Damaged">{language === 'am' ? 'የተሰበረ / የተጎዳ' : 'Damaged packaging'}</option>
                <option value="Customer return">{language === 'am' ? 'ከተጠቃሚ የተመለሰ' : 'Customer Return'}</option>
              </select>
            </div>
          </div>

          <CameraCapture
            label={t('capture_photo') || 'Waste Proof / Item Photo'}
            photoUrl={wastePhoto}
            onPhotoCaptured={setWastePhoto}
            onPhotoCleared={() => setWastePhoto(null)}
          />

          <button type="submit" disabled={loading} className="btn btn-danger btn-block" style={{ height: 48 }}>
            <Trash2 size={16} />
            {loading ? (language === 'am' ? 'በመመዝገብ ላይ...' : 'Logging Waste...') : (language === 'am' ? 'ቀንስና ብክነቱን መዝግብ' : 'Deduct & Record Waste')}
          </button>
        </form>
      )}

      {/* ────────────────── Modal: Create / Edit Ingredient ────────────────── */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>
                  {modalMode === 'create' ? '✨' : '✏️'}
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                  {modalMode === 'create' 
                    ? (language === 'am' ? 'አዲስ ግብዓት መመዝገቢያ' : 'Add New Ingredient')
                    : (language === 'am' ? `ግብዓት ማሻሻያ: ${formData.name}` : `Edit Ingredient: ${formData.name}`)}
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveIngredient}>
              {/* English Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የግብዓቱ ስም (በእንግሊዝኛ) *' : 'Ingredient Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Fresh Tomatoes, Mozzarella Cheese"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Amharic Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የግብዓቱ ስም (በአማርኛ)' : 'Ingredient Name (Amharic)'}
                </label>
                <input
                  type="text"
                  value={formData.name_amharic}
                  onChange={e => setFormData({ ...formData, name_amharic: e.target.value })}
                  placeholder="ለምሳሌ፡ ቲማቲም፣ አይብ"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Category & Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'ምድብ *' : 'Category *'}
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {language === 'am' ? c.labelAm : c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'መለኪያ *' : 'Unit *'}
                  </label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit Cost & Min Stock Threshold */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የአንዱ ዋጋ' : 'Unit Cost'} ({t('currency')})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.unit_cost}
                    onChange={e => setFormData({ ...formData, unit_cost: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'ዝቅተኛ የማስጠንቀቂያ መጠን' : 'Min Stock Threshold'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.min_stock_level}
                    onChange={e => setFormData({ ...formData, min_stock_level: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Shelf Location & Expiration Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'መደርደሪያ / ቦታ' : 'Shelf Location'}
                  </label>
                  <input
                    type="text"
                    value={formData.shelf_location}
                    onChange={e => setFormData({ ...formData, shelf_location: e.target.value })}
                    placeholder="e.g. Shelf A-2, Cold Room"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'am' ? 'የሚያበቃበት ቀን' : 'Expiration Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={e => setFormData({ ...formData, expiration_date: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Camera Photo Upload with Auto-compression */}
              <CameraCapture
                label={language === 'am' ? 'የግብዓቱ ፎቶ (ከተፈለገ)' : 'Ingredient Photo (Optional)'}
                photoUrl={formData.photo_url}
                onPhotoCaptured={base64 => setFormData({ ...formData, photo_url: base64 })}
                onPhotoCleared={() => setFormData({ ...formData, photo_url: null })}
              />

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {language === 'am' ? 'ይቅር' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="btn btn-primary"
                  style={{ flex: 2, height: 44, fontSize: 14, fontWeight: 800 }}
                >
                  {formSaving 
                    ? (language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving...')
                    : (modalMode === 'create' 
                        ? (language === 'am' ? 'ግብዓቱን መዝግብ' : 'Save Ingredient') 
                        : (language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Changes'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── Modal: Delete Confirmation (Admin / Owner ONLY) ────────────────── */}
      {itemToDelete && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={() => setItemToDelete(null)}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: 16,
              width: '100%',
              maxWidth: 420,
              padding: 22,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div 
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px'
              }}
            >
              <Trash2 size={26} />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 8, color: 'var(--text-main)' }}>
              {language === 'am' ? 'ግብዓት መሰረዝ ማረጋገጫ' : 'Delete Ingredient'}
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              {language === 'am' 
                ? `"${itemToDelete.name}" የሚለውን ግብዓት በእርግጥ መሰረዝ ይፈልጋሉ? ከክምችት ዝርዝር ውስጥ ይወገዳል።` 
                : `Are you sure you want to delete "${itemToDelete.name}"? It will be removed from the active inventory catalog.`}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {language === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                style={{ flex: 1, height: 44, fontSize: 14, fontWeight: 800 }}
              >
                {deleting 
                  ? (language === 'am' ? 'በመሰረዝ ላይ...' : 'Deleting...') 
                  : (language === 'am' ? 'አዎ ሰርዝ' : 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
