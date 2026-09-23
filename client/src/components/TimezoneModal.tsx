import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, Globe, Check, Sparkles } from 'lucide-react';
import { TIMEZONE_OPTIONS } from '../utils/timezone';

interface TimezoneModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TimezoneModal: React.FC<TimezoneModalProps> = ({ isOpen, onClose }) => {
  const { 
    timezoneMode, setTimezoneMode, 
    selectedTimezone, setSelectedTimezone, 
    detectedTimezone, activeTimezone,
    language 
  } = useApp();

  const [mode, setMode] = useState<'auto' | 'manual'>(timezoneMode);
  const [selectedTz, setSelectedTz] = useState<string>(selectedTimezone);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setMode(timezoneMode);
      setSelectedTz(selectedTimezone);
    }
  }, [isOpen, timezoneMode, selectedTimezone]);

  // Live clock tick
  useEffect(() => {
    if (!isOpen) return;
    const updateTime = () => {
      try {
        const activeTz = mode === 'auto' ? detectedTimezone : selectedTz;
        const now = new Date();
        const formatted = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
          timeZone: activeTz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(now);
        setCurrentTimeStr(formatted);
      } catch (_) {
        setCurrentTimeStr(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isOpen, mode, selectedTz, detectedTimezone, language]);

  if (!isOpen) return null;

  const handleApply = () => {
    setTimezoneMode(mode);
    if (mode === 'manual') {
      const match = TIMEZONE_OPTIONS.find(o => o.value === selectedTz);
      setSelectedTimezone(selectedTz, match?.offsetMinutes);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 100
    }}>
      <div 
        className="animate-fade-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 420,
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-main)' }}>
            <Clock size={18} color="var(--primary)" />
            {language === 'am' ? 'የሰዓት ሰቅ ምርጫ (Timezone)' : 'Timezone & Clock Adjustment'}
          </h3>
          <button 
            onClick={onClose}
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Live Clock Display */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(14, 165, 233, 0.08))',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 14,
          textAlign: 'center',
          marginBottom: 16
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
            {mode === 'auto' 
              ? (language === 'am' ? 'የመሳሪያዎ ሰዓት (Auto Detected)' : 'Device Local Time (Auto)') 
              : (language === 'am' ? 'የተመረጠው ሰዓት (Custom Timezone)' : 'Custom Selected Timezone')}
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', letterSpacing: 1 }}>
            {currentTimeStr || '--:--:--'}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {mode === 'auto' ? detectedTimezone : selectedTz}
          </span>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setMode('auto')}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              background: mode === 'auto' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: mode === 'auto' ? '#ffffff' : 'var(--text-main)',
              border: mode === 'auto' ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Sparkles size={14} />
            {language === 'am' ? 'ራስ-ሰር (Auto)' : 'Automatic'}
          </button>

          <button
            type="button"
            onClick={() => setMode('manual')}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              background: mode === 'manual' ? 'var(--primary)' : 'var(--bg-subtle)',
              color: mode === 'manual' ? '#ffffff' : 'var(--text-main)',
              border: mode === 'manual' ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <Globe size={14} />
            {language === 'am' ? 'በእጅ ምረጥ (Manual)' : 'Manual'}
          </button>
        </div>

        {/* Details based on mode */}
        {mode === 'auto' ? (
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: 10,
            padding: 12,
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 16
          }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {language === 'am'
                ? `⚡ ሰዓቱ ከመሣሪያዎ (ስልክ/ኮምፒውተር) በቀጥታ ይወሰዳል: ${detectedTimezone}`
                : `⚡ Timezone is automatically detected from your browser/device: ${detectedTimezone}`}
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              {language === 'am' ? 'የሰዓት ሰቅ ይምረጡ' : 'Select Timezone'}
            </label>
            <select
              value={selectedTz}
              onChange={e => setSelectedTz(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)'
              }}
            >
              {TIMEZONE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {language === 'am' ? opt.labelAm : opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flex: 1, height: 42 }}
          >
            {language === 'am' ? 'ይቅር' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn btn-primary"
            style={{ flex: 2, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Check size={16} />
            {language === 'am' ? 'ተግብር' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
