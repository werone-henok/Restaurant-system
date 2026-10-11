import React, { useState } from 'react';
import { ShieldAlert, Key, Copy, Check, Lock, Cpu, RefreshCw, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '../api/client';

interface LicenseLockScreenProps {
  status: string;
  message: string;
  machineId: string;
  onActivated: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  status,
  message,
  machineId,
  onActivated
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopy = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('Please paste a valid GourmetOS license key.');
      return;
    }

    setIsActivating(true);
    setErrorMsg(null);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseToken: tokenInput.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Activation failed. Invalid license key for this machine.');
      } else {
        onActivated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error connecting to backend server.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 999999,
        fontFamily: 'var(--font-family, system-ui, sans-serif)',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 0.15)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 76,
              height: 76,
              margin: '0 auto 16px',
              borderRadius: 22,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.1) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.2)'
            }}
          >
            <ShieldAlert size={42} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em', color: '#ffffff' }}>
            System Activation Required
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            GourmetOS is cryptographically locked to authorized restaurant hardware.
          </p>
        </div>

        {/* Status Alert Banner */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}
        >
          <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
            <strong>
              {status === 'MACHINE_MISMATCH' && 'Hardware Mismatch (Unauthorized Copy)'}
              {status === 'EXPIRED' && 'Subscription Expired'}
              {status === 'TAMPERED_KEY' && 'Invalid / Tampered License Key'}
              {status === 'NOT_ACTIVATED' && 'Installation Not Activated'}
            </strong>
            <div style={{ marginTop: 4, color: '#e2e8f0', fontSize: 12 }}>
              {message || 'This system cannot operate without a valid license key registered to this computer.'}
            </div>
          </div>
        </div>

        {/* Hardware Machine Fingerprint Box */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
            <Cpu size={16} color="#38bdf8" />
            Your Server Hardware Machine ID:
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '6px 8px 6px 14px',
              gap: 10
            }}
          >
            <code
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {machineId || 'Detecting...'}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: copied ? '#10b981' : '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy ID'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
            Send this Machine ID to your software provider to obtain an official license key.
          </div>
        </div>

        {/* License Input Form */}
        <form onSubmit={handleActivate}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
              <Key size={16} color="#fbbf24" />
              Enter License Activation Key:
            </label>
            <textarea
              rows={3}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your license key here (e.g. GOS-eyJ...)"
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '12px',
                color: '#f8fafc',
                fontSize: 12,
                fontFamily: 'monospace',
                resize: 'none',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontSize: 12,
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 18,
                lineHeight: 1.4
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isActivating || !tokenInput.trim()}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              padding: '14px',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isActivating || !tokenInput.trim() ? 'not-allowed' : 'pointer',
              opacity: isActivating || !tokenInput.trim() ? 0.6 : 1,
              boxShadow: '0 8px 24px rgba(234, 88, 12, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {isActivating ? <RefreshCw size={18} className="animate-spin" /> : <Lock size={18} />}
            {isActivating ? 'Verifying Hardware & Key...' : 'Activate GourmetOS'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#475569' }}>
          GourmetOS Enterprise • Hardware-Enforced Digital Rights Management
        </div>
      </div>
    </div>
  );
};
