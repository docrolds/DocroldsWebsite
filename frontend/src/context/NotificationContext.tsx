import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { API_URL } from '../config';

// ============================================
// Type Definitions
// ============================================

/** Notification types for stored notifications */
export const NOTIFICATION_TYPES = {
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  DOWNLOAD_READY: 'DOWNLOAD_READY',
  DOWNLOAD_EXPIRING: 'DOWNLOAD_EXPIRING',
  WELCOME: 'WELCOME',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/** Toast variants */
export const TOAST_VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
} as const;

export type ToastVariant = (typeof TOAST_VARIANTS)[keyof typeof TOAST_VARIANTS];

/** Persistent notification from the database */
export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  customerId: string;
  data?: { actionUrl?: string; [key: string]: unknown };
}

/** Reads the target URL from a notification's data payload, if any. */
export function getNotificationActionUrl(notification: Notification): string | undefined {
  return notification.data?.actionUrl;
}

/** Toast notification for transient UI feedback */
export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration: number;
  action: (() => void) | null;
  actionLabel: string | null;
  createdAt: number;
}

/** Options for showing a toast */
export interface ShowToastOptions {
  variant?: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
  action?: (() => void) | null;
  actionLabel?: string | null;
  playSound?: boolean;
}

/** Options for fetching notifications */
export interface FetchNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}

/** Context value interface */
export interface NotificationContextValue {
  // Toast state
  toasts: Toast[];
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;

  // Persistent notifications
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (options?: FetchNotificationsOptions) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;

  // Settings
  soundEnabled: boolean;
  toggleSound: () => void;
}

/** Props for NotificationProvider component */
export interface NotificationProviderProps {
  children: ReactNode;
}

/** Return type for useToast hook */
export interface UseToastReturn {
  toast: (options: ShowToastOptions) => string;
  success: (title: string, message?: string, options?: Partial<ShowToastOptions>) => string;
  error: (title: string, message?: string, options?: Partial<ShowToastOptions>) => string;
  info: (title: string, message?: string, options?: Partial<ShowToastOptions>) => string;
  warning: (title: string, message?: string, options?: Partial<ShowToastOptions>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ============================================
// Context Creation
// ============================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============================================
// Hooks
// ============================================

/**
 * Hook to access notification context
 */
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    console.warn('useNotifications called outside of NotificationProvider');
    // Return a no-op implementation for use outside provider
    return {
      toasts: [],
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      showToast: () => '',
      dismissToast: () => {},
      dismissAllToasts: () => {},
      fetchNotifications: async () => {},
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      soundEnabled: false,
      toggleSound: () => {},
    };
  }
  return context;
}

/**
 * Convenience hook for showing toasts
 */
export function useToast(): UseToastReturn {
  const { showToast, dismissToast, dismissAllToasts } = useNotifications();

  return {
    toast: showToast,
    success: (title: string, message?: string, options: Partial<ShowToastOptions> = {}) =>
      showToast({ variant: TOAST_VARIANTS.SUCCESS, title, message, ...options }),
    error: (title: string, message?: string, options: Partial<ShowToastOptions> = {}) =>
      showToast({ variant: TOAST_VARIANTS.ERROR, title, message, ...options }),
    info: (title: string, message?: string, options: Partial<ShowToastOptions> = {}) =>
      showToast({ variant: TOAST_VARIANTS.INFO, title, message, ...options }),
    warning: (title: string, message?: string, options: Partial<ShowToastOptions> = {}) =>
      showToast({ variant: TOAST_VARIANTS.WARNING, title, message, ...options }),
    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
  };
}

// ============================================
// Sound Utilities
// ============================================

// Extend Window interface for webkit AudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const createNotificationSound = (type: ToastVariant): void => {
  if (typeof window === 'undefined' || !window.AudioContext) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different tones for different types
    switch (type) {
      case 'success':
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1); // C#6
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        break;
      case 'error':
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        break;
      case 'warning':
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
        oscillator.frequency.setValueAtTime(380, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        break;
      default:
        oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    }

    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // Silently fail - sounds are optional
  }
};

// ============================================
// Provider Component
// ============================================

export function NotificationProvider({ children }: NotificationProviderProps): JSX.Element {
  // Toast state (transient UI notifications)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef<number>(0);

  // Persistent notifications state (from database)
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sound preference - disabled by default
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('notificationSounds');
    return saved === 'true'; // Default to false (no sound)
  });

  const { isAuthenticated, token } = useCustomerAuth();

  // Polling interval ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Dismiss a specific toast
   */
  const dismissToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAllToasts = useCallback((): void => {
    setToasts([]);
  }, []);

  /**
   * Show a toast notification
   */
  const showToast = useCallback(
    ({
      variant = TOAST_VARIANTS.INFO,
      title,
      message,
      duration = 5000,
      action = null,
      actionLabel = null,
      playSound = true,
    }: ShowToastOptions): string => {
      const id = `toast-${++toastIdRef.current}`;

      const newToast: Toast = {
        id,
        variant,
        title,
        message,
        duration,
        action,
        actionLabel,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Limit to 4 visible toasts
        const updated = [...prev, newToast];
        if (updated.length > 4) {
          return updated.slice(-4);
        }
        return updated;
      });

      // Play sound if enabled
      if (playSound && soundEnabled) {
        createNotificationSound(variant);
      }

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [soundEnabled, dismissToast]
  );

  /**
   * Fetch notifications from backend
   */
  const fetchNotifications = useCallback(
    async (options: FetchNotificationsOptions = {}): Promise<void> => {
      if (!isAuthenticated || !token) return;

      const { limit = 10, unreadOnly = false } = options;

      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          unreadOnly: unreadOnly.toString(),
        });

        const response = await fetch(
          `${API_URL}/customers/me/notifications?${queryParams}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data: Notification[] = await response.json();
          setNotifications(data);
        }
      } catch (error) {
        console.error('[NOTIFICATION] Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, token]
  );

  /**
   * Fetch unread count
   */
  const fetchUnreadCount = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch(
        `${API_URL}/customers/me/notifications/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data: { count: number } = await response.json();
        setUnreadCount((prevCount) => {
          // Show toast if new notifications arrived
          if (data.count > prevCount && prevCount > 0) {
            showToast({
              variant: TOAST_VARIANTS.INFO,
              title: 'New Notification',
              message: `You have ${data.count - prevCount} new notification${
                data.count - prevCount > 1 ? 's' : ''
              }`,
              duration: 4000,
            });
          }
          return data.count;
        });
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error fetching unread count:', error);
    }
  }, [isAuthenticated, token, showToast]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!token) return;

      try {
        const response = await fetch(
          `${API_URL}/customers/me/notifications/${notificationId}/read`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('[NOTIFICATION] Error marking as read:', error);
      }
    },
    [token]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/customers/me/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error marking all as read:', error);
    }
  }, [token]);

  /**
   * Toggle sound preference
   */
  const toggleSound = useCallback((): void => {
    setSoundEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem('notificationSounds', newValue.toString());
      return newValue;
    });
  }, []);

  // Set up polling when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      // Initial fetch
      fetchUnreadCount();
      fetchNotifications({ limit: 10 });

      // Start polling every 30 seconds
      pollingRef.current = setInterval(() => {
        fetchUnreadCount();
      }, 30000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    } else {
      // Clear notifications when logged out
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, token, fetchUnreadCount, fetchNotifications]);

  const value: NotificationContextValue = {
    // Toast state
    toasts,
    showToast,
    dismissToast,
    dismissAllToasts,

    // Persistent notifications
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,

    // Settings
    soundEnabled,
    toggleSound,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
