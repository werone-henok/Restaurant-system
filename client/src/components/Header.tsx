import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Globe, Wifi, WifiOff, RefreshCw, Moon, Sun } from 'lucide-react';

export const Header: React.FC<{ onOpenProfile?: () => void }> = ({ onOpenProfile }) => {
  const { user, branches, currentBranchId, switchBranch, settings, language, setLanguage, isOnline, offlineCount, darkMode, toggleDarkMode, t } = useApp();

  const logoInitial = settings?.restaurant_name?.charAt(0)?.toUpperCase() || 'G';

  return (
    <header className="app-header">
      {/* Branch Selector or Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: settings?.primary_color ? `linear-gradient(135deg, ${settings.primary_color} 0%, #ea580c 100%)` : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: 15,
          overflow: 'hidden'
        }}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            logoInitial
          )}
        </div>

        {user?.role === 'owner' ? (
          <select
            value={currentBranchId}
            onChange={(e) => switchBranch(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 700,
              maxWidth: 150,
              textOverflow: 'ellipsis'
            }}
          >
            <option value="ALL">🏢 {t('all_branches')}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Building2 size={14} color="var(--primary)" />
            {branches.find(b => b.id === currentBranchId)?.name || 'Addis Ababa Bole'}
          </span>
        )}
      </div>

      {/* Connectivity & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Offline / Sync Badge */}
        {isOnline ? (
          offlineCount > 0 ? (
            <span className="badge badge-pending" title="Syncing offline items">
              <RefreshCw size={10} className="animate-spin" /> {offlineCount}
            </span>
          ) : (
            <span className="badge badge-ready" title="Connected to server">
              <Wifi size={11} /> {t('online')}
            </span>
          )
        ) : (
          <span className="badge badge-cancelled" title="Working offline">
            <WifiOff size={11} /> {t('offline')}
          </span>
        )}

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'var(--bg-subtle)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-main)'
          }}
        >
          <Globe size={13} />
          {language === 'en' ? 'አማርኛ' : 'EN'}
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="dark-toggle"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* User Role Indicator */}
        {user && (
          <button
            onClick={onOpenProfile}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: 12
            }}
          >
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              user.full_name.charAt(0).toUpperCase()
            )}
          </button>
        )}
      </div>
    </header>
  );
};
