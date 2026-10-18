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
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
    e.target.value = '';
  };

  const triggerGalleryPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const triggerCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
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
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const displaySrc = resolveImageUrl(value);

  return (
    <div style={{ marginBottom: 14, width: '100%', boxSizing: 'border-box' }}>
      {/* Hidden File Inputs: Gallery & Camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flex: '1 1 180px', minWidth: 0, wordBreak: 'break-word' }}>
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
            gap: 4,
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <LinkIcon size={12} />
          {showUrlInput
            ? (language === 'am' ? 'ወደ ፎቶ መራጭ ተመለስ' : 'Back to Upload')
            : (language === 'am' ? 'በሊንክ (URL) አስገባ' : 'Use Web URL')}
        </button>
      </div>

      {showUrlInput ? (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          <input
            type="url"
            placeholder="https://images.unsplash.com/..."
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
          />
          {displaySrc && (
            <div style={{ width: '100%', height: 110, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4 }}>
              <img src={displaySrc} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      ) : (
        <div>
          {!value ? (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: isDragOver ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                background: isDragOver ? 'var(--primary-light, #fff7ed)' : 'var(--bg-subtle, #f9fafb)',
                borderRadius: 14,
                padding: '18px 16px',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border)'
                }}
              >
                {compressing || uploading ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <Camera size={20} />
                )}
              </div>

              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'block' }}>
                  {compressing
                    ? (language === 'am' ? '⚡ ፎቶው እየተጨመቀ ነው...' : '⚡ Compressing image...')
                    : uploading
                    ? (language === 'am' ? 'ወደ ሲስተም እየተላከ ነው...' : 'Uploading compressed photo...')
                    : (language === 'am' ? 'ምስል ይምረጡ ወይም ፎቶ ያንሱ' : 'Select an image or take a photo')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                  {language === 'am' ? 'ስልኩ ፎቶውን በራስ-ሰር አጨብቆ ፈጣን ያደርገዋል (~40KB)' : 'Auto-compresses high-res camera photos to ~40KB'}
                </span>
              </div>

              {/* Action Buttons for Mobile & Desktop */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={triggerGalleryPicker}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Upload size={14} />
                  <span>{language === 'am' ? 'ከስልክ/ፋይል ምረጥ' : 'Choose File / Gallery'}</span>
                </button>

                <button
                  type="button"
                  onClick={triggerCamera}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Camera size={14} />
                  <span>{language === 'am' ? 'ካሜራ አንሳ' : 'Take Photo'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 12,
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--bg-subtle)',
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

                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
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
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, wordBreak: 'break-word' }}>
                      {stats.originalSizeKb} KB ➔ <strong>{stats.compressedSizeKb} KB</strong> ({stats.compressionRatio}% {language === 'am' ? 'ቅናሽ' : 'lighter'})
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={triggerGalleryPicker}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title={language === 'am' ? 'ከስልክ ወይም ከፋይል ቀይር' : 'Change from files / gallery'}
                    >
                      <Upload size={12} /> {language === 'am' ? 'ከፋይል' : 'Change'}
                    </button>
                    <button
                      type="button"
                      onClick={triggerCamera}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title={language === 'am' ? 'በካሜራ አዲስ ፎቶ አንሳ' : 'Take new camera photo'}
                    >
                      <Camera size={12} /> {language === 'am' ? 'ካሜራ' : 'Camera'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#ef4444',
                        background: 'var(--danger-light, #fef2f2)',
                        border: '1px solid #fee2e2',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap'
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
