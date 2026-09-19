import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Users, Building2, Award, Calendar, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AnimatedCounter } from '../../components/AnimatedCounter';

const CHART_COLORS = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899'];

export const OwnerView: React.FC = () => {
  const { currentBranchId, branches, t } = useApp();
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [waiterStats, setWaiterStats] = useState<any[]>([]);
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setError(null);
    let url = `/reports/dashboard?branchId=${currentBranchId}&range=${range}`;
    if (range === 'custom' && customFrom && customTo) {
      url += `&from=${customFrom}&to=${customTo}`;
    }

    api.request<any>(url)
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
  }, [currentBranchId, range, customFrom, customTo]);

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
        <span style={{ fontWeight: 600, fontSize: 14 }}>Loading executive analytics...</span>
      </div>
    );
  }

  const kpis = dashboard.kpis;
  const dailyTrend = dashboard.dailyTrend || [];
  const topSellers = dashboard.topSellers || [];

  return (
    <div className="view-body animate-fade-in">
      {/* Header & Mode Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>Executive Analytics</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Multi-branch business intelligence</span>
        </div>
        <span className="badge badge-confirmed">
          {dashboard.isConsolidated ? '🏢 All Branches' : '📍 Single Branch'}
        </span>
      </div>

      {/* Historical Date Range Filter Bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 10px', marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: '7 Days' },
            { id: 'month', label: '30 Days' },
            { id: 'custom', label: 'Custom' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setRange(p.id as any)}
              style={{
                flex: 1,
                minWidth: 62,
                padding: '5px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: range === p.id ? 'var(--primary)' : 'var(--bg-subtle)',
                color: range === p.id ? '#ffffff' : 'var(--text-main)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <Calendar size={14} color="var(--primary)" />
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 11, flex: 1 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 11, flex: 1 }}
            />
          </div>
        )}
      </div>

      {/* KPI Cards Grid with Animated Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="glass-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginBottom: 6 }}>
            <DollarSign size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</span>
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
            <AnimatedCounter value={kpis.totalSales} suffix={` ${t('currency')}`} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <AnimatedCounter value={kpis.completedOrders} /> orders completed
          </span>
        </div>

        <div className="glass-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', marginBottom: 6 }}>
            <TrendingUp size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Expenses</span>
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
            <AnimatedCounter value={kpis.totalExpenses} suffix={` ${t('currency')}`} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Operations & stock purchases</span>
        </div>

        <div className="glass-card" style={{ padding: 14, border: '1.5px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', marginBottom: 6 }}>
            <Award size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Net Margin</span>
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, color: '#047857', display: 'block' }}>
            <AnimatedCounter value={kpis.netProfit} suffix={` ${t('currency')}`} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Revenue minus Expenses</span>
        </div>

        <div className="glass-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', marginBottom: 6 }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Low Stock</span>
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, color: '#b45309', display: 'block' }}>
            <AnimatedCounter value={kpis.lowStockCount} suffix=" Items" />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Below safety threshold</span>
        </div>
      </div>

      {/* Visual Chart 1: Revenue Trend Bar Chart */}
      <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-main)' }}>
          <BarChart3 size={16} color="var(--primary)" /> Revenue & Sales Trend
        </h3>
        {dailyTrend.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No sales recorded for this period
          </div>
        ) : (
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(d) => d.substring(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(value: any) => [`${value} ${t('currency')}`, 'Revenue']}
                  labelFormatter={(l) => `Date: ${l}`}
                />
                <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Visual Chart 2: Top Selling Items Donut Chart & List */}
      <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-main)' }}>
          <PieIcon size={16} color="var(--primary)" /> Top Selling Items Breakdown
        </h3>
        {topSellers.length === 0 ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No menu item data recorded
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 130, height: 130, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topSellers}
                    dataKey="quantity_sold"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={58}
                    paddingAngle={3}
                  >
                    {topSellers.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`${v} sold`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {topSellers.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{item.name}</span>
                  </div>
                  <strong style={{ color: 'var(--primary)', flexShrink: 0 }}>{item.quantity_sold} sold</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Branch Comparison Table */}
      <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={16} color="var(--primary)" /> Multi-Branch Comparison
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

      {/* Waiter Performance Analytics */}
      <div className="glass-card" style={{ padding: 14 }}>
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
    </div>
  );
};
