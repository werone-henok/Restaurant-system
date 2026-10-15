import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Globe, Wifi, WifiOff, RefreshCw, Moon, Sun, Clock, Sparkles } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { TimezoneModal } from './TimezoneModal';
import { AiAssistantModal } from './AiAssistantModal';
import { resolveImageUrl } from '../utils/imageUrl';

export const Header: React.FC<{ onOpenProfile?: () => void }> = ({ onOpenProfile }) => {
  const { 
    user, branches, currentBranchId, switchBranch, settings, 
    language, setLanguage, isOnline, offlineCount, 
    darkMode, toggleDarkMode, t,
    activeTimezone, timezoneMode, formatTime 
  } = useApp();

  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [clockTick, setClockTick] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const logoInitial = settings?.restaurant_name?.charAt(0)?.toUpperCase() || 'Y';
  const logoSrc = settings?.logo_url ? resolveImageUrl(settings.logo_url) : '/logo.png';

  return (
    <header className="app-header animated-gradient">
      {/* Branch Selector or Logo */}
      <div className="header-left">
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: 14,
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
        }}>
          <img
            src={logoSrc}
            alt="Yo Burger Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {user?.role === 'owner' || user?.role === 'superadmin' ? (
          <select
            value={currentBranchId}
            onChange={(e) => switchBranch(e.target.value)}
            className="header-branch-select"
            style={{
              padding: '3px 6px',
              fontSize: 12,
              fontWeight: 700,
              maxWidth: 135,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
          >
            <option value="ALL">🏢 {t('all_branches')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <span className="header-branch-title" style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
            <Building2 size={13} color="#ffffff" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {branches.find(b => b.id === currentBranchId)?.name || 'Addis Ababa Bole'}
            </span>
          </span>
        )}
      </div>

      {/* Connectivity & Actions */}
      <div className="header-right">
        {/* Offline / Sync Badge */}
        {isOnline ? (
          offlineCount > 0 ? (
            <span className="badge badge-pending header-badge" title="Syncing offline items">
              <RefreshCw size={10} className="animate-spin" />
              <span className="header-badge-text">{offlineCount}</span>
            </span>
          ) : (
            <span className="badge badge-ready header-badge" title="Connected to server">
              <Wifi size={11} />
              <span className="header-badge-text">{t('online')}</span>
            </span>
          )
        ) : (
          <span className="badge badge-cancelled header-badge" title="Working offline">
            <WifiOff size={11} />
            <span className="header-badge-text">{t('offline')}</span>
          </span>
        )}

        {/* Live Timezone & Clock Button */}
        <button
          onClick={() => setShowTimezoneModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 7px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.2)',
            fontSize: 11,
            fontWeight: 700,
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer'
          }}
          title={timezoneMode === 'auto' 
            ? `⚡ Auto: ${activeTimezone} (Click to change)` 
            : `🌐 Custom: ${activeTimezone} (Click to change)`}
        >
          <Clock size={12} />
          <span>{formatTime(new Date(clockTick))}</span>
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 6px',
            borderRadius: 6,
            background: 'rgba(255, 255, 255, 0.2)',
            fontSize: 11,
            fontWeight: 700,
            color: '#ffffff'
          }}
          title={language === 'en' ? 'ወደ አማርኛ ቀይር' : 'Switch to English'}
        >
          <Globe size={12} />
          <span>{language === 'en' ? 'አማ' : 'EN'}</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="dark-toggle"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* AI Assistant Quick Launcher for Super Admin, Admin & Owner */}
        {user && (user.role === 'superadmin' || user.role === 'admin' || user.role === 'owner') && (
          <button
            onClick={() => setShowAiModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 8,
              background: user.role === 'superadmin'
                ? 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)'
                : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: user.role === 'superadmin'
                ? '0 2px 8px rgba(219, 39, 119, 0.4)'
                : '0 2px 6px rgba(124, 58, 237, 0.4)'
            }}
            title={language === 'am' ? 'የስራ አስኪያጅ AI አማካሪ' : 'Executive AI Copilot'}
          >
            <Sparkles size={12} color="#fef08a" />
            <span>AI</span>
          </button>
        )}

        {/* System Notifications */}
        {user && <NotificationCenter />}

        {/* Super Admin Tag if logged in as superadmin */}
        {user?.role === 'superadmin' && (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
              color: '#78350f',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              textTransform: 'uppercase'
            }}
            title="Super Administrator (Supreme System Control)"
          >
            ⚡ SUPER ADMIN
          </span>
        )}

        {/* User Role Indicator / Profile Picture */}
        {user && (
          <button
            onClick={onOpenProfile}
            title={`${user.full_name} (${user.role})`}
            className="header-profile-btn"
            style={user.role === 'superadmin' ? { border: '2px solid #fbbf24', boxShadow: '0 0 8px rgba(251, 191, 36, 0.6)' } : undefined}
          >
            {user.profile_photo ? (
              <img
                src={resolveImageUrl(user.profile_photo)}
                alt={user.full_name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              user.full_name.charAt(0).toUpperCase()
            )}
          </button>
        )}
      </div>

      <TimezoneModal 
        isOpen={showTimezoneModal} 
        onClose={() => setShowTimezoneModal(false)} 
      />

      {/* AI Assistant Modal available from Header */}
      {user && (user.role === 'superadmin' || user.role === 'admin' || user.role === 'owner') && (
        <AiAssistantModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          branchId={currentBranchId}
          language={language}
          userRole={user.role}
        />
      )}
    </header>
  );
};
