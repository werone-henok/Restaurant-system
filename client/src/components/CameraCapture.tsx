import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface CameraCaptureProps {
  label: string;
  photoUrl: string | null;
  onPhotoCaptured: (base64: string) => void;
  onPhotoCleared: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  label,
  photoUrl,
  onPhotoCaptured,
  onPhotoCleared
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Automatically compress image onto an HTML5 canvas before outputting
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          onPhotoCaptured(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>

      {photoUrl ? (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={photoUrl} alt="Captured preview" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
          <button
            type="button"
            onClick={onPhotoCleared}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.6)',
              color: '#ffffff',
              borderRadius: '50%',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--bg-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}
        >
          <div style={{ background: '#ffffff', padding: 12, borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--primary)' }}>
            <Camera size={24} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
            Tap to open camera or upload photo
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Automatic mobile camera capture with compression
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};
