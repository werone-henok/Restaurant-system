import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { translations, type Language } from '../i18n/translations';

import { TIMEZONE_OPTIONS, getDeviceTimezone, getDeviceOffsetMinutes } from '../utils/timezone';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'owner' | 'admin' | 'cashier' | 'chef' | 'barista' | 'waiter' | 'storekeeper';
  branch_id: string;
  phone?: string;
  employee_id?: string;
  profile_photo?: string;
  status: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  vat_rate: number;
}

export interface RestaurantSettings {
  id: string;
  restaurant_name: string;
  slogan?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  vat_enabled: number;
  vat_percentage: number;
  tax_number?: string;
  receipt_footer?: string;
  receipt_footer_amharic?: string;
  timezone_mode?: 'AUTO' | 'MANUAL';
  system_timezone?: string;
  timezone_offset_minutes?: number;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  currentBranchId: string;
  branches: Branch[];
  settings: RestaurantSettings | null;
  language: Language;
  isOnline: boolean;
  offlineCount: number;
  darkMode: boolean;
  toggleDarkMode: () => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  switchBranch: (branchId: string) => void;
  refreshBranches: () => void;
  refreshSettings: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;

  // Timezone configuration
  timezoneMode: 'auto' | 'manual';
  selectedTimezone: string;
  detectedTimezone: string;
  activeTimezone: string;
  activeOffsetMinutes: number;
  setTimezoneMode: (mode: 'auto' | 'manual') => void;
  setSelectedTimezone: (tz: string, offsetMinutes?: number) => void;
  formatTime: (dateInput: string | Date | number, includeSeconds?: boolean) => string;
  formatDateTime: (dateInput: string | Date | number) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Use sessionStorage for auth data — cleared on tab/browser close, not persistent to XSS
    const saved = sessionStorage.getItem('gos_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('gos_token'));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string>(() => {
    return localStorage.getItem('selected_branch') || 'branch_addis';
  });
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(api.getQueueCount());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dark_mode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark class to <html> whenever darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark_mode', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleSync = (e: any) => setOfflineCount(e.detail);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync_queue_updated', handleSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync_queue_updated', handleSync);
    };
  }, []);

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const refreshBranches = () => {
    if (token) {
      api.request<Branch[]>('/branches')
        .then(data => {
          setBranches(data);
          if (!data.some(b => b.id === currentBranchId) && data.length > 0) {
            setCurrentBranchId(data[0].id);
          }
        })
        .catch(() => {});
    }
  };

  const refreshSettings = () => {
    if (token) {
      api.request<RestaurantSettings>('/admin/settings')
        .then(setSettings)
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (token) {
      refreshBranches();
      refreshSettings();
    }
  }, [token]);

  // Dynamically synchronize theme colors from settings
  useEffect(() => {
    if (settings?.primary_color) {
      document.documentElement.style.setProperty('--primary', settings.primary_color);
      document.documentElement.style.setProperty('--border-focus', settings.primary_color);
    }
    if (settings?.secondary_color) {
      document.documentElement.style.setProperty('--secondary-brand', settings.secondary_color);
    }
  }, [settings]);

  const login = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    // sessionStorage: auth data is cleared on browser/tab close (XSS-safer than localStorage)
    sessionStorage.setItem('gos_token', newToken);
    sessionStorage.setItem('gos_user', JSON.stringify(newUser));
    api.setToken(newToken);
    if (newUser.branch_id) {
      setCurrentBranchId(newUser.branch_id);
      localStorage.setItem('selected_branch', newUser.branch_id);
    }
    // Auto-default operational staff (waiter, cashier, chef, barista, storekeeper) to Amharic
    const operationalRoles = ['waiter', 'cashier', 'chef', 'barista', 'storekeeper'];
    if (operationalRoles.includes(newUser.role) && !localStorage.getItem('language_explicitly_set')) {
      setLanguageState('am');
      localStorage.setItem('language', 'am');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // Clear both sessionStorage and any legacy localStorage auth keys
    sessionStorage.removeItem('gos_token');
    sessionStorage.removeItem('gos_user');
    localStorage.removeItem('token');   // legacy cleanup
    localStorage.removeItem('user');    // legacy cleanup
    api.setToken(null);
  };

  const switchBranch = (branchId: string) => {
    setCurrentBranchId(branchId);
    localStorage.setItem('selected_branch', branchId);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    localStorage.setItem('language_explicitly_set', 'true');
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  // Timezone state management
  const detectedTimezone = getDeviceTimezone();
  const [timezoneMode, setTimezoneModeState] = useState<'auto' | 'manual'>(() => {
    return (localStorage.getItem('gos_tz_mode') as 'auto' | 'manual') || 'auto';
  });

  const [selectedTimezone, setSelectedTimezoneState] = useState<string>(() => {
    return localStorage.getItem('gos_selected_tz') || 'Africa/Addis_Ababa';
  });

  const [selectedOffsetMinutes, setSelectedOffsetMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('gos_selected_tz_offset');
    return saved !== null ? parseInt(saved, 10) : 180;
  });

  // Calculate the currently active timezone and offset
  const activeTimezone = timezoneMode === 'auto' 
    ? detectedTimezone 
    : selectedTimezone;

  const activeOffsetMinutes = timezoneMode === 'auto'
    ? getDeviceOffsetMinutes()
    : selectedOffsetMinutes;

  const setTimezoneMode = (mode: 'auto' | 'manual') => {
    setTimezoneModeState(mode);
    localStorage.setItem('gos_tz_mode', mode);
  };

  const setSelectedTimezone = (tz: string, offsetMinutes?: number) => {
    setSelectedTimezoneState(tz);
    localStorage.setItem('gos_selected_tz', tz);
    let resolvedOffset = offsetMinutes;
    if (resolvedOffset === undefined) {
      const match = TIMEZONE_OPTIONS.find(o => o.value === tz);
      resolvedOffset = match ? match.offsetMinutes : 180;
    }
    setSelectedOffsetMinutes(resolvedOffset);
    localStorage.setItem('gos_selected_tz_offset', String(resolvedOffset));
  };

  const formatTime = (dateInput: string | Date | number, includeSeconds = false): string => {
    try {
      const d = typeof dateInput === 'string' && !dateInput.endsWith('Z') && !dateInput.includes('+')
        ? new Date(dateInput.replace(' ', 'T') + 'Z')
        : new Date(dateInput);
      return new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
        timeZone: activeTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
        hour12: true
      }).format(d);
    } catch (_) {
      return String(dateInput);
    }
  };

  const formatDateTime = (dateInput: string | Date | number): string => {
    try {
      const d = typeof dateInput === 'string' && !dateInput.endsWith('Z') && !dateInput.includes('+')
        ? new Date(dateInput.replace(' ', 'T') + 'Z')
        : new Date(dateInput);
      return new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
        timeZone: activeTimezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch (_) {
      return String(dateInput);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        currentBranchId,
        branches,
        settings,
        language,
        isOnline,
        offlineCount,
        darkMode,
        toggleDarkMode,
        login,
        logout,
        switchBranch,
        refreshBranches,
        refreshSettings,
        setLanguage,
        t,
        timezoneMode,
        selectedTimezone,
        detectedTimezone,
        activeTimezone,
        activeOffsetMinutes,
        setTimezoneMode,
        setSelectedTimezone,
        formatTime,
        formatDateTime
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
