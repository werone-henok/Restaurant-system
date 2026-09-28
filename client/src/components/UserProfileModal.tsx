import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { resolveImageUrl } from '../utils/imageUrl';
import { tactileFeedback } from '../utils/feedback';
import { gToast } from '../utils/toast';
import {
  User,
  Lock,
  Phone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  Key,
  Edit3,
  AlertTriangle,
  X,
  Send,
  Eye,
  EyeOff
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'requestChange' | 'myRequests'>('profile');

  // Request form state
  const [newFullName, setNewFullName] = useState(user?.full_name || '');
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User's past/pending requests
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadMyRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await api.request<any[]>('/auth/my-account-requests');
      setMyRequests(Array.isArray(res) ? res : []);
    } catch (_) {
      setMyRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNewFullName(user?.full_name || '');
      setNewPhone(user?.phone || '');
      setNewPassword('');
      setReason('');
      loadMyRequests();
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameChanged = newFullName.trim() !== user.full_name;
    const phoneChanged = newPhone.trim() !== (user.phone || '');
    const passwordEntered = newPassword.trim().length > 0;

    if (!nameChanged && !phoneChanged && !passwordEntered) {
      gToast.error('ምንም የተቀየረ መረጃ የለም (No changes detected)');
      return;
    }

    if (passwordEntered && newPassword.trim().length < 6) {
      gToast.error('የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት (Password min 6 characters)');
      return;
    }

    tactileFeedback('click');
    setIsSubmitting(true);
    try {
      const res = await api.request<any>('/auth/profile-change-request', {
        method: 'POST',
        body: JSON.stringify({
          new_full_name: nameChanged ? newFullName.trim() : undefined,
          new_phone: phoneChanged ? newPhone.trim() : undefined,
          new_password: passwordEntered ? newPassword.trim() : undefined,
          reason: reason.trim() || undefined
        })
      });

      tactileFeedback('success');
      gToast.success(res.message || 'ጥያቄዎ ለአስተዳዳሪው/ለባለቤቱ ተልኳል!');
      setNewPassword('');
      setReason('');
      setActiveTab('myRequests');
      loadMyRequests();
    } catch (err: any) {
      gToast.error(err.message || 'ጥያቄውን መላክ አልተቻለም');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = myRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          width: '100%',
          maxWidth: 520,
          borderRadius: 24,
          padding: 24,
          boxShadow: 'var(--shadow-floating)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        className="animate-fade-in"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontWeight: 900,
                fontSize: 18,
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {user.profile_photo ? (
                <img src={resolveImageUrl(user.profile_photo)} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.full_name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                {user.full_name}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                @{user.username} • <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{user.role}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 3 Nav Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => {
              tactileFeedback('click');
              setActiveTab('profile');
            }}
            style={{
              padding: '10px 4px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'profile' ? 'var(--primary)' : 'var(--bg-app)',
              color: activeTab === 'profile' ? '#ffffff' : 'var(--text-main)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <User size={14} /> መገለጫ (Profile)
          </button>

          <button
            onClick={() => {
              tactileFeedback('click');
              setActiveTab('requestChange');
            }}
            style={{
              padding: '10px 4px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'requestChange' ? 'var(--primary)' : 'var(--bg-app)',
              color: activeTab === 'requestChange' ? '#ffffff' : 'var(--text-main)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <Edit3 size={14} /> ለውጥ ጠይቅ (Request)
          </button>

          <button
            onClick={() => {
              tactileFeedback('click');
              setActiveTab('myRequests');
              loadMyRequests();
            }}
            style={{
              position: 'relative',
              padding: '10px 4px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'myRequests' ? 'var(--primary)' : 'var(--bg-app)',
              color: activeTab === 'myRequests' ? '#ffffff' : 'var(--text-main)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}
          >
            <Clock size={14} /> ሁኔታ (Status)
            {pendingCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 900,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: PROFILE INFO & SIGN OUT */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--bg-app)', borderRadius: 16, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ሙሉ ስም (Full Name)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{user.full_name}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>የተጠቃሚ ስም (Username)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>@{user.username}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ሚና (Role)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginTop: 2, textTransform: 'uppercase' }}>{user.role}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>የሰራተኛ መለያ (Emp ID)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{user.employee_id || 'N/A'}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ስልክ (Phone)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{user.phone || 'ያልተመዘገበ'}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>ቅርንጫፍ (Branch)</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{user.branch_id || 'Main Branch'}</div>
                </div>
              </div>
            </div>

            {/* Quick Action to Request Change */}
            <button
              onClick={() => {
                tactileFeedback('click');
                setActiveTab('requestChange');
              }}
              style={{
                background: '#fdf2f8',
                color: '#db2777',
                border: '1.5px solid #fbcfe8',
                borderRadius: 14,
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <Key size={16} /> የይለፍ ቃል ወይም መገለጫ ለውጥ ጠይቅ (Request Changes)
            </button>

            {/* Sign Out Button */}
            <button
              onClick={async () => {
                tactileFeedback('click');
                try {
                  await api.request('/auth/logout', { method: 'POST' });
                } catch (_) {}
                onClose();
                logout();
              }}
              className="btn btn-danger btn-block"
              style={{ height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800 }}
            >
              <LogOut size={16} /> ውጣ (Sign Out)
            </button>
          </div>
        )}

        {/* TAB 2: REQUEST PROFILE / PASSWORD CHANGE */}
        {activeTab === 'requestChange' && (
          <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Strict Approval Notice */}
            <div
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                border: '2px solid #fde68a',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start'
              }}
            >
              <ShieldCheck size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.4 }}>
                <strong>ጥብቅ የአስተዳዳሪ ማረጋገጫ (Strict Approval Required):</strong><br />
                ማንኛውም የመገለጫ ወይም የይለፍ ቃል ለውጥ የሚተገበረው <strong>በአስተዳዳሪው (Admin)</strong> ወይም <strong>በባለቤቱ (Owner)</strong> ተመርምሮ ሲፈቀድ ብቻ ነው::
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                ሙሉ ስም (Full Name)
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={e => setNewFullName(e.target.value)}
                placeholder="ሙሉ ስም ያስገቡ"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                ስልክ ቁጥር (Phone Number)
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="0911..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                አዲስ የይለፍ ቃል (New Desired Password - Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="ለመቀየር ካልፈለጉ ባዶ ይተውት / Leave blank if unchanged"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                የለውጡ ምክንያት (Reason for Request)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="ለምሳሌ፡ የይለፍ ቃሌ ስለተረሳ ወይም ስልኬ ስለተቀየረ..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--border)', fontSize: 13 }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)'
              }}
            >
              <Send size={16} />
              {isSubmitting ? 'እየላከ ነው...' : '📩 ጥያቄውን ለአስተዳዳሪ/ባለቤት ላክ (Submit)'}
            </button>
          </form>
        )}

        {/* TAB 3: USER'S REQUEST STATUS TRACKER */}
        {activeTab === 'myRequests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                የተላኩ ጥያቄዎች ሁኔታ (Request Tracking)
              </span>
              <button
                onClick={loadMyRequests}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                አድስ (Refresh)
              </button>
            </div>

            {loadingRequests ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                እየተጫነ ነው...
              </div>
            ) : myRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: 'var(--bg-app)', borderRadius: 16, border: '1.5px dashed var(--border)' }}>
                <Clock size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                  ምንም የተላከ ጥያቄ የለም (No change requests submitted yet)
                </div>
              </div>
            ) : (
              myRequests.map(r => {
                let changes: any = {};
                try {
                  changes = JSON.parse(r.requested_changes);
                } catch (_) {}

                const isPending = r.status === 'PENDING';
                const isApproved = r.status === 'APPROVED';

                return (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--bg-app)',
                      borderRadius: 14,
                      border: isPending ? '2px solid #fde68a' : isApproved ? '2px solid #86efac' : '2px solid #fca5a5',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-main)' }}>
                        {r.request_type === 'FORGOT_PASSWORD'
                          ? '🔐 የይለፍ ቃል መቀየር'
                          : r.request_type === 'PASSWORD_CHANGE'
                          ? '🔑 የይለፍ ቃል ለውጥ'
                          : '👤 የመገለጫ ለውጥ'}
                      </span>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2',
                          color: isPending ? '#b45309' : isApproved ? '#15803d' : '#b91c1c'
                        }}
                      >
                        {isPending ? '⏳ በማረጋገጥ ላይ (Pending)' : isApproved ? '✅ ጸድቋል (Approved)' : '❌ ውድቅ ሆኗል (Rejected)'}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {changes.new_full_name && <div>• አዲስ ስም፡ <strong>{changes.new_full_name}</strong></div>}
                      {changes.new_phone && <div>• አዲስ ስልክ፡ <strong>{changes.new_phone}</strong></div>}
                      {changes.new_password && <div>• አዲስ የይለፍ ቃል ተጠይቋል</div>}
                      {changes.reason && <div>• ምክንያት፡ {changes.reason}</div>}
                    </div>

                    {r.admin_notes && (
                      <div style={{ fontSize: 11, color: isApproved ? '#15803d' : '#b91c1c', background: 'rgba(255,255,255,0.7)', padding: '4px 8px', borderRadius: 6 }}>
                        💬 አስተያየት፡ {r.admin_notes} (በ {r.reviewed_by_name || 'Admin'})
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      🕒 {new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
