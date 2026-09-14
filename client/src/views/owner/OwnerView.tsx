import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Users, Building2, Award } from 'lucide-react';

export const OwnerView: React.FC = () => {
  const { currentBranchId, branches, t } = useApp();
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [waiterStats, setWaiterStats] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setError(null);
    api.request<any>(`/reports/dashboard?branchId=${currentBranchId}`)
      .then(setDashboard)
      .catch((err) => {
        console.error('Failed to load dashboard:', err);
        setError(err.message || 'Failed to load analytics');
      });

    api.request<any[]>(`/reports/waiters?branchId=${currentBranchId}`)
      .then(setWaiterStats)
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    const unsub = api.onEvent((event) => {
      if (['ORDER_COMPLETED', 'STOCK_UPDATED'].includes(event.type)) {
        loadData();
      }
    });
    return unsub;
  }, [currentBranchId]);

  if (error) {
    return (
      <div className="view-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 700 }}>
          {error}
        </div>
        <button onClick={loadData} className="btn btn-primary">
          Retry Loading
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="view-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 12px' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Loading multi-branch analytics...</span>
      </div>
    );
  }

  const kpis = dashboard.kpis;

  return (
    <div className="view-body animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Business Executive Center</h2>
        <span className="badge badge-confirmed">
          {dashboard.isConsolidated ? 'Consolidated All Branches' : 'Single Branch'}
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginBottom: 6 }}>
            <DollarSign size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
            {kpis.totalSales} {t('currency')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{kpis.completedOrders} completed orders</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', marginBottom: 6 }}>
            <TrendingUp size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Expenses</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
            {kpis.totalExpenses} {t('currency')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Operations & purchases</span>
        </div>

        <div style={{ background: '#ffffff', border: '1.5px solid #10b981', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', marginBottom: 6 }}>
            <Award size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Net Profit</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#047857', display: 'block' }}>
            {kpis.netProfit} {t('currency')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sales minus Expenses</span>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', marginBottom: 6 }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Low Stock</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#b45309', display: 'block' }}>
            {kpis.lowStockCount} Items
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Below safety threshold</span>
        </div>
      </div>

      {/* Multi-Branch Comparison Table (Crucial for Owner) */}
      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={16} color="var(--primary)" /> Branch Comparison
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dashboard.branchComparison?.map((b: any) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-subtle)', borderRadius: 10, fontSize: 13 }}>
              <div>
                <strong>{b.name}</strong>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{b.city} • {b.orders_count} orders</span>
              </div>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                {b.sales} {t('currency')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Waiter Performance (No tips, just orders & sales) */}
      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={16} color="var(--primary)" /> Waiter Performance Analytics
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {waiterStats.map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <strong>{w.full_name}</strong>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                  Completed: {w.completed_orders} | Avg Ticket: {w.avg_order_value} {t('currency')}
                </span>
              </div>
              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                {w.total_sales} {t('currency')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Selling Menu Items */}
      <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShoppingBag size={16} color="var(--primary)" /> Top Selling Menu Items
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dashboard.topSellers?.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
              <span>{i + 1}. {item.name}</span>
              <span style={{ fontWeight: 700 }}>{item.quantity_sold} sold ({item.revenue} {t('currency')})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
