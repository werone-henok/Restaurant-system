import React, { useState, useEffect, useCallback } from 'react';
import { 
  Star, 
  Sparkles, 
  QrCode, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  User, 
  Phone, 
  Mail, 
  Utensils, 
  Volume2, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw,
  Search,
  Check,
  Edit3,
  Bot
} from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { gToast } from '../../utils/toast';
import { tactileFeedback } from '../../utils/feedback';
import { PrintableTableTentModal } from '../../components/PrintableTableTentModal';

interface CustomerFeedback {
  id: string;
  branch_id: string;
  branch_name?: string;
  table_number?: string;
  order_id?: string;
  waiter_id?: string;
  waiter_name?: string;
  overall_rating: number;
  food_rating?: number;
  service_rating?: number;
  cleanliness_rating?: number;
  ambiance_rating?: number;
  comment?: string;
  dishes_feedback?: Array<{ name: string; liked: boolean }>;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  status: 'NEW' | 'REVIEWED' | 'RESOLVED' | 'ARCHIVED';
  manager_notes?: string;
  language?: string;
  created_at: string;
}

interface FeedbackStats {
  totalReviews: number;
  avgRating: number;
  avgFood: number;
  avgService: number;
  avgCleanliness: number;
  avgAmbiance: number;
  ratingDistribution: Record<number, number>;
  sentimentDistribution: {
    POSITIVE: number;
    NEUTRAL: number;
    NEGATIVE: number;
  };
  unresolvedUrgentCount: number;
}

export const CustomerFeedbackDashboard: React.FC = () => {
  const { currentBranchId, branches, settings, language } = useApp();

  const [reviews, setReviews] = useState<CustomerFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    totalReviews: 0,
    avgRating: 0,
    avgFood: 0,
    avgService: 0,
    avgCleanliness: 0,
    avgAmbiance: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    sentimentDistribution: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    unresolvedUrgentCount: 0
  });

  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranchId || 'ALL');
  const [selectedRating, setSelectedRating] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Note editing state: map of feedbackId -> note text
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Tables for QR table tent generator
  const [branchTables, setBranchTables] = useState<any[]>([]);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'ALL') params.set('branchId', selectedBranch);
      if (selectedStatus && selectedStatus !== 'ALL') params.set('status', selectedStatus);
      if (selectedRating !== 'ALL') params.set('rating', String(selectedRating));

      const res = await api.request<any>(`/feedback?${params.toString()}`);
      setReviews(res.reviews || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      gToast.error(err.message || 'Failed to load customer feedback');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, selectedStatus, selectedRating]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Load tables for table tent modal
  useEffect(() => {
    async function loadTables() {
      try {
        const branchParam = selectedBranch && selectedBranch !== 'ALL' ? `?branchId=${selectedBranch}` : '';
        const res = await api.request<any[]>(`/tables${branchParam}`);
        setBranchTables(res || []);
      } catch (_) {}
    }
    loadTables();
  }, [selectedBranch]);

  // Update status handler
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      gToast.success(language === 'am' ? 'የአስተያየት ሁኔታ ተቀይሯል' : 'Feedback status updated');
      fetchFeedback();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to update status');
    }
  };

  // Save manager note
  const handleSaveNote = async (id: string) => {
    tactileFeedback('click');
    try {
      await api.request(`/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ manager_notes: noteText })
      });
      gToast.success(language === 'am' ? 'ማስታወሻ ተቀምጧል' : 'Manager note saved');
      setEditingNoteId(null);
      fetchFeedback();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to save note');
    }
  };

  // Fetch AI Insights
  const handleOpenAiInsights = async () => {
    tactileFeedback('click');
    setShowAiModal(true);
    setLoadingAi(true);
    try {
      const branchParam = selectedBranch && selectedBranch !== 'ALL' ? `?branchId=${selectedBranch}` : '';
      const res = await api.request<any>(`/feedback/ai-insights${branchParam}`);
      setAiInsights(res);
    } catch (err: any) {
      gToast.error('Failed to generate AI insights');
    } finally {
      setLoadingAi(false);
    }
  };

  // Filtered reviews by search query
  const filteredReviews = reviews.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.comment && r.comment.toLowerCase().includes(q)) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
      (r.customer_phone && r.customer_phone.includes(q)) ||
      (r.table_number && r.table_number.includes(q)) ||
      (r.waiter_name && r.waiter_name.toLowerCase().includes(q))
    );
  });

  const activeBranchName = branches.find(b => b.id === selectedBranch)?.name || 'Consolidated (All Branches)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top Header Controls ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--bg-subtle, #1e293b)',
        padding: '14px 18px',
        borderRadius: 18,
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
          }}>
            <MessageSquare size={20} color="#000000" strokeWidth={2.5} />
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: 'var(--text-main, #ffffff)' }}>
              {language === 'am' ? 'የደንበኞች አስተያየት እና ምዘና' : 'Customer Feedback & Reviews'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
              {language === 'am' ? 'በቀጥታ ከሞባይል QR ስካን የተሰበሰቡ አስተያየቶች' : 'Live reviews collected via mobile QR scan'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Branch selector */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '8px 12px',
              color: 'var(--text-main)',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="ALL">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* AI Insights Button */}
          <button
            onClick={handleOpenAiInsights}
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Bot size={15} color="#fef08a" />
            <span>{language === 'am' ? '✨ የደንበኛ AI ትንተና' : '✨ AI Sentiment Insights'}</span>
          </button>

          {/* QR Table Tent Generator Button */}
          <button
            onClick={() => { tactileFeedback('click'); setShowQrModal(true); }}
            style={{
              padding: '8px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
              color: '#000000',
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}
          >
            <QrCode size={16} />
            <span>{language === 'am' ? 'የQR ካርድ አትም' : 'Print QR Stands'}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchFeedback}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14
      }}>
        {/* Card 1: Overall Average Rating */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Overall Score
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(245, 158, 11, 0.15)',
              padding: '2px 8px',
              borderRadius: 8
            }}>
              <Star size={13} fill="#f59e0b" color="#f59e0b" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706' }}>
                {stats.totalReviews} Reviews
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 6px' }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
              {stats.avgRating.toFixed(1)}
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>
              / 5.0
            </span>
          </div>

          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                size={16}
                fill={stats.avgRating >= star ? '#f59e0b' : stats.avgRating >= star - 0.5 ? '#f59e0b' : 'none'}
                color={stats.avgRating >= star - 0.5 ? '#f59e0b' : 'var(--border)'}
              />
            ))}
          </div>
        </div>

        {/* Card 2: Aspect Scores */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 6,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Aspect Breakdown
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>🍲 Food Quality</span>
              <span style={{ fontWeight: 800, color: '#f97316' }}>{stats.avgFood ? `${stats.avgFood}★` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>⚡ Service Speed</span>
              <span style={{ fontWeight: 800, color: '#0284c7' }}>{stats.avgService ? `${stats.avgService}★` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>✨ Cleanliness</span>
              <span style={{ fontWeight: 800, color: '#059669' }}>{stats.avgCleanliness ? `${stats.avgCleanliness}★` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>🎶 Atmosphere</span>
              <span style={{ fontWeight: 800, color: '#7c3aed' }}>{stats.avgAmbiance ? `${stats.avgAmbiance}★` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Sentiment & Urgency */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Sentiment & Alerts
            </span>
            {stats.unresolvedUrgentCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: 10,
                animation: 'pulse 2s infinite'
              }}>
                🚨 {stats.unresolvedUrgentCount} Urgent
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
            <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#059669' }}>
                {stats.sentimentDistribution.POSITIVE}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Positive</div>
            </div>

            <div style={{ flex: 1, background: 'rgba(234, 179, 8, 0.12)', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#d97706' }}>
                {stats.sentimentDistribution.NEUTRAL}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Neutral</div>
            </div>

            <div style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#dc2626' }}>
                {stats.sentimentDistribution.NEGATIVE}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Negative</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {stats.totalReviews > 0 
              ? `${Math.round((stats.sentimentDistribution.POSITIVE / stats.totalReviews) * 100)}% positive rating ratio`
              : 'Awaiting reviews'}
          </div>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Rating Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['ALL', 5, 4, 3, 2, 1] as const).map((r) => (
            <button
              key={r}
              onClick={() => { tactileFeedback('click'); setSelectedRating(r); }}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: selectedRating === r ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                background: selectedRating === r ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                color: selectedRating === r ? '#d97706' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {r === 'ALL' ? 'All Ratings' : `${r} ★ (${stats.ratingDistribution[r] || 0})`}
            </button>
          ))}
        </div>

        {/* Status Pills & Search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 12px',
              color: 'var(--text-main)',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New Reviews</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comments, phone..."
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '6px 10px 6px 30px',
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none',
                width: 170
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Reviews Feed ── */}
      {filteredReviews.length === 0 ? (
        <div style={{
          background: 'var(--bg-card, #1e293b)',
          borderRadius: 20,
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--text-muted, #94a3b8)',
          border: '1px dashed rgba(255, 255, 255, 0.1)'
        }}>
          <MessageSquare size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>
            No feedback found for the selected filters
          </p>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Print table tents or QR receipts to invite customers to review their dining experience.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredReviews.map((item) => {
            const isNegative = item.overall_rating <= 2;
            const isPositive = item.overall_rating >= 4;
            const isUrgentUnresolved = isNegative && item.status !== 'RESOLVED';

            return (
              <div
                key={item.id}
                style={{
                  background: isUrgentUnresolved ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)',
                  border: isUrgentUnresolved 
                    ? '1.5px solid rgba(239, 68, 68, 0.4)' 
                    : '1px solid var(--border)',
                  borderRadius: 18,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: isUrgentUnresolved ? '0 4px 20px rgba(239, 68, 68, 0.15)' : 'var(--shadow-sm)'
                }}
              >
                {/* Review Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Star Badge */}
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: 10,
                      background: isPositive 
                        ? 'rgba(16, 185, 129, 0.2)' 
                        : isNegative 
                        ? 'rgba(239, 68, 68, 0.2)' 
                        : 'rgba(234, 179, 8, 0.2)',
                      border: isPositive 
                        ? '1px solid #10b981' 
                        : isNegative 
                        ? '1px solid #ef4444' 
                        : '1px solid #eab308',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Star size={14} fill={isPositive ? '#10b981' : isNegative ? '#ef4444' : '#eab308'} color={isPositive ? '#10b981' : isNegative ? '#ef4444' : '#eab308'} />
                      <span style={{ fontSize: 13, fontWeight: 900, color: isPositive ? '#10b981' : isNegative ? '#ef4444' : '#eab308' }}>
                        {item.overall_rating}.0
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
                        {item.customer_name || 'Anonymous Guest'}
                        {item.table_number && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginLeft: 8 }}>
                            • Table #{item.table_number}
                          </span>
                        )}
                        {item.waiter_name && (
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                            (Server: {item.waiter_name})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.branch_name || 'Main Branch'} • {new Date(item.created_at).toLocaleString()}
                        {item.language && (
                          <span style={{ marginLeft: 6, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            [{item.language}]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      background: item.status === 'RESOLVED' 
                        ? 'rgba(16, 185, 129, 0.15)' 
                        : item.status === 'REVIEWED' 
                        ? 'rgba(59, 130, 246, 0.15)' 
                        : 'rgba(245, 158, 11, 0.15)',
                      color: item.status === 'RESOLVED' 
                        ? '#10b981' 
                        : item.status === 'REVIEWED' 
                        ? '#60a5fa' 
                        : '#f59e0b'
                    }}>
                      {item.status}
                    </span>

                    {item.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'RESOLVED')}
                        title="Mark Resolved"
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Check size={12} />
                        Resolve
                      </button>
                    )}

                    {item.status === 'NEW' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'REVIEWED')}
                        title="Mark Reviewed"
                        style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid #3b82f6',
                          color: '#60a5fa',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Aspect Ratings mini-chips */}
                {(item.food_rating || item.service_rating || item.cleanliness_rating || item.ambiance_rating) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.food_rating && (
                      <span style={{ fontSize: 11, color: '#f97316', background: 'rgba(249, 115, 22, 0.1)', padding: '2px 8px', borderRadius: 8 }}>
                        🍲 Food: {item.food_rating}★
                      </span>
                    )}
                    {item.service_rating && (
                      <span style={{ fontSize: 11, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.1)', padding: '2px 8px', borderRadius: 8 }}>
                        ⚡ Service: {item.service_rating}★
                      </span>
                    )}
                    {item.cleanliness_rating && (
                      <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 8 }}>
                        ✨ Cleanliness: {item.cleanliness_rating}★
                      </span>
                    )}
                    {item.ambiance_rating && (
                      <span style={{ fontSize: 11, color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)', padding: '2px 8px', borderRadius: 8 }}>
                        🎶 Atmosphere: {item.ambiance_rating}★
                      </span>
                    )}
                  </div>
                )}

                {/* Dishes tasted */}
                {item.dishes_feedback && item.dishes_feedback.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.dishes_feedback.map((df, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: df.liked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: df.liked ? '#10b981' : '#ef4444',
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {df.liked ? <ThumbsUp size={11} /> : <ThumbsDown size={11} />}
                        {df.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comment Text */}
                {item.comment && (
                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-main)',
                    background: 'var(--bg-subtle)',
                    padding: '10px 12px',
                    borderRadius: 10,
                    borderLeft: isNegative ? '3px solid #ef4444' : isPositive ? '3px solid #10b981' : '3px solid #eab308'
                  }}>
                    {item.comment}
                  </div>
                )}

                {/* Customer Contact details if provided */}
                {(item.customer_phone || item.customer_email) && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.customer_phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} color="#f59e0b" />
                        {item.customer_phone}
                      </span>
                    )}
                    {item.customer_email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} color="#0284c7" />
                        {item.customer_email}
                      </span>
                    )}
                  </div>
                )}

                {/* Manager Notes / Action Resolution Section */}
                <div style={{
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12
                }}>
                  {editingNoteId === item.id ? (
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add manager action note (e.g. Talked to waiter, apologized to guest)..."
                        style={{
                          flex: 1,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          color: 'var(--text-main)',
                          fontSize: 12,
                          outline: 'none'
                        }}
                      />
                      <button
                        onClick={() => handleSaveNote(item.id)}
                        style={{
                          background: '#f59e0b',
                          color: '#000000',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        style={{
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-muted)',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {item.manager_notes ? `Note: ${item.manager_notes}` : 'No manager notes yet.'}
                      </span>
                      <button
                        onClick={() => {
                          setEditingNoteId(item.id);
                          setNoteText(item.manager_notes || '');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f59e0b',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Edit3 size={11} />
                        {item.manager_notes ? 'Edit' : 'Add Note'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Insights Modal ── */}
      {showAiModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 540,
            maxHeight: '85vh',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            color: 'var(--text-main)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.35)',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={22} color="#8b5cf6" />
                <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                  AI Sentiment & Executive Feedback Report
                </h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 18,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {loadingAi ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p>Analyzing customer sentiment and synthesizing operational advice...</p>
              </div>
            ) : aiInsights ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-main)'
                }}>
                  {(language as string) === 'am' 
                    ? aiInsights.summaryAmharic 
                    : (language as string) === 'om' 
                    ? aiInsights.summaryOromo 
                    : aiInsights.summary}
                </div>

                {/* Praises */}
                {aiInsights.praises?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#059669', margin: '0 0 6px' }}>
                      🌟 Top Customer Praises
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-main)', lineHeight: 1.6 }}>
                      {aiInsights.praises.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Complaints */}
                {aiInsights.complaints?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', margin: '0 0 6px' }}>
                      ⚠️ Recurring Issues Requiring Attention
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-main)', lineHeight: 1.6 }}>
                      {aiInsights.complaints.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {aiInsights.actionItems?.length > 0 && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 14,
                    padding: '12px 16px'
                  }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#d97706', margin: '0 0 6px' }}>
                      📋 Recommended Action Checklist
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-main)', lineHeight: 1.5 }}>
                      {aiInsights.actionItems.map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Printable Table Tent Modal ── */}
      {showQrModal && (
        <PrintableTableTentModal
          branchId={selectedBranch && selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || 'branch_default'}
          branchName={activeBranchName}
          restaurantName={settings?.restaurant_name || 'Yo Burger & Restaurant'}
          logoUrl={settings?.logo_url || '/logo.png'}
          availableTables={branchTables}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
