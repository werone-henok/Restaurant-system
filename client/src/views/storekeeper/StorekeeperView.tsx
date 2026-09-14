import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { Package, AlertTriangle, ArrowDownLeft, Trash2, Plus, RefreshCw } from 'lucide-react';

export const StorekeeperView: React.FC = () => {
  const { currentBranchId, t } = useApp();
  const [stockList, setStockList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'receive' | 'waste'>('stock');
  const [loading, setLoading] = useState(false);

  // Receive stock form
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [receiveQuantity, setReceiveQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(100);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Waste form
  const [wasteIngredient, setWasteIngredient] = useState('');
  const [wasteQuantity, setWasteQuantity] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Spoiled');
  const [wastePhoto, setWastePhoto] = useState<string | null>(null);

  const loadStock = () => {
    api.request<any[]>(`/inventory?branchId=${currentBranchId}`)
      .then(data => {
        setStockList(data);
        if (data.length > 0) {
          setSelectedIngredient(data[0].id);
          setWasteIngredient(data[0].id);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStock();
    const unsub = api.onEvent((event) => {
      if (['STOCK_UPDATED', 'LOW_STOCK_ALERT'].includes(event.type)) {
        loadStock();
      }
    });
    return unsub;
  }, [currentBranchId]);

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.request('/inventory/receive', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: currentBranchId,
          invoice_number: invoiceNumber,
          items: [{
            ingredient_id: selectedIngredient,
            quantity: Number(receiveQuantity),
            unit_price: Number(unitCost)
          }]
        })
      });
      alert('Stock successfully received and inventory updated!');
      loadStock();
      setActiveTab('stock');
    } catch (err: any) {
      alert(err.message || 'Failed to receive stock');
    } finally {
      setLoading(false);
    }
  };

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
      alert('Waste recorded and stock deducted');
      setWastePhoto(null);
      loadStock();
      setActiveTab('stock');
    } catch (err: any) {
      alert(err.message || 'Failed to record waste');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab('stock')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'stock' ? '#ffffff' : 'transparent', color: activeTab === 'stock' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Stock Catalog
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'receive' ? '#ffffff' : 'transparent', color: activeTab === 'receive' ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          Receive Stock
        </button>
        <button
          onClick={() => setActiveTab('waste')}
          style={{ flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700, borderRadius: 8, background: activeTab === 'waste' ? '#ffffff' : 'transparent', color: activeTab === 'waste' ? 'var(--danger)' : 'var(--text-muted)' }}
        >
          Record Waste
        </button>
      </div>

      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stockList.map(item => (
            <div
              key={item.id}
              style={{
                background: '#ffffff',
                border: item.is_low_stock ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                borderRadius: 14,
                padding: 14,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800 }}>{item.name}</h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.category} • Shelf: {item.shelf_location || 'Main Store'}
                  </span>
                </div>
                {item.is_low_stock ? (
                  <span className="badge badge-pending">
                    <AlertTriangle size={12} /> {t('low_stock_warning')}
                  </span>
                ) : (
                  <span className="badge badge-ready">OK</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Available: <strong style={{ color: item.is_low_stock ? '#f59e0b' : 'var(--text-main)' }}>{item.current_quantity} {item.unit}</strong>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Min Threshold: {item.min_stock_level} {item.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'receive' && (
        <form onSubmit={handleReceiveStock} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Receive Goods from Supplier</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ingredient</label>
            <select value={selectedIngredient} onChange={e => setSelectedIngredient(e.target.value)} style={{ width: '100%' }}>
              {stockList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantity</label>
              <input type="number" step="any" required value={receiveQuantity} onChange={e => setReceiveQuantity(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unit Cost ({t('currency')})</label>
              <input type="number" step="any" required value={unitCost} onChange={e => setUnitCost(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Invoice / Delivery Reference</label>
            <input type="text" placeholder="e.g. INV-9042" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={{ width: '100%' }} />
          </div>

          <button type="submit" disabled={loading} className="btn btn-success btn-block" style={{ height: 48 }}>
            <ArrowDownLeft size={16} />
            {loading ? 'Receiving...' : 'Add to Stock Room'}
          </button>
        </form>
      )}

      {activeTab === 'waste' && (
        <form onSubmit={handleLogWaste} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Record Waste or Spoilage</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ingredient</label>
            <select value={wasteIngredient} onChange={e => setWasteIngredient(e.target.value)} style={{ width: '100%' }}>
              {stockList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Wasted Quantity</label>
              <input type="number" step="any" required value={wasteQuantity} onChange={e => setWasteQuantity(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Reason</label>
              <select value={wasteReason} onChange={e => setWasteReason(e.target.value)} style={{ width: '100%' }}>
                <option value="Spoiled">Spoiled / Rot</option>
                <option value="Expired">Expired</option>
                <option value="Burned">Burned during prep</option>
                <option value="Damaged">Damaged packaging</option>
                <option value="Customer return">Customer Return</option>
              </select>
            </div>
          </div>

          <CameraCapture
            label="Waste Proof / Item Photo"
            photoUrl={wastePhoto}
            onPhotoCaptured={setWastePhoto}
            onPhotoCleared={() => setWastePhoto(null)}
          />

          <button type="submit" disabled={loading} className="btn btn-danger btn-block" style={{ height: 48 }}>
            <Trash2 size={16} />
            {loading ? 'Logging Waste...' : 'Deduct & Record Waste'}
          </button>
        </form>
      )}
    </div>
  );
};
