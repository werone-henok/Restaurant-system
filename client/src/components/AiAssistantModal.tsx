import React, { useState, useEffect, useRef } from 'react';
import { ModalPortal } from './ModalPortal';
import { api } from '../api/client';
import {
  Sparkles,
  X,
  Send,
  TrendingUp,
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  Flame,
  Cake,
  Users,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { tactileFeedback } from '../utils/feedback';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
  language?: 'en' | 'am';
  userRole?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const AMHARIC_PROMPTS = [
  '📊 የዛሬው ጠቅላላ ገቢ ስንት ነው?',
  '⚠️ የሚያልቁ ጥሬ ዕቃዎች የትኞቹ ናቸው?',
  '🍔 ከፍተኛ ሽያጭ ያስመዘገቡ ምግቦች የትኞቹ ናቸው?',
  '🎂 የዳቦ እና ኬክ ካውንተር ሁኔታ ምን ይመስላል?',
  '👥 ዛሬ ከፍተኛ ሽያጭ ያስመዘገበው አስተናጋጅ ማን ነው?'
];

const ENGLISH_PROMPTS = [
  '📊 How much revenue did we generate today?',
  '⚠️ Which ingredients are running out of stock?',
  '🍔 What are our top-selling dishes?',
  '🎂 What is our bakery counter status?',
  '👥 Who is the top performing waiter today?'
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  branchId,
  language = 'en',
  userRole = 'admin'
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'chat'>('insights');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [insights, setInsights] = useState<any[]>([]);

  // Language state (defaults to prop, allows 1-tap live switching)
  const [currentLang, setCurrentLang] = useState<'en' | 'am'>(language || 'en');
  const isAmharic = currentLang === 'am';

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingQuery, setSendingQuery] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(
    language === 'am' ? AMHARIC_PROMPTS : ENGLISH_PROMPTS
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync with prop when opened
  useEffect(() => {
    if (isOpen && language) {
      setCurrentLang(language);
      setSuggestedPrompts(language === 'am' ? AMHARIC_PROMPTS : ENGLISH_PROMPTS);
    }
  }, [isOpen, language]);

  // Load live insights on open
  useEffect(() => {
    if (isOpen) {
      loadInsights();
      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            sender: 'ai',
            text: isAmharic
              ? `ጤና ይስጥልኝ! እኔ የእርስዎ የሬስቶራንት AI ቢዝነስ አማካሪ ነኝ። የዛሬውን ሽያጭ፣ የኩሽናውን እና የዳቦ ቤቱን እንቅስቃሴ፣ እንዲሁም የሚያልቁ ጥሬ ዕቃዎችን ጠይቀው ፈጣን ትንተና ማግኘት ይችላሉ።`
              : `Hello! I am your AI Business Copilot. I analyze your live sales, kitchen backlogs, cake counter turnover, and critical inventory risks in real-time. How can I assist your operations today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    }
  }, [isOpen]);

  const handleToggleLang = (lang: 'en' | 'am') => {
    tactileFeedback('click');
    setCurrentLang(lang);
    setSuggestedPrompts(lang === 'am' ? AMHARIC_PROMPTS : ENGLISH_PROMPTS);
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: lang === 'am'
          ? '🇪🇹 ቋንቋው ወደ አማርኛ ተቀይሯል። የፈለጉትን ጥያቄ በአማርኛ መጠየቅ ይችላሉ።'
          : '🇬🇧 Switched to English. Feel free to ask any question about live operations.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const loadInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.request<any>(`/ai/insights${branchId ? `?branchId=${branchId}` : ''}`);
      if (res && res.metrics) {
        setMetrics(res.metrics);
        setInsights(res.insights || []);
      }
    } catch (err) {
      console.error('Failed to load AI insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || sendingQuery) return;

    tactileFeedback('click');
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setSendingQuery(true);

    try {
      const res = await api.request<any>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          message: query, 
          branchId,
          language: currentLang 
        })
      });

      if (res && res.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: res.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        if (res.suggestedPrompts && Array.isArray(res.suggestedPrompts)) {
          setSuggestedPrompts(res.suggestedPrompts);
        }
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: isAmharic
            ? 'ይቅርታ፣ ጥያቄዎን በመተንተን ላይ ስህተት አጋጥሟል። እባክዎ እንደገና ይሞክሩ።'
            : 'Apologies, I encountered an issue analyzing that request. Please try again shortly.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSendingQuery(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: 12,
          boxSizing: 'border-box'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 22,
            width: '100%',
            maxWidth: 620,
            height: 'min(92vh, 760px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
            border: '1.5px solid var(--border, #e2e8f0)',
            boxSizing: 'border-box'
          }}
          className="animate-fade-in"
        >
          {/* Futuristic Gradient Header */}
          <div
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              >
                <Sparkles size={24} color="#fef08a" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                    {isAmharic ? 'የስራ አስኪያጅ AI አማካሪ' : 'Executive AI Copilot'}
                  </h3>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase'
                    }}
                  >
                    {userRole} Intelligence
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontWeight: 600 }}>
                  {isAmharic 
                    ? 'የቀጥታ ሽያጭ፣ የኩሽና እና የጥሬ ዕቃዎች ትንተና' 
                    : 'Real-time sales, inventory risks & operational recommendations'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Language Switcher Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 20,
                  padding: 3,
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleLang('am')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: isAmharic ? '#ffffff' : 'transparent',
                    color: isAmharic ? '#4f46e5' : '#ffffff',
                    transition: 'all 0.2s ease'
                  }}
                  title="ወደ አማርኛ ይቀይሩ"
                >
                  🇪🇹 አማርኛ
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLang('en')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: !isAmharic ? '#ffffff' : 'transparent',
                    color: !isAmharic ? '#4f46e5' : '#ffffff',
                    transition: 'all 0.2s ease'
                  }}
                  title="Switch to English"
                >
                  🇬🇧 EN
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Tab Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-app, #f8fafc)',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              padding: '6px 12px',
              gap: 8,
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={() => {
                tactileFeedback('click');
                setActiveTab('insights');
              }}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 12,
                border: 'none',
                background: activeTab === 'insights' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'insights' ? '#7c3aed' : 'var(--text-muted, #64748b)',
                fontWeight: 900,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: activeTab === 'insights' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Lightbulb size={16} />
              {isAmharic ? 'የስራ አመራር ትንተናዎች (Insights)' : 'Live Insights & Health'}
            </button>

            <button
              type="button"
              onClick={() => {
                tactileFeedback('click');
                setActiveTab('chat');
              }}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 12,
                border: 'none',
                background: activeTab === 'chat' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'chat' ? '#7c3aed' : 'var(--text-muted, #64748b)',
                fontWeight: 900,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: activeTab === 'chat' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Sparkles size={16} />
              {isAmharic ? 'ከ AI ጋር ይወያዩ (Ask Copilot)' : 'Ask AI Copilot'}
            </button>
          </div>

          {/* TAB 1: EXECUTIVE INSIGHTS & REAL-TIME VITALS */}
          {activeTab === 'insights' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Snapshot Metric Cards */}
              {metrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6d28d9', fontSize: 11, fontWeight: 800 }}>
                      <DollarSign size={14} />
                      {isAmharic ? 'የዛሬ ጠቅላላ ሽያጭ' : "Today's Revenue"}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#5b21b6', marginTop: 4 }}>
                      {Number(metrics.todayRevenue).toLocaleString()} <span style={{ fontSize: 12 }}>ETB</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 700 }}>
                      {metrics.completedOrdersToday} {isAmharic ? 'የተጠናቀቁ ትዕዛዞች' : 'completed orders'}
                    </div>
                  </div>

                  <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c2410c', fontSize: 11, fontWeight: 800 }}>
                      <Flame size={14} />
                      {isAmharic ? 'በኩሽና ዝግጅት ላይ' : 'Kitchen Active Load'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ea580c', marginTop: 4 }}>
                      {metrics.pendingOrdersToday} <span style={{ fontSize: 12 }}>{isAmharic ? 'ትዕዛዞች' : 'tickets'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#ea580c', marginTop: 2, fontWeight: 700 }}>
                      {isAmharic ? 'አማካይ ዋጋ' : 'AOV'}: {metrics.avgOrderValue} ETB
                    </div>
                  </div>

                  <div style={{ background: '#fdf2f8', border: '1.5px solid #fbcfe8', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#be185d', fontSize: 11, fontWeight: 800 }}>
                      <Cake size={14} />
                      {isAmharic ? 'የካውንተር ኬክ ክምችት' : 'Bakery Counter Display'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#db2777', marginTop: 4 }}>
                      {metrics.bakeryStats?.counterCakesAvailable ?? 0} <span style={{ fontSize: 12 }}>{isAmharic ? 'ኬኮች' : 'cakes ready'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#be185d', marginTop: 2, fontWeight: 700 }}>
                      {metrics.bakeryStats?.batchesBaking ?? 0} {isAmharic ? 'ምድጃ ውስጥ' : 'batches in oven'}
                    </div>
                  </div>

                  <div style={{ background: metrics.lowStockIngredients?.length > 0 ? '#fef2f2' : '#ecfdf5', border: `1.5px solid ${metrics.lowStockIngredients?.length > 0 ? '#fecaca' : '#a7f3d0'}`, borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: metrics.lowStockIngredients?.length > 0 ? '#b91c1c' : '#047857', fontSize: 11, fontWeight: 800 }}>
                      <AlertTriangle size={14} />
                      {isAmharic ? 'የጥሬ ዕቃ ማስጠንቀቂያ' : 'Low Stock Alerts'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: metrics.lowStockIngredients?.length > 0 ? '#dc2626' : '#059669', marginTop: 4 }}>
                      {metrics.lowStockIngredients?.length ?? 0} <span style={{ fontSize: 12 }}>{isAmharic ? 'ዕቃዎች' : 'items low'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: metrics.lowStockIngredients?.length > 0 ? '#dc2626' : '#059669', marginTop: 2, fontWeight: 700 }}>
                      {metrics.lowStockIngredients?.length > 0 ? (isAmharic ? 'አስቸኳይ ግዢ ያስፈልጋል' : 'Needs reorder') : (isAmharic ? 'ክምችት የተሟላ' : 'Healthy inventory')}
                    </div>
                  </div>
                </div>
              )}

              {/* Refresh Insights Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
                  {isAmharic ? 'የ AI ስልታዊ ምክሮች (Strategic Recommendations)' : 'Proactive Operational Recommendations'}
                </h4>
                <button
                  type="button"
                  onClick={loadInsights}
                  disabled={loadingInsights}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#7c3aed',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <RefreshCw size={13} className={loadingInsights ? 'animate-spin' : ''} />
                  {isAmharic ? 'አድስ' : 'Refresh'}
                </button>
              </div>

              {/* Insights List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    style={{
                      background: 'var(--bg-app, #f8fafc)',
                      border: '1.5px solid var(--border, #e2e8f0)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 900,
                            background: ins.impact === 'HIGH' ? '#fee2e2' : ins.impact === 'MEDIUM' ? '#fef3c7' : '#e0e7ff',
                            color: ins.impact === 'HIGH' ? '#dc2626' : ins.impact === 'MEDIUM' ? '#d97706' : '#4338ca'
                          }}
                        >
                          {ins.impact} PRIORITY
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted, #64748b)' }}>
                          {ins.category}
                        </span>
                      </div>
                    </div>

                    <h5 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
                      {isAmharic ? ins.titleAmharic : ins.title}
                    </h5>

                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted, #475569)', lineHeight: 1.45 }}>
                      {isAmharic ? ins.summaryAmharic : ins.summary}
                    </p>

                    <div
                      style={{
                        marginTop: 4,
                        padding: '8px 12px',
                        background: '#f5f3ff',
                        borderRadius: 10,
                        border: '1px solid #ddd6fe',
                        fontSize: 12,
                        fontWeight: 800,
                        color: '#6d28d9',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <CheckCircle2 size={15} color="#7c3aed" />
                      <span>{ins.actionableStep}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Switch to Chat prompt */}
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
                }}
              >
                <Sparkles size={16} />
                {isAmharic ? 'የተለየ ጥያቄ አለዎት? ከ AI ጋር ይጠይቁ' : 'Have a specific question? Ask Copilot directly'}
              </button>
            </div>
          )}

          {/* TAB 2: INTERACTIVE AI ADVISOR CHAT */}
          {activeTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Message List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.map((m) => {
                  const isUser = m.sender === 'user';
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        gap: 10,
                        alignItems: 'flex-start'
                      }}
                    >
                      {!isUser && (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)'
                          }}
                        >
                          <Sparkles size={16} />
                        </div>
                      )}

                      <div
                        style={{
                          maxWidth: '82%',
                          background: isUser ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'var(--bg-app, #f8fafc)',
                          color: isUser ? '#ffffff' : 'var(--text-main, #0f172a)',
                          borderRadius: 16,
                          borderTopRightRadius: isUser ? 4 : 16,
                          borderTopLeftRadius: !isUser ? 4 : 16,
                          padding: '12px 16px',
                          border: isUser ? 'none' : '1.5px solid var(--border, #e2e8f0)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          fontSize: 13,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {m.text}
                        <div
                          style={{
                            fontSize: 10,
                            opacity: 0.65,
                            textAlign: 'right',
                            marginTop: 4,
                            fontWeight: 600
                          }}
                        >
                          {m.timestamp}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sendingQuery && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}
                    >
                      <Sparkles size={16} />
                    </div>
                    <div
                      style={{
                        background: 'var(--bg-app, #f8fafc)',
                        border: '1.5px solid var(--border, #e2e8f0)',
                        padding: '10px 16px',
                        borderRadius: 16,
                        borderTopLeftRadius: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{isAmharic ? 'መረጃዎችን በመተንተን ላይ...' : 'Analyzing live restaurant database...'}</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Prompt Suggestion Chips */}
              <div
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-card, #ffffff)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
                  overflowX: 'auto',
                  display: 'flex',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none'
                }}
              >
                {suggestedPrompts.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      border: '1px solid #ddd6fe',
                      background: '#f5f3ff',
                      color: '#6d28d9',
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg-card, #ffffff)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    isAmharic
                      ? 'ስለ ሬስቶራንቱ ሽያጭ፣ እቃዎች ወይም ሰራተኞች ይጠይቁ...'
                      : 'Ask about today revenue, stock shortages, best items...'
                  }
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '2px solid var(--border, #e2e8f0)',
                    background: 'var(--bg-app, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                <button
                  type="button"
                  disabled={!inputMessage.trim() || sendingQuery}
                  onClick={() => handleSendMessage()}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    border: 'none',
                    background: !inputMessage.trim() || sendingQuery ? '#cbd5e1' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: !inputMessage.trim() || sendingQuery ? 'not-allowed' : 'pointer',
                    boxShadow: !inputMessage.trim() || sendingQuery ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.35)',
                    flexShrink: 0
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
