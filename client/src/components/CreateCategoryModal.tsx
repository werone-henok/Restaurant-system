import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { gToast } from '../utils/toast';
import { Tag, Plus, X, Sparkles, FolderPlus, Edit2, Trash2, AlertTriangle, Check } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: any | null; // If provided, modal is in EDIT/UPDATE mode!
  itemCount?: number;
  onCategoryCreated?: (category: any) => void;
  onCategorySaved?: (category: any) => void;
  onCategoryDeleted?: (categoryId: string) => void;
}

const EMOJI_PRESETS = [
  '🍔', '🍕', '🍝', '☕', '🥤', '🧃', 
  '🥩', '🍲', '🥪', '🍳', '🍰', '🍹', 
  '🍺', '🐟', '🥗', '🍜', '🥟', '🍣', 
  '🌮', '🍨', '🍿', '🥐', '🍗', '🍛'
];

export const CreateCategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  category,
  itemCount = 0,
  onCategoryCreated,
  onCategorySaved,
  onCategoryDeleted
}) => {
  const { language } = useApp();
  const isEdit = Boolean(category?.id);

  const [name, setName] = useState('');
  const [nameAmharic, setNameAmharic] = useState('');
  const [icon, setIcon] = useState('🍔');
  const [sortOrder, setSortOrder] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setNameAmharic(category.name_amharic || '');
      setIcon(category.icon || '🍔');
      setSortOrder(category.sort_order ?? '');
    } else {
      setName('');
      setNameAmharic('');
      setIcon('🍔');
      setSortOrder('');
    }
  }, [category, isOpen]);

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

      let result: any;
      if (isEdit && category?.id) {
        result = await api.request<any>(`/menu/categories/${category.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        gToast.success(
          language === 'am'
            ? `ምድብ "${result.name_amharic || result.name}" በተሳካ ሁኔታ ተስተካክሏል!`
            : `Category "${result.name}" updated successfully!`
        );
      } else {
        result = await api.request<any>('/menu/categories', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        gToast.success(
          language === 'am'
            ? `ምድብ "${result.name_amharic || result.name}" በተሳካ ሁኔታ ተፈጥሯል!`
            : `Category "${result.name}" created successfully!`
        );
      }

      if (onCategorySaved) onCategorySaved(result);
      if (onCategoryCreated) onCategoryCreated(result);
      onClose();
    } catch (err: any) {
      gToast.error(err.message || (isEdit ? 'Failed to update category' : 'Failed to create category'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!category?.id) return;
    const catDisplayName = language === 'am' ? (category.name_amharic || category.name) : category.name;
    const count = itemCount || 0;

    let confirmMsg = language === 'am'
      ? `እርግጠኛ ነዎት "${catDisplayName}" የተባለውን ምድብ መሰረዝ ይፈልጋሉ?`
      : `Are you sure you want to delete category "${catDisplayName}"?`;

    let cascade = false;
    if (count > 0) {
      confirmMsg = language === 'am'
        ? `⚠️ ማስጠንቀቂያ፡ "${catDisplayName}" ምድብ ውስጥ ${count} ምግቦች ይገኛሉ!\n\nምድቡንና በውስጡ ያሉትን ${count} ምግቦች በሙሉ መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።`
        : `⚠️ Warning: Category "${catDisplayName}" contains ${count} menu items!\n\nDo you want to permanently delete this category AND all its ${count} items? This action cannot be undone.`;
      cascade = true;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDeleting(true);
      await api.request(`/menu/categories/${category.id}${cascade ? '?cascade=true' : ''}`, {
        method: 'DELETE'
      });
      gToast.success(
        language === 'am'
          ? `ምድብ "${catDisplayName}" በተሳካ ሁኔታ ተሰርዟል!`
          : `Category "${catDisplayName}" deleted successfully!`
      );
      if (onCategoryDeleted) {
        onCategoryDeleted(category.id);
      }
      onClose();
    } catch (err: any) {
      gToast.error(err.message || 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalPortal>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        boxSizing: 'border-box',
        zIndex: 100000
      }}>
        <div
          className="animate-fade-in"
          style={{
            background: 'var(--bg-card)',
            borderRadius: 20,
            width: '100%',
            maxWidth: 480,
            maxHeight: 'min(92vh, calc(100dvh - 24px))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-floating, 0 20px 40px rgba(0,0,0,0.3))',
            border: '1px solid var(--border)'
          }}
        >
          {/* Sticky Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-card)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isEdit ? 'rgba(59, 130, 246, 0.12)' : 'var(--primary-light)',
                color: isEdit ? '#3b82f6' : 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isEdit ? <Edit2 size={18} /> : <FolderPlus size={18} />}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {isEdit
                    ? (language === 'am' ? 'የምግብ ምድብ አስተካክል / አዘምን' : 'Edit Menu Category')
                    : (language === 'am' ? 'አዲስ የምግብ ምድብ ፍጠር' : 'Create Menu Category')}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {isEdit
                    ? (language === 'am' ? `ስም፣ ምልክት እና ቅደም ተከተል ይቀይሩ (${itemCount} ምግቦች አሉት)` : `Update name, emoji & sort order (${itemCount} items)`)
                    : (language === 'am' ? 'ምግቦችን በቡድን ለመመደብ' : 'Group and organize dishes')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isDeleting}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--bg-subtle, #f1f5f9)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                cursor: 'pointer',
                padding: 0
              }}
              title={language === 'am' ? 'ዝጋ' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0 }}>
            {/* Scrollable Form Body */}
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Live Preview Pill */}
              <div style={{
                background: 'var(--bg-subtle)',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px dashed var(--border)'
              }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', display: 'block' }}>
                    {language === 'am' ? 'ቅድመ ዕይታ (Live Preview):' : 'Live Preview:'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {language === 'am' ? 'በአስተናጋጅና ካሳ ማያ ገጽ ላይ የሚታይበት ሁኔታ' : 'How waiters & cashiers see this tab'}
                  </span>
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 14px',
                  borderRadius: 20,
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span>{name || (language === 'am' ? 'የምድብ ስም' : 'Category Name')}</span>
                  {nameAmharic && <span style={{ opacity: 0.85, fontSize: 11 }}>({nameAmharic})</span>}
                  {itemCount > 0 && (
                    <span style={{
                      fontSize: 10,
                      background: 'rgba(255,255,255,0.25)',
                      padding: '1px 6px',
                      borderRadius: 10
                    }}>
                      {itemCount}
                    </span>
                  )}
                </div>
              </div>

              {/* English Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የምድቡ ስም (እንግሊዝኛ) *' : 'Category Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'am' ? 'ምሳሌ፡ Burgers, Pizza, Hot Drinks' : 'e.g. Burgers, Pizza, Hot Drinks'}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                  autoFocus={!isEdit}
                />
              </div>

              {/* Amharic Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'የምድቡ ስም (አማርኛ) *' : 'Category Name (Amharic) *'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'am' ? 'ምሳሌ፡ በርገር፣ ፒዛ፣ ትኩስ መጠጦች' : 'e.g. በርገር, ፒዛ, ትኩስ መጠጦች'}
                  value={nameAmharic}
                  onChange={e => setNameAmharic(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              {/* Icon / Emoji Selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                  {language === 'am' ? 'ምልክት ወይም ኢሞጂ (Icon / Emoji)' : 'Category Emoji / Icon'}
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, maxHeight: 110, overflowY: 'auto' }}>
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setIcon(emoji)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: icon === emoji ? '2px solid var(--primary)' : '1px solid var(--border)',
                        background: icon === emoji ? 'var(--primary-light)' : 'var(--bg-subtle)',
                        fontSize: 18,
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
                  placeholder="Or paste any custom emoji or icon (e.g. 🍷, 🥣, 🍧)"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              {/* Optional Sort Order */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 4 }}>
                  {language === 'am' ? 'ቅደም ተከተል (Sort Order)' : 'Display Sort Order (1, 2, 3...)'}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={language === 'am' ? 'ምሳሌ፡ 1, 2, 3...' : 'e.g. 1, 2, 3 (lower numbers appear first)'}
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Pinned Sticky Footer with Delete & Save */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-card)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexShrink: 0
            }}>
              {isEdit ? (
                <>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading || isDeleting}
                    style={{
                      height: 42,
                      padding: '0 14px',
                      borderRadius: 8,
                      border: '1px solid #fee2e2',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                    title={language === 'am' ? 'ይህንን ምድብ ሰርዝ' : 'Delete this category'}
                  >
                    <Trash2 size={15} />
                    <span>{isDeleting ? (language === 'am' ? 'በመሰረዝ ላይ...' : 'Deleting...') : (language === 'am' ? 'ምድቡን ሰርዝ' : 'Delete')}</span>
                  </button>

                  <div style={{ flex: 1 }} />

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading || isDeleting}
                    className="btn btn-secondary"
                    style={{ height: 42, padding: '0 16px', fontWeight: 700, fontSize: 12 }}
                  >
                    {language === 'am' ? 'ተመለስ' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    disabled={loading || isDeleting}
                    className="btn btn-primary"
                    style={{
                      height: 42,
                      padding: '0 18px',
                      fontWeight: 800,
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {loading ? (
                      <span>{language === 'am' ? 'በማስቀመጥ ላይ...' : 'Saving...'}</span>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>{language === 'am' ? 'ለውጦችን መዝግብ' : 'Save Changes'}</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
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
                    style={{
                      flex: 2,
                      height: 44,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
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
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export const CategoryModal = CreateCategoryModal;
