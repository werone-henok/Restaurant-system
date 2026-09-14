import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { OnboardingSlider } from './views/onboarding/OnboardingSlider';
import { AuthView } from './views/auth/AuthView';
import { WaiterView } from './views/waiter/WaiterView';
import { CashierView } from './views/cashier/CashierView';
import { ChefView } from './views/chef/ChefView';
import { BaristaView } from './views/barista/BaristaView';
import { StorekeeperView } from './views/storekeeper/StorekeeperView';
import { AdminView } from './views/admin/AdminView';
import { OwnerView } from './views/owner/OwnerView';

import {
  UtensilsCrossed,
  DollarSign,
  ChefHat,
  Coffee,
  Store,
  Shield,
  BarChart3,
  LogOut,
  User as UserIcon
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, logout, t } = useApp();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('has_seen_onboarding') === 'true';
  });
  const [activeTabOverride, setActiveTabOverride] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // 1. Show Onboarding if first launch
  if (!hasSeenOnboarding) {
    return <OnboardingSlider onComplete={() => setHasSeenOnboarding(true)} />;
  }

  // 2. Show Auth screen if unauthenticated
  if (!user) {
    return <AuthView />;
  }

  const role = user.role;
  const currentTab = activeTabOverride || role;

  // Bottom navigation items adapt automatically based on role permissions
  const renderNav = () => {
    const navItems = [];

    if (role === 'owner') {
      navItems.push(
        { id: 'owner', label: 'Executive', icon: <BarChart3 size={20} /> },
        { id: 'cashier', label: 'Cashier', icon: <DollarSign size={20} /> },
        { id: 'chef', label: 'Kitchen', icon: <ChefHat size={20} /> },
        { id: 'storekeeper', label: 'Inventory', icon: <Store size={20} /> },
        { id: 'admin', label: 'Admin', icon: <Shield size={20} /> }
      );
    } else if (role === 'admin') {
      navItems.push(
        { id: 'admin', label: 'Admin', icon: <Shield size={20} /> },
        { id: 'cashier', label: 'Cashier', icon: <DollarSign size={20} /> },
        { id: 'storekeeper', label: 'Inventory', icon: <Store size={20} /> },
        { id: 'owner', label: 'Reports', icon: <BarChart3 size={20} /> }
      );
    } else if (role === 'waiter') {
      navItems.push(
        { id: 'waiter', label: 'Orders', icon: <UtensilsCrossed size={20} /> }
      );
    } else if (role === 'cashier') {
      navItems.push(
        { id: 'cashier', label: 'Cashier', icon: <DollarSign size={20} /> }
      );
    } else if (role === 'chef') {
      navItems.push(
        { id: 'chef', label: 'Kitchen', icon: <ChefHat size={20} /> }
      );
    } else if (role === 'barista') {
      navItems.push(
        { id: 'barista', label: 'Bar', icon: <Coffee size={20} /> }
      );
    } else if (role === 'storekeeper') {
      navItems.push(
        { id: 'storekeeper', label: 'Inventory', icon: <Store size={20} /> }
      );
    }

    if (navItems.length <= 1) return null;

    return (
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTabOverride(item.id)}
            className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    );
  };

  const renderCurrentView = () => {
    switch (currentTab) {
      case 'waiter':
        return <WaiterView />;
      case 'cashier':
        return <CashierView />;
      case 'chef':
        return <ChefView />;
      case 'barista':
        return <BaristaView />;
      case 'storekeeper':
        return <StorekeeperView />;
      case 'admin':
        return <AdminView />;
      case 'owner':
        return <OwnerView />;
      default:
        return <WaiterView />;
    }
  };

  return (
    <div className="app-container">
      <Header onOpenProfile={() => setShowProfile(true)} />

      {renderCurrentView()}

      {renderNav()}

      {/* User Profile / Logout Drawer */}
      {showProfile && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: 540,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24
          }} className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Employee Profile</h3>
              <button onClick={() => setShowProfile(false)} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: 20 }}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 800 }}>{user.full_name}</h4>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Role: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{user.role}</strong>
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                  @{user.username} • ID: {user.employee_id || 'N/A'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowProfile(false);
                logout();
              }}
              className="btn btn-danger btn-block"
              style={{ height: 48 }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
