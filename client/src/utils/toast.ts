/**
 * GourmetOS Toast Helper
 * Thin wrapper around sonner that adds consistent icons and default messages.
 *
 * Usage:
 *   import { gToast } from '@/utils/toast';
 *   gToast.success('Order confirmed!');
 *   gToast.error('Failed to load orders', err);
 *   gToast.loading('Syncing...');
 *   gToast.promise(apiCall(), { loading: 'Saving...', success: 'Saved!', error: 'Failed' });
 */
import { toast } from 'sonner';

export const gToast = {
  success: (message: string, description?: string) =>
    toast.success(message, { description }),

  error: (message: string, err?: unknown) => {
    const description = err instanceof Error ? err.message : typeof err === 'string' ? err : undefined;
    toast.error(message, { description });
  },

  warning: (message: string, description?: string) =>
    toast.warning(message, { description }),

  info: (message: string, description?: string) =>
    toast.info(message, { description }),

  loading: (message: string) =>
    toast.loading(message),

  dismiss: (id?: string | number) =>
    toast.dismiss(id),

  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) =>
    toast.promise(promise, messages),
};

// Re-export raw sonner toast for advanced use cases
export { toast };
