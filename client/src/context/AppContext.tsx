import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { translations, type Language } from '../i18n/translations';

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
  login: (user: User, token: string) => void;
  logout: () => void;
  switchBranch: (branchId: string) => void;
  refreshBranches: () => void;
  refreshSettings: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string>(() => {
    return localStorage.getItem('selected_branch') || 'branch_addis';
  });
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(api.getQueueCount());

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

  const login = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    api.setToken(newToken);
    if (newUser.branch_id) {
      setCurrentBranchId(newUser.branch_id);
      localStorage.setItem('selected_branch', newUser.branch_id);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    api.setToken(null);
  };

  const switchBranch = (branchId: string) => {
    setCurrentBranchId(branchId);
    localStorage.setItem('selected_branch', branchId);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
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
        login,
        logout,
        switchBranch,
        refreshBranches,
        refreshSettings,
        setLanguage,
        t
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
