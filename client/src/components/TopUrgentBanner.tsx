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
        maxWidth: '100vw',
        background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ea580c 100%)',
        color: '#ffffff',
        padding: '8px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.35)',
        zIndex: 90,
        position: 'relative',
        overflow: 'hidden',
        animation: 'pulse-border 2s infinite ease-in-out'
      }}
    >
      {/* Left: Icon & Badge & Text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 200px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.22)',
            borderRadius: 8,
            padding: '4px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0
          }}
        >
          <AlertTriangle size={15} color="#ffffff" className="animate-bounce" />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {language === 'am' ? '🚨 አስቸኳይ' : '🚨 URGENT'}
          </span>
        </div>

        {/* Text */}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
          <span style={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '35vw' }}>
            {title}
          </span>
          <span style={{ fontSize: 11, opacity: 0.95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {message}
          </span>
        </div>
      </div>

      {/* Right: Controls & Acknowledge Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
        {urgentItems.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.2)', padding: '2px 5px', borderRadius: 6 }}>
            <button
              type="button"
              onClick={() => setCurrentIndex(i => (i > 0 ? i - 1 : urgentItems.length - 1))}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: 10, fontWeight: 800 }}>
              {currentIndex + 1}/{urgentItems.length}
            </span>
            <button
              type="button"
              onClick={() => setCurrentIndex(i => (i < urgentItems.length - 1 ? i + 1 : 0))}
              style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <ChevronRight size={13} />
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
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
            transition: 'transform 0.1s ease'
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Check size={13} />
          <span>{language === 'am' ? 'ተረዳሁ' : 'Dismiss'}</span>
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
            padding: 3,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
