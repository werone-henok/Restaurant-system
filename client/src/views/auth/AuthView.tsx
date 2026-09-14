import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { CameraCapture } from '../../components/CameraCapture';
import { Lock, User as UserIcon, Building2, KeyRound, Phone, Sparkles } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { login, branches } = useApp();
  const [isRegister, setIsRegister] = useState(false);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      login(res.user, res.token);
    } catch (err: any) {
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
      setSuccessMsg(res.message);
      setIsRegister(false);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Account Switcher
  const fillDemo = (u: string, p: string) => {
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
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: 26,
          boxShadow: '0 8px 16px rgba(249, 115, 22, 0.3)'
        }}>
          G
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          GourmetOS Restaurant
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {isRegister ? 'Staff Registration & Onboarding' : 'Sign in to access your operational role'}
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {isRegister ? (
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Requested Role</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} style={{ width: '100%' }}>
                <option value="waiter">Waiter</option>
                <option value="cashier">Cashier</option>
                <option value="chef">Chef</option>
                <option value="barista">Barista</option>
                <option value="storekeeper">Storekeeper</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Branch</label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ width: '100%' }}>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
            {loading ? 'Submitting Application...' : 'Register as Employee'}
          </button>

          <button type="button" onClick={() => setIsRegister(false)} className="btn btn-secondary btn-block">
            Back to Sign In
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" style={{ width: '100%' }} />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ height: 48, fontSize: 15 }}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          <button type="button" onClick={() => setIsRegister(true)} className="btn btn-secondary btn-block">
            Register New Employee Account
          </button>

          {/* Quick Demo Preload Buttons */}
          <div style={{ marginTop: 24, padding: 14, background: 'var(--bg-subtle)', borderRadius: 12 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
              ⚡ 1-Tap Demo Switcher (All 7 Roles)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <button type="button" onClick={() => fillDemo('waiter', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Waiter</button>
              <button type="button" onClick={() => fillDemo('cashier', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Cashier</button>
              <button type="button" onClick={() => fillDemo('chef', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Chef</button>
              <button type="button" onClick={() => fillDemo('barista', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Barista</button>
              <button type="button" onClick={() => fillDemo('storekeeper', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Storekeeper</button>
              <button type="button" onClick={() => fillDemo('admin', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)' }}>Admin</button>
              <button type="button" onClick={() => fillDemo('owner', 'password123')} className="btn" style={{ padding: '6px 4px', fontSize: 11, background: '#ffffff', border: '1px solid var(--border)', gridColumn: 'span 2', fontWeight: 700, color: 'var(--primary)' }}>👑 Owner (Multi-Branch)</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
