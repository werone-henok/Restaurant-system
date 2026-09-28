import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { tactileFeedback } from '../utils/feedback';
import { AlertTriangle, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface NotificationItem {
  id: string;
  branch_id?: string;
  target_role?: string;
  target_user_id?: string;
  title: string;
  title_amharic?: string;
  message: string;
  message_amharic?: string;
  type: string;
  link_ref?: string;
  is_read: number;
  created_at: string;
}

export const isUrgentNotification = (n: NotificationItem): boolean => {
  const type = (n.type || '').toUpperCase();
  const title = (n.title || '').toLowerCase();
  const titleAmharic = n.title_amharic || '';
  const msg = (n.message || '').toLowerCase();
  const msgAmharic = n.message_amharic || '';

  return (
    type === 'LOW_STOCK' ||
    type === 'URGENT' ||
    type === 'USER_PENDING' ||
    title.includes('🚨') ||
    title.includes('urgent') ||
    titleAmharic.includes('🚨') ||
    titleAmharic.includes('አስቸኳይ') ||
    msg.includes('🚨') ||
    msg.includes('urgent') ||
    msgAmharic.includes('አስቸኳይ')
  );
};

export const TopUrgentBanner: React.FC = () => {
  const { language } = useApp();
  const [urgentItems, setUrgentItems] = useState<NotificationItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchUrgentNotifications = async () => {
    try {
      const data = await api.request<{ notifications: NotificationItem[] }>('/notifications');
      const urgent = (data.notifications || []).filter(n => isUrgentNotification(n) && !n.is_read);
      setUrgentItems(urgent);
      if (currentIndex >= urgent.length) {
        setCurrentIndex(Math.max(0, urgent.length - 1));
      }
    } catch {
      // Ignore network errors gracefully
    }
  };

  useEffect(() => {
    fetchUrgentNotifications();

    const unsubscribe = api.onEvent((event) => {
      if (
        event?.type === 'NOTIFICATION_NEW' ||
        event?.type === 'NOTIFICATION' ||
        event?.type === 'LOW_STOCK' ||
        event?.type === 'BOM_LOW_STOCK' ||
        event?.type === 'INVENTORY_LOW' ||
        event?.type === 'BAKERY_REQUEST_UPDATED' ||
        event?.type === 'BAKERY_ITEM_AVAILABILITY_CHANGED'
      ) {
        fetchUrgentNotifications();
      }
    });

    const interval = setInterval(fetchUrgentNotifications, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleDismiss = async (id: string) => {
    tactileFeedback('click');
    setUrgentItems(prev => prev.filter(item => item.id !== id));
    try {
      await api.request(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to mark urgent notification read:', e);
    }
  };

  if (urgentItems.length === 0) return null;

  const currentItem = urgentItems[currentIndex] || urgentItems[0];
  const title = language === 'am' && currentItem.title_amharic ? currentItem.title_amharic : currentItem.title;
  const message = language === 'am' && currentItem.message_amharic ? currentItem.message_amharic : currentItem.message;

  return (
    <div
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ea580c 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.35)',
        zIndex: 90,
        position: 'relative',
        animation: 'pulse-border 2s infinite ease-in-out'
      }}
    >
      {/* Left: Icon & Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.22)',
            borderRadius: 10,
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0
          }}
        >
          <AlertTriangle size={18} color="#ffffff" className="animate-bounce" />
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            🚨 አስቸኳይ (URGENT)
          </span>
        </div>

        {/* Text */}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <span style={{ fontSize: 12, opacity: 0.95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>
            {message}
          </span>
        </div>
      </div>

      {/* Right: Controls & Acknowledge Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {urgentItems.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setCurrentIndex(i => (i > 0 ? i - 1 : urgentItems.length - 1))}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 800 }}>
              {currentIndex + 1}/{urgentItems.length}
            </span>
            <button
              type="button"
              onClick={() => setCurrentIndex(i => (i < urgentItems.length - 1 ? i + 1 : 0))}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => handleDismiss(currentItem.id)}
          style={{
            background: '#ffffff',
            color: '#b91c1c',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'transform 0.1s ease'
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Check size={14} />
          <span>ተረዳሁ (Dismiss)</span>
        </button>

        <button
          type="button"
          onClick={() => handleDismiss(currentItem.id)}
          title="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
