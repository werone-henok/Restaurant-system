import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { tactileFeedback } from '../../utils/feedback';
import { Lock, User as UserIcon, Building2, KeyRound, Phone, Sparkles, HelpCircle, ArrowLeft } from 'lucide-react';

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
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
    }}>
      {/* Brand Heading */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: 28,
          boxShadow: '0 8px 16px rgba(249, 115, 22, 0.3)'
        }}>
          G
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          GourmetOS Restaurant
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
    </div>
  );
};
