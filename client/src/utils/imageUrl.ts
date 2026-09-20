/**
 * Resolves image URLs whether they are:
 * - base64 Data URLs (data:image/...)
 * - absolute HTTP(S) URLs (https://images.unsplash.com/...)
 * - relative uploaded paths (/uploads/...)
 */

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.trim()) return undefined;
  const trimmed = url.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads')) {
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'https://restaurant-system-ipd2.onrender.com/api';
    const serverHost = apiBase.replace(/\/api$/, '');
    return `${serverHost}${trimmed}`;
  }

  return trimmed;
}
