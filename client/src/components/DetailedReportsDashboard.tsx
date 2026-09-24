import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { 
  TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Users, 
  Building2, Award, Calendar, BarChart3, PieChart as PieIcon, 
  Clock, Download, Printer, Percent, ShieldAlert, Sparkles, Receipt,
  CheckCircle2, ArrowUpRight, Flame
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { AnimatedCounter } from './AnimatedCounter';
import { gToast } from '../utils/toast';

const CHART_COLORS = ['#f97316', '#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

interface DetailedReportsDashboardProps {
  branchId?: string;
  isEmbedded?: boolean;
}

export const DetailedReportsDashboard: React.FC<DetailedReportsDashboardProps> = ({
  branchId: propBranchId,
  isEmbedded = false
}) => {
  const { currentBranchId, t, language } = useApp();
  const effectiveBranchId = propBranchId || currentBranchId;

  const [dashboard, setDashboard] = useState<any | null>(null);
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeReportTab, setActiveReportTab] = useState<'overview' | 'hourly' | 'margins' | 'payments' | 'staff'>('overview');
  const [itemsChartMode, setItemsChartMode] = useState<'bar' | 'donut'>('bar');
  const [trendViewMode, setTrendViewMode] = useState<'daily' | 'hourly'>('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(api.isConnected);

  // Auto-refresh fallback every 30 seconds
  const loadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadCallbackRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadCallbackRef.current = loadData;
  });

  const loadData = () => {
    setLoading(true);
    setError(null);
    let url = `/reports/dashboard?branchId=${effectiveBranchId}&range=${range}`;
    if (range === 'custom' && customFrom && customTo) {
      url += `&from=${customFrom}&to=${customTo}`;
    }

    api.request<any>(url)
      .then(setDashboard)
      .catch(err => {
        console.error('Failed to load deep analytics:', err);
        setError(err.message || 'Failed to load report data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    setIsConnected(api.isConnected);

    const unsub = api.onEvent((event) => {
      if (['ORDER_COMPLETED', 'ORDER_CONFIRMED', 'STOCK_UPDATED'].includes(event.type)) {
        loadCallbackRef.current();
      }
    });

    // Auto-refresh every 30 seconds
    loadTimerRef.current = setInterval(() => {
      loadCallbackRef.current();
    }, 30000);

    // Listen for live WebSocket connection status changes
    const unsubStatus = api.onStatusChange(setIsConnected);

    return () => {
      unsub();
      unsubStatus();
      if (loadTimerRef.current) clearInterval(loadTimerRef.current);
    };
  }, [effectiveBranchId, range, customFrom, customTo]);

  const handleExportCsv = () => {
    if (!dashboard) return;
    try {
      const currency = t('currency') || 'ETB';
      let csv = `YO BURGER & RESTAURANT EXECUTIVE REPORT\n`;
      csv += `Generated At,${new Date().toLocaleString()}\n`;
      csv += `Period,${range.toUpperCase()}\n`;
      csv += `Branch ID,${dashboard.selectedBranch}\n\n`;

      csv += `EXECUTIVE FINANCIAL KPIs\n`;
      csv += `Total Revenue,${dashboard.kpis.totalSales} ${currency}\n`;
      csv += `Total Expenses,${dashboard.kpis.totalExpenses} ${currency}\n`;
      csv += `Net Profit,${dashboard.kpis.netProfit} ${currency}\n`;
      csv += `Profit Margin,${dashboard.kpis.grossProfitMargin}%\n`;
      csv += `Completed Orders,${dashboard.kpis.completedOrders}\n`;
      csv += `Cancelled Orders,${dashboard.kpis.cancelledOrders}\n`;
      csv += `Discounts Applied,${dashboard.kpis.totalDiscounts} ${currency}\n`;
      csv += `Cancelled Orders Loss,${dashboard.kpis.cancelledLoss} ${currency}\n\n`;

      csv += `PAYMENT METHODS SUMMARY\n`;
      csv += `Method,Transactions,Total Collected (${currency})\n`;
      (dashboard.paymentMethods || []).forEach((pm: any) => {
        csv += `${pm.method},${pm.tx_count},${pm.total_amount}\n`;
      });
      csv += `\n`;

      csv += `MENU PROFITABILITY & BOM MARGINS\n`;
      csv += `Dish Name,Amharic Name,Selling Price,BOM Food Cost,Unit Margin %,Units Sold,Total Revenue,Gross Profit\n`;
      (dashboard.menuProfitMargins || []).forEach((m: any) => {
        csv += `"${m.name}","${m.name_amharic || ''}",${m.price},${m.cogs_cost},${m.margin_percent}%,${m.units_sold},${m.total_revenue},${m.total_gross_profit}\n`;
      });
      csv += `\n`;

      csv += `WAITER PRODUCTIVITY\n`;
      csv += `Waiter,Orders Completed,Total Revenue Generated (${currency})\n`;
      (dashboard.waiterStats || []).forEach((w: any) => {
        csv += `"${w.waiter_name}",${w.orders_count},${w.sales_total}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Yo_Burger_Report_${range}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      gToast.success(language === 'am' ? 'ሪፖርቱ ወደ CSV ፋይል ወርዷል' : 'Report exported to CSV successfully');
    } catch (e) {
      gToast.error('Failed to export CSV');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 700 }}>{error}</div>
        <button onClick={loadData} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 14px' }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {language === 'am' ? 'ዝርዝር መረጃዎች በመሰብሰብ ላይ...' : 'Loading in-depth analytics...'}
        </span>
      </div>
    );
  }

  const kpis = dashboard.kpis || {};
  const dailyTrend = dashboard.dailyTrend || [];
  const hourlyTrend = dashboard.hourlyTrend || [];
  const paymentMethods = dashboard.paymentMethods || [];
  const menuProfitMargins = dashboard.menuProfitMargins || [];
  const auditLosses = dashboard.auditLosses || {};
  const topSellers = dashboard.topSellers || [];
  const waiterStats = dashboard.waiterStats || [];

  // Identify peak hour
  const peakHour = hourlyTrend.reduce((max: any, cur: any) => (cur.sales > (max?.sales || 0) ? cur : max), null);

  // Total payment sum
  const totalPaymentsCollected = paymentMethods.reduce((acc: number, p: any) => acc + (p.total_amount || 0), 0);

  return (
    <div className="animate-fade-in">
      {/* Header & Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            {language === 'am' ? 'የንግድ ትንታኔ እንትዕዛዝ ሪፖርት' : 'Business Intelligence & Deep Analytics'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {dashboard.isConsolidated 
              ? (language === 'am' ? 'የሁሉም ቅርንጫፎች ጠቅላላ መረጃ' : 'Consolidated Multi-Branch View') 
              : (language === 'am' ? 'የተመረጠው ቅርንጫፍ መረጃ' : 'Single Branch View')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: isConnected ? '#ecfdf5' : '#fef2f2',
            color: isConnected ? '#065f46' : '#991b1b',
            border: `1px solid ${isConnected ? '#a7f3d0' : '#fca5a5'}`
          }}>
            {isConnected ? '🟢 Live' : '🔴 Offline'}
          </div>
          <button
            onClick={handleExportCsv}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> {language === 'am' ? 'CSV አውርድ' : 'Export CSV'}
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} /> {language === 'am' ? 'አትም' : 'Print'}
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 10px', marginBottom: 14, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { id: 'today', label: language === 'am' ? 'ዛሬ' : 'Today' },
            { id: 'yesterday', label: language === 'am' ? 'ትናንት' : 'Yesterday' },
            { id: 'week', label: language === 'am' ? 'ያለፉት 7 ቀናት' : '7 Days' },
            { id: 'month', label: language === 'am' ? 'ያለፉት 30 ቀናት' : '30 Days' },
            { id: 'custom', label: language === 'am' ? 'የተወሰነ ቀን' : 'Custom' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setRange(p.id as any)}
              style={{
                flex: 1,
                minWidth: 70,
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 12,
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
              style={{ padding: '4px 8px', fontSize: 12, flex: 1 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{language === 'am' ? 'እስከ' : 'to'}</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, flex: 1 }}
            />
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {[
          { id: 'overview', icon: BarChart3, label: language === 'am' ? 'ዋና ዳሽቦርድ' : 'Overview' },
          { id: 'hourly', icon: Clock, label: language === 'am' ? 'የሰዓት ትንታኔ (Rush)' : 'Hourly Heatmap' },
          { id: 'margins', icon: Percent, label: language === 'am' ? 'የምግብ ትርፍ (BOM)' : 'Profit Margins' },
          { id: 'payments', icon: Receipt, label: language === 'am' ? 'የክፍያ ዘዴዎች' : 'Payment Methods' },
          { id: 'staff', icon: Users, label: language === 'am' ? 'ሠራተኞችና ኦዲት' : 'Staff & Audits' }
        ].map(tTab => {
          const Icon = tTab.icon;
          const active = activeReportTab === tTab.id;
          return (
            <button
              key={tTab.id}
              onClick={() => setActiveReportTab(tTab.id as any)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: active ? 'var(--primary)' : 'var(--bg-card)',
                color: active ? '#ffffff' : 'var(--text-main)',
                border: active ? 'none' : '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                boxShadow: active ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <Icon size={14} />
              {tTab.label}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW
      ─────────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'overview' && (
        <div>
          {/* Main 4 KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginBottom: 6 }}>
                <DollarSign size={16} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {language === 'am' ? 'ጠቅላላ ገቢ' : 'Total Revenue'}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
                <AnimatedCounter value={kpis.totalSales} suffix={` ${t('currency')}`} />
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <AnimatedCounter value={kpis.completedOrders} /> {language === 'am' ? 'የተጠናቀቁ ትዕዛዞች' : 'completed orders'}
              </span>
            </div>

            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', marginBottom: 6 }}>
                <TrendingUp size={16} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {language === 'am' ? 'ጠቅላላ ወጪ' : 'Total Expenses'}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
                <AnimatedCounter value={kpis.totalExpenses} suffix={` ${t('currency')}`} />
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'ግዢዎችና ኦፕሬሽን' : 'Operations & purchases'}
              </span>
            </div>

            <div className="glass-card" style={{ padding: 14, border: '1.5px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', marginBottom: 6 }}>
                <Award size={16} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {language === 'am' ? 'የተጣራ ትርፍ (Net)' : 'Net Profit'}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#047857', display: 'block' }}>
                <AnimatedCounter value={kpis.netProfit} suffix={` ${t('currency')}`} />
              </span>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                {kpis.grossProfitMargin}% {language === 'am' ? 'የትርፍ ህዳግ' : 'Net Margin'}
              </span>
            </div>

            <div className="glass-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', marginBottom: 6 }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  {language === 'am' ? 'ያለቀ ዕቃ' : 'Low Stock'}
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#b45309', display: 'block' }}>
                <AnimatedCounter value={kpis.lowStockCount} suffix=" Items" />
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'ከዝቅተኛው ወለል በታች' : 'Below safety threshold'}
              </span>
            </div>
          </div>

          {/* Secondary Financial Micro-KPIs Bar */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                {language === 'am' ? 'አማካይ የሂሳብ መጠን' : 'AVG TICKET'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                {kpis.avgOrderValue} {t('currency')}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                {language === 'am' ? 'የተሰጠ ቅናሽ' : 'DISCOUNTS'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#ea580c' }}>
                {kpis.totalDiscounts} {t('currency')}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>
                {language === 'am' ? 'የተሰረዘ ትዕዛዝ' : 'CANCELLED'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger)' }}>
                {kpis.cancelledOrders} ({kpis.cancelledLoss} {t('currency')})
              </span>
            </div>
          </div>

          {/* Daily / Hourly Sales Trend Bar Chart */}
          {(() => {
            const todayLocalStr = new Date().toLocaleDateString('en-CA');
            return (
              <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BarChart3 size={16} color="var(--primary)" />
                      {trendViewMode === 'daily'
                        ? (range === 'today'
                            ? (language === 'am' ? 'የ 7 ቀናት የሽያጭ ሂደት (ዛሬን ጨምሮ)' : '7-Day Sales Trend (Including Today)')
                            : (language === 'am' ? 'የቀን የሽያጭ ሂደት' : 'Daily Sales Trend'))
                        : (language === 'am' ? 'የዛሬ የሰዓታት የሽያጭ ሂደት' : "Today's Hourly Sales Trend")
                      }
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {trendViewMode === 'daily'
                        ? (language === 'am' ? 'የቀን ጠቅላላ ገቢ በብር' : 'Daily Revenue in ETB')
                        : (language === 'am' ? 'በእያንዳንዱ ሰዓት የተሰበሰበ ገቢ' : 'Revenue collected per hour')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setTrendViewMode('daily')}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: trendViewMode === 'daily' ? 'var(--primary)' : 'transparent',
                        color: trendViewMode === 'daily' ? '#ffffff' : 'var(--text-muted)',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      {range === 'today' ? (language === 'am' ? '7 ቀናት' : '7 Days') : (language === 'am' ? 'ቀናት' : 'Daily')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendViewMode('hourly')}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: trendViewMode === 'hourly' ? 'var(--primary)' : 'transparent',
                        color: trendViewMode === 'hourly' ? '#ffffff' : 'var(--text-muted)',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      {language === 'am' ? 'በሰዓት' : 'Hourly'}
                    </button>
                  </div>
                </div>

                {trendViewMode === 'daily' ? (
                  dailyTrend.length === 0 ? (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      {language === 'am' ? 'በዚህ ወቅት ምንም ሽያጭ አልተመዘገበም' : 'No sales recorded for this period'}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }} 
                            tickFormatter={d => d === todayLocalStr ? (language === 'am' ? `${d.substring(5)} (ዛሬ)` : `${d.substring(5)} (Today)`) : d.substring(5)} 
                          />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                            formatter={(value: any) => [`${value} ${t('currency')}`, language === 'am' ? 'የቀን ገቢ' : 'Daily Revenue']}
                            labelFormatter={l => `${language === 'am' ? 'ቀን' : 'Date'}: ${l}${l === todayLocalStr ? (language === 'am' ? ' (ዛሬ)' : ' (Today)') : ''}`}
                          />
                          <Bar dataKey="sales" radius={[4, 4, 0, 0]} maxBarSize={44}>
                            {dailyTrend.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.date === todayLocalStr ? '#f97316' : '#38bdf8'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                ) : (
                  hourlyTrend.length === 0 ? (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      {language === 'am' ? 'ምንም የሰዓት መረጃ የለም' : 'No hourly sales recorded yet'}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                          <Tooltip
                            contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                            formatter={(val: any, name: any) => [name === 'sales' ? `${val} ${t('currency')}` : `${val} orders`, name === 'sales' ? (language === 'am' ? 'ገቢ' : 'Revenue') : (language === 'am' ? 'ትዕዛዞች' : 'Orders')]}
                          />
                          <Bar dataKey="sales" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                )}
              </div>
            );
          })()}

          {/* Top Selling Items Breakdown / Bar Graph */}
          <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart3 size={16} color="var(--primary)" />
                  {language === 'am' ? 'በብዛት የተሸጡ ምግቦች' : 'Sold Menu Items Breakdown'}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {language === 'am' ? 'የእያንዳንዱ ምግብ ሽያጭ መጠን በግራፍ' : 'Items sold breakdown by quantity & revenue'}
                </span>
              </div>
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setItemsChartMode('bar')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: itemsChartMode === 'bar' ? 'var(--primary)' : 'transparent',
                    color: itemsChartMode === 'bar' ? '#fff' : 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={13} />
                  {language === 'am' ? 'ባር ግራፍ' : 'Bar Graph'}
                </button>
                <button
                  type="button"
                  onClick={() => setItemsChartMode('donut')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: itemsChartMode === 'donut' ? 'var(--primary)' : 'transparent',
                    color: itemsChartMode === 'donut' ? '#fff' : 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <PieIcon size={13} />
                  {language === 'am' ? 'ዶናት' : 'Donut'}
                </button>
              </div>
            </div>

            {topSellers.length === 0 ? (
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {language === 'am' ? 'ምንም የምግብ መረጃ የለም' : 'No menu item data recorded'}
              </div>
            ) : itemsChartMode === 'bar' ? (
              <div>
                <div style={{ width: '100%', height: Math.max(160, topSellers.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={topSellers.map((item: any) => ({
                        ...item,
                        displayName: (language === 'am' && item.name_amharic) ? item.name_amharic : item.name
                      }))}
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="displayName"
                        tick={{ fontSize: 11, fill: 'var(--text-main)', fontWeight: 600 }}
                        width={130}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                        formatter={(val: any, _name: any, props: any) => [
                          `${val} ${language === 'am' ? 'ተሸጧል' : 'sold'} (${props.payload.revenue || 0} ${t('currency')})`,
                          language === 'am' ? 'የተሸጠው መጠን' : 'Quantity Sold'
                        ]}
                      />
                      <Bar dataKey="quantity_sold" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {topSellers.map((_entry: any, index: number) => (
                          <Cell key={`bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Items detail list below the bar chart */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                  {topSellers.map((item: any, i: number) => {
                    const itemName = (language === 'am' && item.name_amharic) ? item.name_amharic : item.name;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 11 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{itemName}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <strong style={{ color: 'var(--primary)', display: 'block' }}>{item.quantity_sold} {language === 'am' ? 'ተሸጧል' : 'sold'}</strong>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.revenue || 0} {t('currency')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topSellers.map((item: any) => ({
                          ...item,
                          displayName: (language === 'am' && item.name_amharic) ? item.name_amharic : item.name
                        }))}
                        dataKey="quantity_sold"
                        nameKey="displayName"
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={52}
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
                  {topSellers.map((item: any, i: number) => {
                    const itemName = (language === 'am' && item.name_amharic) ? item.name_amharic : item.name;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{itemName}</span>
                        </div>
                        <strong style={{ color: 'var(--primary)', flexShrink: 0 }}>{item.quantity_sold} sold</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Branch Comparison if available */}
          {dashboard.branchComparison?.length > 1 && (
            <div className="glass-card" style={{ padding: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={16} color="var(--primary)" />
                {language === 'am' ? 'የቅርንጫፎች ንፅፅር' : 'Multi-Branch Comparison'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dashboard.branchComparison.map((b: any) => (
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
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 2: HOURLY RUSH HEATMAP
      ─────────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'hourly' && (
        <div>
          {/* Peak Hour Highlight Card */}
          {peakHour && peakHour.sales > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #ea580c, #f97316)', borderRadius: 14, padding: 16, color: '#ffffff', marginBottom: 16, boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Flame size={20} />
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'am' ? 'ከፍተኛ የትዕዛዝ ሰዓት (Peak Rush Hour)' : 'Peak Rush Hour Detected'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {peakHour.hour} ({peakHour.sales} {t('currency')})
              </div>
              <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0' }}>
                {language === 'am' 
                  ? `በዚህ ሰዓት ${peakHour.orders} ትዕዛዞች ተስተናግደዋል። የወጥ ቤትና አስተናጋጅ ሠራተኞችን በዚህ ሰዓት ማጠናከር ይመከራል።` 
                  : `Processed ${peakHour.orders} orders during this peak window. Recommend optimizing station prep & waiter shifts for this block.`}
              </p>
            </div>
          )}

          {/* Hourly Traffic Chart */}
          <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={16} color="var(--primary)" />
              {language === 'am' ? 'የሰዓት ሽያጭ እና ትዕዛዝ ብዛት' : 'Sales & Orders by Hour of Day'}
            </h3>
            {hourlyTrend.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                {language === 'am' ? 'ምንም የሰዓት መረጃ የለም' : 'No hourly data available for this range'}
              </div>
            ) : (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: 8, fontSize: 11 }}
                      formatter={(val: any, name: any) => [name === 'sales' ? `${val} ${t('currency')}` : `${val} orders`, name === 'sales' ? 'Revenue' : 'Orders']}
                    />
                    <Bar dataKey="sales" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Hourly Breakdown Table */}
          <div className="glass-card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
              {language === 'am' ? 'የሰዓታት ዝርዝር ሰንጠረዥ' : 'Hourly Breakdown Matrix'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hourlyTrend.map((h: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>⏰ {h.hour}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{h.orders} {language === 'am' ? 'ትዕዛዝ' : 'orders'}</span>
                  <strong style={{ color: 'var(--primary)' }}>{h.sales} {t('currency')}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 3: BOM COST & PROFIT MARGINS
      ─────────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'margins' && (
        <div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: '#166534' }}>
            💡 <strong>{language === 'am' ? 'የምግብ ዋጋ ትንታኔ (Menu Engineering):' : 'Menu Cost Engineering:'}</strong>{' '}
            {language === 'am' 
              ? 'የእያንዳንዱ ምግብ ጥሬ ዕቃ ዋጋ (BOM Cost) ከሽያጭ ዋጋው ጋር ተነፃፅሮ ትርፋማነቱ በራስ-ሰር ይሰላል።' 
              : 'COGS ingredient costs are computed from recipes and mapped against selling price to evaluate margin health.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {menuProfitMargins.map((item: any) => {
              const isHighMargin = item.margin_percent >= 65;
              const isLowMargin = item.margin_percent < 40 && item.cogs_cost > 0;
              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {item.name}
                      </h4>
                      {item.name_amharic && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.name_amharic}</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: isHighMargin ? '#ecfdf5' : isLowMargin ? '#fef2f2' : '#eff6ff',
                        color: isHighMargin ? '#047857' : isLowMargin ? '#b91c1c' : '#1d4ed8'
                      }}
                    >
                      {item.margin_percent}% {language === 'am' ? 'ህዳግ' : 'Margin'}
                    </span>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: 'var(--bg-subtle)', borderRadius: 10, padding: 8, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>{language === 'am' ? 'የሽያጭ ዋጋ' : 'Price'}</span>
                      <strong>{item.price} {t('currency')}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>{language === 'am' ? 'የጥሬ ዕቃ ወጪ' : 'BOM Cost'}</span>
                      <strong style={{ color: '#ea580c' }}>{item.cogs_cost} {t('currency')}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>{language === 'am' ? 'ትርፍ በአንድ' : 'Unit Profit'}</span>
                      <strong style={{ color: '#10b981' }}>{item.profit_per_unit} {t('currency')}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>{language === 'am' ? 'የተሸጠ' : 'Sold'}</span>
                      <strong>{item.units_sold} qty</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {language === 'am' ? 'ጠቅላላ ሽያጭ' : 'Total Revenue'}: <strong>{item.total_revenue} {t('currency')}</strong>
                    </span>
                    <span style={{ fontWeight: 800, color: '#047857' }}>
                      {language === 'am' ? 'ጠቅላላ ትርፍ' : 'Gross Profit'}: {item.total_gross_profit} {t('currency')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 4: PAYMENT CHANNELS
      ─────────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'payments' && (
        <div>
          <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Receipt size={16} color="var(--primary)" />
              {language === 'am' ? 'የክፍያ ዘዴዎች ክፍፍል (Payment Method Split)' : 'Payment Channel Breakdown'}
            </h3>

            {/* Total collected banner */}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'በሁሉም ዘዴዎች የተሰበሰበ ጠቅላላ' : 'Total Collected via Channels'}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>
                {totalPaymentsCollected} {t('currency')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paymentMethods.map((pm: any, idx: number) => {
                const percent = totalPaymentsCollected > 0 
                  ? Math.round((pm.total_amount / totalPaymentsCollected) * 100) 
                  : 0;

                const getIconAndColor = (m: string) => {
                  switch (m) {
                    case 'TELEBIRR': return { icon: '📱', color: '#eab308', name: 'ቴሌብር (Telebirr)' };
                    case 'CBE_BIRR': return { icon: '🏦', color: '#8b5cf6', name: 'ሲቢኢ ብር (CBE Birr)' };
                    case 'CASH': return { icon: '💵', color: '#10b981', name: 'ጥሬ ገንዘብ (Cash)' };
                    case 'CARD': return { icon: '💳', color: '#0284c7', name: 'ካርድ (POS Card)' };
                    default: return { icon: '💰', color: '#6b7280', name: m };
                  }
                };

                const meta = getIconAndColor(pm.method);

                return (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{meta.icon}</span>
                        <div>
                          <strong style={{ fontSize: 14 }}>{meta.name}</strong>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                            {pm.tx_count} {language === 'am' ? 'ክፍያዎች' : 'transactions'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', display: 'block' }}>
                          {pm.total_amount} {t('currency')}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>
                          {percent}% of total
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: meta.color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 5: STAFF PRODUCTIVITY & AUDITS
      ─────────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'staff' && (
        <div>
          {/* Loss & Void Audit Card */}
          <div className="glass-card" style={{ padding: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={16} color="var(--danger)" />
              {language === 'am' ? 'የኪሳራ እና ስረዛ ኦዲት (Loss & Void Audit)' : 'Loss & Void Order Audit'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 10 }}>
                <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, display: 'block' }}>
                  {language === 'am' ? 'የተሰረዘ ትዕዛዝ ኪሳራ' : 'Cancelled Orders Loss'}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', display: 'block', marginTop: 2 }}>
                  {auditLosses.cancelled_loss || 0} {t('currency')}
                </span>
                <span style={{ fontSize: 11, color: '#b91c1c' }}>
                  {auditLosses.cancelled_count || 0} {language === 'am' ? 'ትዕዛዞች ተሰርዘዋል' : 'orders voided'}
                </span>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 10, padding: 10 }}>
                <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700, display: 'block' }}>
                  {language === 'am' ? 'የተሰጠ ጠቅላላ ቅናሽ' : 'Discounts Granted'}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#d97706', display: 'block', marginTop: 2 }}>
                  {auditLosses.total_discounts || 0} {t('currency')}
                </span>
                <span style={{ fontSize: 11, color: '#b45309' }}>
                  {auditLosses.discounted_count || 0} {language === 'am' ? 'ትዕዛዞች ቅናሽ ተደርጎላቸዋል' : 'discounted bills'}
                </span>
              </div>
            </div>
          </div>

          {/* Waiter Leaderboard */}
          <div className="glass-card" style={{ padding: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={16} color="var(--primary)" />
              {language === 'am' ? 'የአስተናጋጆች አፈፃፀም ሰንጠረዥ' : 'Waiter Performance Leaderboard'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {waiterStats.map((w: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 10, fontSize: 13 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 10, background: idx === 0 ? '#fef08a' : '#e2e8f0', color: idx === 0 ? '#854d0e' : '#475569', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {idx + 1}
                      </span>
                      <strong>{w.waiter_name}</strong>
                    </div>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginLeft: 26 }}>
                      {w.orders_count} {language === 'am' ? 'ትዕዛዞች' : 'orders'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14, display: 'block' }}>
                      {w.sales_total} {t('currency')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
