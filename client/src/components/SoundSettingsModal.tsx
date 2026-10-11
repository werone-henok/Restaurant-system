import React, { useState } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  SOUND_PROFILES,
  SoundSettings,
  SoundProfileId,
  getSoundSettings,
  saveSoundSettings,
  triggerNotificationSound
} from '../utils/soundNotifier';
import { Volume2, VolumeX, Play, Check, X, Bell, Vibrate, Sparkles, Sliders } from 'lucide-react';
import { gToast } from '../utils/toast';

interface SoundSettingsModalProps {
  role: 'chef' | 'waiter';
  isOpen: boolean;
  onClose: () => void;
  language?: 'en' | 'am';
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  role,
  isOpen,
  onClose,
  language = 'en'
}) => {
  const [settings, setSettings] = useState<SoundSettings>(() => getSoundSettings(role));
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  if (!isOpen) return null;

  const isAmharic = language === 'am';

  const handlePreview = async (profileId?: SoundProfileId) => {
    setIsPlayingPreview(true);
    try {
      await triggerNotificationSound(role, {
        ...settings,
        profile: profileId || settings.profile,
        repeatCount: profileId ? 1 : settings.repeatCount
      });
    } finally {
      setIsPlayingPreview(false);
    }
  };

  const handleSave = () => {
    saveSoundSettings(role, settings);
    gToast.success(
      isAmharic 
        ? 'የድምፅ ማስተካከያ በተሳካ ሁኔታ ተቀምጧል!' 
        : 'Sound settings saved successfully!'
    );
    onClose();
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.68)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: 14,
          boxSizing: 'border-box'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 22,
            width: '100%',
            maxWidth: 520,
            maxHeight: 'min(92vh, calc(100dvh - 28px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1.5px solid var(--border, #e2e8f0)',
            boxSizing: 'border-box'
          }}
          className="animate-fade-in"
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Sliders size={22} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
                  {isAmharic ? 'የድምፅ ማሳወቂያ ማስተካከያ' : 'Order Sound Notification Settings'}
                </h3>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, fontWeight: 600 }}>
                  {role === 'chef'
                    ? (isAmharic ? '👨‍🍳 ለኩሽና ሼፎች (Kitchen Orders)' : '👨‍🍳 For Kitchen Chefs (Incoming Tickets)')
                    : (isAmharic ? '🤵 ለአስተናጋጆች (Ready Orders)' : '🤵 For Waiters (Ready for Pickup)')
                  }
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: settings.enabled ? '#eff6ff' : 'var(--bg-app, #f8fafc)',
                border: `1.5px solid ${settings.enabled ? '#93c5fd' : 'var(--border, #e2e8f0)'}`,
                borderRadius: 14
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {settings.enabled ? <Volume2 size={22} color="#2563eb" /> : <VolumeX size={22} color="#94a3b8" />}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                    {isAmharic ? 'የድምፅ ማሳወቂያ ይብራ' : 'Sound Alerts Enabled'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                    {isAmharic 
                      ? 'ከመሳሪያው ርቀው ሲሆኑ አዳዲስ ትዕዛዞችን በድምፅ ያሳውቃል' 
                      : 'Alerts you out loud when away from this device'}
                  </div>
                </div>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: settings.enabled ? '#2563eb' : '#cbd5e1',
                    borderRadius: 34,
                    transition: '0.2s'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: 20,
                      width: 20,
                      left: settings.enabled ? 24 : 3,
                      bottom: 3,
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            {/* Sound Profile Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
                  {isAmharic ? 'የድምፅ አይነት ይምረጡ (Sound Type)' : 'Select Sound Profile'}
                </label>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>
                  {role === 'chef' ? '⭐ Loud Buzzer Recommended' : '⭐ Marimba Recommended'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SOUND_PROFILES.map((p) => {
                  const isSelected = settings.profile === p.id;
                  const isRecommended = p.recommendedFor === role || p.recommendedFor === 'both';

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSettings({ ...settings, profile: p.id })}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 14,
                        border: isSelected ? '2px solid #ea580c' : '1.5px solid var(--border, #e2e8f0)',
                        background: isSelected ? 'rgba(234, 88, 12, 0.06)' : 'var(--bg-app, #f8fafc)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 24 }}>{p.icon}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 900, color: isSelected ? '#ea580c' : 'var(--text-main, #0f172a)' }}>
                              {isAmharic ? p.nameAm : p.nameEn}
                            </span>
                            {isRecommended && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  background: '#fed7aa',
                                  color: '#c2410c',
                                  padding: '2px 6px',
                                  borderRadius: 6
                                }}
                              >
                                {isAmharic ? 'ምርጥ ምርጫ' : 'Recommended'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isAmharic ? p.descriptionAm : p.descriptionEn}
                          </div>
                        </div>
                      </div>

                      {/* Instant Preview Play Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettings({ ...settings, profile: p.id });
                          handlePreview(p.id);
                        }}
                        title={isAmharic ? 'ድምፁን ይሞክሩ' : 'Test Sound'}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          border: 'none',
                          background: isSelected ? '#ea580c' : 'var(--bg-card, #ffffff)',
                          color: isSelected ? '#ffffff' : 'var(--text-main, #0f172a)',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          marginLeft: 10,
                          flexShrink: 0
                        }}
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Volume Adjustment */}
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--bg-app, #f8fafc)',
                border: '1.5px solid var(--border, #e2e8f0)',
                borderRadius: 14
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  {isAmharic ? 'የድምፅ መጠን (Volume Level)' : 'Volume Level'}
                </label>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#ea580c',
                    background: '#ffedd5',
                    padding: '2px 8px',
                    borderRadius: 8
                  }}
                >
                  {settings.volume}%
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={settings.volume}
                onChange={(e) => setSettings({ ...settings, volume: parseInt(e.target.value) })}
                style={{
                  width: '100%',
                  accentColor: '#ea580c',
                  cursor: 'pointer',
                  height: 6
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 4 }}>
                <span>10% {isAmharic ? 'ዝቅተኛ' : 'Quiet'}</span>
                <span>50% {isAmharic ? 'መካከለኛ' : 'Medium'}</span>
                <span>100% {isAmharic ? 'ከፍተኛ (ለኩሽና)' : 'Maximum (Kitchen)'}</span>
              </div>
            </div>

            {/* Repeat Count (Crucial when away from device) */}
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--bg-app, #f8fafc)',
                border: '1.5px solid var(--border, #e2e8f0)',
                borderRadius: 14
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                    {isAmharic ? 'ድምፁ ስንት ጊዜ ይደገም? (Repeat Count)' : 'Alert Repetition (When Away)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                    {isAmharic 
                      ? 'ሼፉ ወይም አስተናጋጁ ርቀው ቢሆኑም በግልጽ እንዲሰሙ ድምፁ ተደጋግሞ ይጠራል' 
                      : 'Repeats the alert so staff walking away never miss incoming orders'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                {[
                  { count: 1, labelEn: '1x (Single)', labelAm: '1x (አንድ ጊዜ)' },
                  { count: 2, labelEn: '2x (Recommended)', labelAm: '2x (የሚመከር)' },
                  { count: 3, labelEn: '3x (Urgent / Loud)', labelAm: '3x (ከፍተኛ ድግግሞሽ)' }
                ].map((rep) => {
                  const isCur = settings.repeatCount === rep.count;
                  return (
                    <button
                      key={rep.count}
                      type="button"
                      onClick={() => setSettings({ ...settings, repeatCount: rep.count })}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: isCur ? '2px solid #ea580c' : '1.5px solid var(--border, #e2e8f0)',
                        background: isCur ? '#ea580c' : 'var(--bg-card, #ffffff)',
                        color: isCur ? '#ffffff' : 'var(--text-main, #0f172a)',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isAmharic ? rep.labelAm : rep.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Vibration Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg-app, #f8fafc)',
                border: '1.5px solid var(--border, #e2e8f0)',
                borderRadius: 14,
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={settings.vibrate}
                onChange={(e) => setSettings({ ...settings, vibrate: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#ea580c', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Vibrate size={18} color="#ea580c" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                    {isAmharic ? 'የስልክ ንዝረት (Mobile Haptic Vibration)' : 'Mobile Vibration on New Order'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                    {isAmharic ? 'በሞባይል ወይም ታብሌት ሲጠቀሙ ይርገበገባል' : 'Vibrates staff phone/tablet in pocket'}
                  </div>
                </div>
              </div>
            </label>

          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)',
              display: 'flex',
              gap: 10,
              flexShrink: 0
            }}
          >
            <button
              type="button"
              disabled={isPlayingPreview}
              onClick={() => handlePreview()}
              style={{
                flex: 1,
                padding: '12px 14px',
                borderRadius: 14,
                border: '2px solid #ea580c',
                background: 'transparent',
                color: '#ea580c',
                fontSize: 13,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <Play size={16} fill="currentColor" />
              {isPlayingPreview 
                ? (isAmharic ? 'እየጮኸ ነው...' : 'Playing...') 
                : (isAmharic ? 'ሙሉ ድምፁን ሞክር' : 'Test Full Alert')
              }
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 1.5,
                padding: '12px 18px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)'
              }}
            >
              <Check size={18} />
              {isAmharic ? 'አስቀምጥ (Save Settings)' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
