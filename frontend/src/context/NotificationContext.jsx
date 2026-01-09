import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useCustomerAuth } from './CustomerAuthContext';
import { API_URL } from '../config';

const NotificationContext = createContext();

// Notification types for stored notifications
export const NOTIFICATION_TYPES = {
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  DOWNLOAD_READY: 'DOWNLOAD_READY',
  DOWNLOAD_EXPIRING: 'DOWNLOAD_EXPIRING',
  WELCOME: 'WELCOME',
};

// Toast variants
export const TOAST_VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

/**
 * Hook to access notification context
 */
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    console.warn('useNotifications called outside of NotificationProvider');
    return {
      toasts: [],
      notifications: [],
      unreadCount: 0,
      showToast: () => {},
      dismissToast: () => {},
      dismissAllToasts: () => {},
      fetchNotifications: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
    };
  }
  return context;
}

/**
 * Convenience hook for showing toasts
 */
export function useToast() {
  const { showToast, dismissToast, dismissAllToasts } = useNotifications();

  return {
    toast: showToast,
    success: (title, message, options = {}) =>
      showToast({ variant: TOAST_VARIANTS.SUCCESS, title, message, ...options }),
    error: (title, message, options = {}) =>
      showToast({ variant: TOAST_VARIANTS.ERROR, title, message, ...options }),
    info: (title, message, options = {}) =>
      showToast({ variant: TOAST_VARIANTS.INFO, title, message, ...options }),
    warning: (title, message, options = {}) =>
      showToast({ variant: TOAST_VARIANTS.WARNING, title, message, ...options }),
    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
  };
}

// Sound utilities
const createNotificationSound = (type) => {
  if (typeof window === 'undefined' || !window.AudioContext) return null;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (e) {
    // Silently fail - sounds are optional
  }
};

export function NotificationProvider({ children }) {
  // Toast state (transient UI notifications)
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // Persistent notifications state (from database)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Sound preference (could be stored in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationSounds');
    return saved !== 'false'; // Default to true
  });

  const { isAuthenticated, token } = useCustomerAuth();

  // Polling interval ref
  const pollingRef = useRef(null);

  /**
   * Show a toast notification
   */
  const showToast = useCallback(({
    variant = TOAST_VARIANTS.INFO,
    title,
    message,
    duration = 5000,
    action = null,
    actionLabel = null,
    playSound = true,
  }) => {
    const id = `toast-${++toastIdRef.current}`;

    const newToast = {
      id,
      variant,
      title,
      message,
      duration,
      action,
      actionLabel,
      createdAt: Date.now(),
    };

    setToasts(prev => {
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
  }, [soundEnabled]);

  /**
   * Dismiss a specific toast
   */
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  /**
   * Fetch notifications from backend
   */
  const fetchNotifications = useCallback(async (options = {}) => {
    if (!isAuthenticated || !token) return;

    const { limit = 10, unreadOnly = false } = options;

    try {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString(),
      });

      const response = await fetch(
        `${API_URL}/customers/me/notifications?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error fetching notifications:', error);
    }
  }, [isAuthenticated, token]);

  /**
   * Fetch unread count
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      const response = await fetch(
        `${API_URL}/customers/me/notifications/unread-count`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const prevCount = unreadCount;
        setUnreadCount(data.count);

        // Show toast if new notifications arrived
        if (data.count > prevCount && prevCount > 0) {
          showToast({
            variant: TOAST_VARIANTS.INFO,
            title: 'New Notification',
            message: `You have ${data.count - prevCount} new notification${data.count - prevCount > 1 ? 's' : ''}`,
            duration: 4000,
          });
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error fetching unread count:', error);
    }
  }, [isAuthenticated, token, unreadCount, showToast]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/customers/me/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('[NOTIFICATION] Error marking as read:', error);
    }
  }, [token]);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(
        `${API_URL}/customers/me/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date() }))
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
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
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
  }, [isAuthenticated, token]);

  const value = {
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
