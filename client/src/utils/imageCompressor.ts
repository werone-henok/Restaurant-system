/**
 * Client-Side Image Compression Utility
 * Resizes raw smartphone / high-res photos to max 800px and compresses
 * to lightweight JPEG/WebP (~30KB-70KB) using offscreen HTML5 Canvas.
 */

export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  compressionRatio: number; // e.g. 95 (for 95% reduction)
  width: number;
  height: number;
  fileName: string;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/webp';
}

export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.72,
    format = 'image/jpeg'
  } = options;

  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read selected image file'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image for compression'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio-preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize canvas context'));
          return;
        }

        // Fill white background for transparent PNG conversion to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Smooth image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw downscaled image
        ctx.drawImage(img, 0, 0, width, height);

        // Export compressed image
        const dataUrl = canvas.toDataURL(format, quality);

        // Calculate compressed size from base64 string
        // base64 length * 3/4 = approx binary byte length
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const compressedByteLength = Math.round((base64Length * 3) / 4);
        const compressedSizeKb = Math.round(compressedByteLength / 1024);

        const reduction = Math.max(
          0,
          Math.round(((originalSizeKb - compressedSizeKb) / Math.max(originalSizeKb, 1)) * 100)
        );

        resolve({
          dataUrl,
          originalSizeKb,
          compressedSizeKb,
          compressionRatio: reduction,
          width,
          height,
          fileName: file.name.replace(/\.[^/.]+$/, '') + '.jpg'
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
