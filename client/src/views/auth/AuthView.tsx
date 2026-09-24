import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api, getApiBaseUrl, setCustomApiUrl } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { tactileFeedback } from '../../utils/feedback';
import { Lock, User as UserIcon, Building2, KeyRound, Phone, Sparkles, HelpCircle, ArrowLeft, Server, Globe, Check, Settings2, X } from 'lucide-react';

const ROLE_OPTIONS = [
  { id: 'waiter', label: 'Waiter', labelAm: 'አስተናጋጅ', emoji: '🍽️', bg: '#ffedd5', color: '#c2410c' },
  { id: 'cashier', label: 'Cashier', labelAm: 'ካሺየር', emoji: '💵', bg: '#e0f2fe', color: '#0369a1' },
  { id: 'chef', label: 'Chef', labelAm: 'ሼፍ', emoji: '🔥', bg: '#fee2e2', color: '#b91c1c' },
  { id: 'barista', label: 'Barista', labelAm: 'ባሪስታ', emoji: '☕', bg: '#f3e8ff', color: '#7e22ce' },
  { id: 'storekeeper', label: 'Inventory', labelAm: 'ዕቃ ክፍል', emoji: '📦', bg: '#d1fae5', color: '#047857' },
  { id: 'admin', label: 'Admin', labelAm: 'አስተዳዳሪ', emoji: '🛡️', bg: '#f1f5f9', color: '#334155' }
];

const BRANCH_EMOJIS: Record<string, string> = {
  branch_addis: '🏙️',
  branch_adama: '🏘️',
  branch_diredawa: '🏪'
};

export const AuthView: React.FC = () => {
  const { login, branches } = useApp();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('waiter');
  const [password, setPassword] = useState('password123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<'waiter' | 'cashier' | 'chef' | 'barista' | 'storekeeper' | 'admin'>('waiter');
  const [branchId, setBranchId] = useState('branch_addis');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [forgotUsername, setForgotUsername] = useState('');

  // Server Switcher State
  const [showServerModal, setShowServerModal] = useState(false);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [customInput, setCustomInput] = useState(getApiBaseUrl());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      tactileFeedback('success');
      login(res.user, res.token);
    } catch (err: any) {
      tactileFeedback('error');
      setError(err.message || 'Login failed. Check credentials or approval status.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.request<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          username,
          password,
          phone,
          employee_id: employeeId,
          requested_role: role,
          branch_id: branchId,
          profile_photo: photoUrl
        })
      });
      tactileFeedback('success');
      setSuccessMsg(res.message);
      setIsRegister(false);
    } catch (err: any) {
      tactileFeedback('error');
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.request<any>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ username: forgotUsername })
      });
      tactileFeedback('success');
      setSuccessMsg(res.message);
      setIsForgot(false);
      setForgotUsername('');
    } catch (err: any) {
      tactileFeedback('error');
      setError(err.message || 'Failed to request reset.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Account Switcher
  const fillDemo = (u: string, p: string) => {
    tactileFeedback('click');
    setUsername(u);
    setPassword(p);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '32px 20px',
      background: 'linear-gradient(180deg, rgba(255, 158, 1, 0.08) 0%, var(--bg-app) 28%, var(--bg-app) 100%)'
    }}>
      {/* Brand Heading */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 70,
          height: 70,
          borderRadius: 20,
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 8px 18px rgba(0, 0, 0, 0.15)',
          background: '#000000'
        }}>
          <img src="/logo.png" alt="Yo Burger & Restaurant Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Yo Burger & Restaurant
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {isForgot
            ? 'Password Recovery'
            : isRegister
              ? 'Staff Registration & Onboarding'
              : 'Sign in to access your operational role'}
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
          {successMsg}
        </div>
      )}

      {isForgot ? (
        <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              required
              value={forgotUsername}
              onChange={e => setForgotUsername(e.target.value)}
              placeholder="e.g. waiter"
              style={{ width: '100%', height: 44 }}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48 }}>
            {loading ? 'Submitting...' : 'Request Password Reset'}
          </button>

          <button
            type="button"
            onClick={() => {
              tactileFeedback('click');
              setIsForgot(false);
            }}
            className="btn btn-secondary btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </button>
        </form>
      ) : isRegister ? (
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CameraCapture
            label="Profile Photo (Selfie / Camera)"
            photoUrl={photoUrl}
            onPhotoCaptured={setPhotoUrl}
            onPhotoCleared={() => setPhotoUrl(null)}
          />

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
            <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Almaz Bekele" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. almaz.b" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 9..." style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Employee ID</label>
              <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="EMP-102" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Visual Role Selection for Illiterate / Visual Users */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
              Select Operational Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {ROLE_OPTIONS.map(r => {
                const isSelected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      tactileFeedback('click');
                      setRole(r.id as any);
                    }}
                    style={{
                      padding: '10px 4px',
                      borderRadius: 12,
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: isSelected ? r.bg : 'var(--bg-card)',
                      color: isSelected ? r.color : 'var(--text-main)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: isSelected ? '0 0 0 2px var(--primary)' : 'var(--shadow-sm)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{r.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 800 }}>{r.label}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{r.labelAm}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Branch Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
              Branch
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${branches.length || 3}, 1fr)`, gap: 8 }}>
              {branches.map(b => {
                const isSelected = branchId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      tactileFeedback('click');
                      setBranchId(b.id);
                    }}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 12,
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      textAlign: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 20, display: 'block' }}>{BRANCH_EMOJIS[b.id] || '🏢'}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, display: 'block', marginTop: 2 }}>{b.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48, marginTop: 8 }}>
            {loading ? 'Submitting Application...' : 'Register as Employee'}
          </button>

          <button
            type="button"
            onClick={() => {
              tactileFeedback('click');
              setIsRegister(false);
            }}
            className="btn btn-secondary btn-block"
          >
            Back to Sign In
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" style={{ width: '100%', height: 44 }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  tactileFeedback('click');
                  setIsForgot(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot Password?
              </button>
            </div>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" style={{ width: '100%', height: 44 }} />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48, fontSize: 15 }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => {
              tactileFeedback('click');
              setIsRegister(true);
            }}
            className="btn btn-secondary btn-block"
          >
            Register New Employee Account
          </button>

          {/* Quick Demo Preload Buttons */}
          <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-subtle)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
              ⚡ 1-Tap Demo Switcher (All 7 Roles)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <button type="button" onClick={() => fillDemo('waiter', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>🍽️</span>
                <span>Waiter</span>
              </button>
              <button type="button" onClick={() => fillDemo('cashier', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>💵</span>
                <span>Cashier</span>
              </button>
              <button type="button" onClick={() => fillDemo('chef', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>🔥</span>
                <span>Chef</span>
              </button>
              <button type="button" onClick={() => fillDemo('barista', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>☕</span>
                <span>Barista</span>
              </button>
              <button type="button" onClick={() => fillDemo('storekeeper', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <span>Inventory</span>
              </button>
              <button type="button" onClick={() => fillDemo('admin', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 16 }}>🛡️</span>
                <span>Admin</span>
              </button>
              <button type="button" onClick={() => fillDemo('owner', 'password123')} className="btn" style={{ padding: '8px 4px', fontSize: 11, background: '#ffffff', border: '1.5px solid var(--primary)', borderRadius: 10, gridColumn: 'span 2', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>👑</span>
                <span>Owner (Executive)</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Server Endpoint Indicator & Switcher */}
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => setShowServerModal(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: apiUrl.includes('localhost') ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
          <span>Server: <strong>{apiUrl.includes('localhost') ? 'Local Persistent DB (Laptop)' : 'Render Cloud'}</strong></span>
          <Settings2 size={12} />
        </button>
      </div>

      {/* Server Connection Modal */}
      {showServerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 440,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Server Connection</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Choose which backend server this app communicates with. Localhost saves data permanently to your laptop's SQLite database.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Option 1: Local Laptop */}
              <button
                type="button"
                onClick={() => {
                  setCustomApiUrl('http://localhost:4001/api');
                }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: apiUrl.includes('localhost') ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: apiUrl.includes('localhost') ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-subtle, #f8fafc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>💻 Localhost (Laptop Persistent DB)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>http://localhost:4001/api (Never loses data)</div>
                </div>
                {apiUrl.includes('localhost') && <Check size={18} color="var(--primary)" />}
              </button>

              {/* Option 2: Render Cloud */}
              <button
                type="button"
                onClick={() => {
                  setCustomApiUrl('https://restaurant-system-ipd2.onrender.com/api');
                }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: apiUrl.includes('onrender.com') ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: apiUrl.includes('onrender.com') ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-subtle, #f8fafc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>☁️ Render Cloud API</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>https://restaurant-system-ipd2.onrender.com/api</div>
                </div>
                {apiUrl.includes('onrender.com') && <Check size={18} color="var(--primary)" />}
              </button>
            </div>

            {/* Custom URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Or Custom IP / Wi-Fi URL:</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="http://192.168.1.X:4001/api"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 12
                  }}
                />
                <button
                  type="button"
                  onClick={() => setCustomApiUrl(customInput)}
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: 12 }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
