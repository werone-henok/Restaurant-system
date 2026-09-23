import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Globe, Wifi, WifiOff, RefreshCw, Moon, Sun } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { resolveImageUrl } from '../utils/imageUrl';

export const Header: React.FC<{ onOpenProfile?: () => void }> = ({ onOpenProfile }) => {
  const { user, branches, currentBranchId, switchBranch, settings, language, setLanguage, isOnline, offlineCount, darkMode, toggleDarkMode, t } = useApp();

  const logoInitial = settings?.restaurant_name?.charAt(0)?.toUpperCase() || 'G';

  return (
    <header className="app-header animated-gradient">
      {/* Branch Selector or Logo */}
      <div className="header-left">
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: settings?.primary_color ? `linear-gradient(135deg, ${settings.primary_color} 0%, #ea580c 100%)` : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: 14,
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {settings?.logo_url ? (
            <img src={resolveImageUrl(settings.logo_url)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            logoInitial
          )}
        </div>

        {user?.role === 'owner' ? (
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

        {/* System Notifications */}
        {user && <NotificationCenter />}

        {/* User Role Indicator / Profile Picture */}
        {user && (
          <button
            onClick={onOpenProfile}
            title={`${user.full_name} (${user.role})`}
            className="header-profile-btn"
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
    </header>
  );
};
