import QRCode from 'qrcode';

/**
 * Generates a Data URL (image/png) for a given text/URL.
 */
export async function generateQrDataUrl(
  text: string, 
  options?: { width?: number; margin?: number; color?: { dark?: string; light?: string } }
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 256,
      margin: options?.margin !== undefined ? options?.margin : 1,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('[QRCode] Failed to generate data URL:', err);
    return '';
  }
}

/**
 * Generates an SVG string for a given text/URL.
 */
export async function generateQrSvg(
  text: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width: options?.width || 256,
      margin: options?.margin !== undefined ? options?.margin : 1,
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('[QRCode] Failed to generate SVG:', err);
    return '';
  }
}

/**
 * Builds the canonical public customer feedback URL for a branch and optional table.
 */
export function buildFeedbackUrl(branchId: string, tableNumber?: string): string {
  const origin = window.location.origin;
  const params = new URLSearchParams();
  params.set('feedback', '1');
  if (branchId) params.set('branch', branchId);
  if (tableNumber) params.set('table', tableNumber);
  return `${origin}/?${params.toString()}`;
}
