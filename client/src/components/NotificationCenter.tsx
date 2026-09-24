import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Utensils,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
  Info,
  X
} from 'lucide-react';

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

export const NotificationCenter: React.FC = () => {
  const { language, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.request<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Offline or network error - ignore gracefully
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Listen to real-time events from WebSocket
    const unsubscribe = api.onEvent((event) => {
      if (
        event?.type === 'ORDER_NEW' ||
        event?.type === 'ORDER_STATUS_CHANGED' ||
        event?.type === 'BOM_LOW_STOCK' ||
        event?.type === 'INVENTORY_LOW' ||
        event?.type === 'NOTIFICATION'
      ) {
        fetchNotifications();
      }
    });

    // Poll periodically every 25 seconds as backup
    const interval = setInterval(fetchNotifications, 25000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await api.request(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
    try {
      await api.request('/notifications/read-all', { method: 'PATCH' });
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertTriangle size={16} color="#ef4444" />;
      case 'ORDER_NEW':
        return <Utensils size={16} color="#10b981" />;
      case 'ORDER_READY':
        return <CheckCircle2 size={16} color="#0ea5e9" />;
      case 'EXPENSE':
        return <DollarSign size={16} color="#f59e0b" />;
      case 'USER_PENDING':
        return <ShieldAlert size={16} color="#8b5cf6" />;
      default:
        return <Info size={16} color="#64748b" />;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now.getTime() - time.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);

      if (diffMin < 1) return language === 'am' ? 'አሁን' : 'Just now';
      if (diffMin < 60) return language === 'am' ? `${diffMin} ደቂቃ በፊት` : `${diffMin}m ago`;
      if (diffHr < 24) return language === 'am' ? `${diffHr} ሰዓት በፊት` : `${diffHr}h ago`;
      return time.toLocaleDateString(language === 'am' ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="btn-icon"
        title={t('notifications')}
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          borderRadius: 8,
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border)',
          color: 'var(--text-main)',
          cursor: 'pointer'
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              background: 'var(--danger)',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              boxShadow: '0 0 0 2px var(--bg-card)',
              animation: 'pulse 2s infinite'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="notification-backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="notification-dropdown animate-scale-up"
            style={{
              position: 'absolute',
              top: 42,
              right: 0,
              width: 350,
              maxWidth: 'calc(100vw - 20px)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-floating)',
              zIndex: 1000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div
              className="notif-header"
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bell size={15} color="var(--primary)" />
                <span className="notif-title">
                  {t('notifications')}
                </span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '1px 6px',
                      borderRadius: 10
                    }}
                  >
                    {unreadCount} {t('unread')}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '2px 6px',
                      borderRadius: 4
                    }}
                    title={t('mark_all_read')}
                  >
                    <CheckCheck size={14} />
                    <span>{t('mark_all_read')}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Bell size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{t('no_notifications')}</p>
                </div>
              ) : (
                notifications.map((item) => {
                  const title = language === 'am' && item.title_amharic ? item.title_amharic : item.title;
                  const message = language === 'am' && item.message_amharic ? item.message_amharic : item.message;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (!item.is_read) markAsRead(item.id);
                      }}
                      className="notif-item"
                      style={{
                        padding: '12px 14px',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: item.is_read ? 'transparent' : 'rgba(249, 115, 22, 0.05)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'var(--bg-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 2
                        }}
                      >
                        {getNotificationIcon(item.type)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                          <span
                            className="notif-item-title"
                            style={{
                              fontWeight: item.is_read ? 600 : 800,
                              fontSize: 13,
                              color: 'var(--text-main)',
                              lineHeight: 1.3
                            }}
                          >
                            {title}
                          </span>
                          <span className="notif-item-time" style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>
                        <p
                          className="notif-item-desc"
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            marginTop: 3,
                            lineHeight: 1.35,
                            wordBreak: 'break-word'
                          }}
                        >
                          {message}
                        </p>
                      </div>

                      {!item.is_read && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            flexShrink: 0,
                            marginTop: 6
                          }}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
