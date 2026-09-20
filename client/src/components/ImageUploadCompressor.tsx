import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, Trash2, RefreshCw, Link as LinkIcon, Sparkles } from 'lucide-react';
import { compressImageFile, CompressionResult } from '../utils/imageCompressor';
import { resolveImageUrl } from '../utils/imageUrl';
import { api } from '../api/client';
import { gToast } from '../utils/toast';
import { useApp } from '../context/AppContext';

interface ImageUploadCompressorProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export const ImageUploadCompressor: React.FC<ImageUploadCompressorProps> = ({
  value,
  onChange,
  label
}) => {
  const { language } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<CompressionResult | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      gToast.error(language === 'am' ? 'እባክዎ ትክክለኛ የምስል ፋይል ይምረጡ' : 'Please select a valid image file');
      return;
    }

    setCompressing(true);
    try {
      // 1. Compress image on client side using HTML5 canvas
      const res = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.72,
        format: 'image/jpeg'
      });

      setStats(res);
      setCompressing(false);

      // 2. Attempt to upload compressed file to server
      setUploading(true);
      try {
        const uploadRes = await api.request<{ url: string }>('/upload', {
          method: 'POST',
          body: JSON.stringify({
            dataUrl: res.dataUrl,
            filename: res.fileName
          })
        });
        onChange(uploadRes.url);
        gToast.success(
          language === 'am'
            ? `ምስሉ በተሳካ ሁኔታ ተጨመቀ (${res.originalSizeKb} KB ➔ ${res.compressedSizeKb} KB)`
            : `Image compressed: ${res.originalSizeKb} KB ➔ ${res.compressedSizeKb} KB (${res.compressionRatio}% lighter)`
        );
      } catch (uploadErr) {
        // Fallback to storing lightweight dataUrl directly if server upload endpoint fails or offline
        console.warn('Server upload fallback to dataUrl:', uploadErr);
        onChange(res.dataUrl);
        gToast.success(
          language === 'am'
            ? `ምስሉ ተጨመቀ (${res.compressedSizeKb} KB)`
            : `Image compressed locally (${res.compressedSizeKb} KB)`
        );
      } finally {
        setUploading(false);
      }
    } catch (err: any) {
      console.error(err);
      setCompressing(false);
      setUploading(false);
      gToast.error(language === 'am' ? 'ምስሉን ማጨቅ አልተቻለም' : 'Failed to compress image');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onChange('');
    setStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displaySrc = resolveImageUrl(value);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
          {label || (language === 'am' ? 'የምግብ ፎቶ (ከተንቀሳቃሽ ስልክ ወይም ፋይል)' : 'Dish Photo (Mobile Camera or Upload)')}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 11,
            color: 'var(--primary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <LinkIcon size={12} />
          {showUrlInput
            ? (language === 'am' ? 'ወደ ፎቶ መራጭ ተመለስ' : 'Back to Upload')
            : (language === 'am' ? 'በሊንክ (URL) አስገባ' : 'Use Web URL')}
        </button>
      </div>

      {showUrlInput ? (
        <div>
          <input
            type="url"
            placeholder="https://images.unsplash.com/..."
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%', marginBottom: 6 }}
          />
          {displaySrc && (
            <div style={{ width: '100%', height: 110, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4 }}>
              <img src={displaySrc} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {!value ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: isDragOver ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                background: isDragOver ? 'var(--primary-light, #fff7ed)' : 'var(--bg-subtle, #f9fafb)',
                borderRadius: 14,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {compressing || uploading ? (
                  <RefreshCw size={22} className="animate-spin" />
                ) : (
                  <Camera size={22} />
                )}
              </div>

              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                  {compressing
                    ? (language === 'am' ? '⚡ ፎቶው እየተጨመቀ ነው...' : '⚡ Compressing image...')
                    : uploading
                    ? (language === 'am' ? 'ወደ ሲስተም እየተላከ ነው...' : 'Uploading compressed photo...')
                    : (language === 'am' ? 'ፎቶ አንሳ ወይም ከስልክ ምረጥ' : 'Tap to take photo or choose file')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                  {language === 'am' ? 'ስልኩ ፎቶውን በራስ-ሰር አጨብቆ ቀላል ያደርገዋል (~40KB)' : 'Auto-compresses high-res camera photos to ~40KB'}
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 12,
                background: '#ffffff',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    flexShrink: 0,
                    border: '1px solid var(--border)'
                  }}
                >
                  <img
                    src={displaySrc}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: '#ecfdf5',
                        color: '#065f46',
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Sparkles size={11} />
                      {language === 'am' ? 'ቀላልና የተጨመቀ ፎቶ' : 'Lite & Compressed'}
                    </span>
                  </div>

                  {stats && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      {stats.originalSizeKb} KB ➔ <strong>{stats.compressedSizeKb} KB</strong> ({stats.compressionRatio}% {language === 'am' ? 'ቅናሽ' : 'lighter'})
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                    >
                      <RefreshCw size={12} /> {language === 'am' ? 'ቀይር' : 'Change'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#ef4444',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Trash2 size={12} /> {language === 'am' ? 'አስወግድ' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
