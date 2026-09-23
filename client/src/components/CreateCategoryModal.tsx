import React, { useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { gToast } from '../utils/toast';
import { Tag, Plus, X, Sparkles, FolderPlus } from 'lucide-react';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: (category: any) => void;
}

const EMOJI_PRESETS = [
  '🍔', '🍕', '🍝', '☕', '🥤', '🥗', 
  '🥩', '🍲', '🥪', '🍳', '🍰', '🍹', 
  '🍺', '🍞', '🍨', '🥟', '🍣', '🌮'
];

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated
}) => {
  const { t, language } = useApp();
  const [name, setName] = useState('');
  const [nameAmharic, setNameAmharic] = useState('');
  const [icon, setIcon] = useState('🍔');
  const [sortOrder, setSortOrder] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      gToast.error(language === 'am' ? 'እባክዎ የምድብ ስም ያስገቡ' : 'Please enter a category name');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(),
        name_amharic: nameAmharic.trim() || null,
        icon: icon.trim() || 'Utensils'
      };
      if (sortOrder !== '') {
        payload.sort_order = Number(sortOrder);
      }

      const created = await api.request<any>('/menu/categories', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      gToast.success(
        language === 'am'
          ? `ምድብ "${created.name_amharic || created.name}" በተሳካ ሁኔታ ተፈጥሯል!`
          : `Category "${created.name}" created successfully!`
      );

      onCategoryCreated(created);
      onClose();
      // Reset form
      setName('');
      setNameAmharic('');
      setIcon('🍔');
      setSortOrder('');
    } catch (err: any) {
      gToast.error(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(3px)',
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
          borderRadius: 18,
          padding: 22,
          width: '100%',
          maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {language === 'am' ? 'አዲስ የምግብ ምድብ ፍጠር' : 'Create Menu Category'}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {language === 'am' ? 'ምግቦችን በቡድን ለመመደብ' : 'Group and organize dishes'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderRadius: 8
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Pill */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px dashed var(--border)'
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
            {language === 'am' ? 'ቅድመ ዕይታ (Preview):' : 'Live Preview:'}
          </span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 20,
            background: 'var(--primary)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 13,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span>{name || (language === 'am' ? 'የምድብ ስም' : 'Category Name')}</span>
            {nameAmharic && <span style={{ opacity: 0.85, fontSize: 11 }}>({nameAmharic})</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* English Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'የምድቡ ስም (እንግሊዝኛ) *' : 'Category Name (English) *'}
            </label>
            <input
              type="text"
              required
              placeholder={language === 'am' ? 'ምሳሌ፡ Breakfast, Traditional, Pastas' : 'e.g. Breakfast, Pastas, Combos'}
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          {/* Amharic Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'የምድቡ ስም (አማርኛ - አማራጭ)' : 'Category Name (Amharic - Optional)'}
            </label>
            <input
              type="text"
              placeholder={language === 'am' ? 'ምሳሌ፡ ቁርስ፣ ባህላዊ ምግቦች፣ ፓስታ' : 'e.g. ቁርስ, ፓስታ, ጣፋጭ'}
              value={nameAmharic}
              onChange={e => setNameAmharic(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Icon / Emoji Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'ምልክት ወይም ኢሞጂ (Icon / Emoji)' : 'Category Emoji / Icon'}
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: icon === emoji ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: icon === emoji ? 'var(--primary-light)' : 'var(--bg-subtle)',
                    fontSize: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s ease'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type custom emoji or icon name (e.g. 🍷, Soup, Salad)"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>

          {/* Optional Sort Order */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              {language === 'am' ? 'ቅደም ተከተል (Sort Order - አማራጭ)' : 'Display Sort Order (Optional)'}
            </label>
            <input
              type="number"
              min="0"
              placeholder={language === 'am' ? 'በራስ-ሰር መጨረሻ ላይ ይቀመጣል' : 'Defaults to end of menu'}
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{ flex: 1, height: 44, fontWeight: 700 }}
            >
              {language === 'am' ? 'ሰርዝ' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 2, height: 44, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {loading ? (
                <span>{language === 'am' ? 'በመፍጠር ላይ...' : 'Creating...'}</span>
              ) : (
                <>
                  <Plus size={16} />
                  <span>{language === 'am' ? 'ምድቡን ፍጠር' : 'Create Category'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
