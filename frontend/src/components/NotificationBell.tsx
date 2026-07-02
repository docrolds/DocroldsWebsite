import { useState, useEffect, useRef } from 'react';
import { useNotifications, Notification } from '../context/NotificationContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';

function NotificationBell(): JSX.Element | null {
  const { isAuthenticated } = useCustomerAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const getTimeAgo = (date: Date | string): string => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  const getNotificationIconClass = (type: string): string => {
    switch (type) {
      case 'ORDER_COMPLETED':
        return 'order';
      case 'DOWNLOAD_READY':
        return 'download';
      case 'DOWNLOAD_EXPIRING':
        return 'expiring';
      case 'WELCOME':
        return 'welcome';
      default:
        return 'default';
    }
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
      case 'ORDER_COMPLETED':
        return 'fa-check-circle';
      case 'DOWNLOAD_READY':
        return 'fa-download';
      case 'DOWNLOAD_EXPIRING':
        return 'fa-clock';
      case 'WELCOME':
        return 'fa-hand-sparkles';
      default:
        return 'fa-bell';
    }
  };

  const handleNotificationClick = async (notification: Notification): Promise<void> => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    const metadata = notification.metadata as { actionUrl?: string } | undefined;
    if (metadata?.actionUrl) {
      window.location.href = metadata.actionUrl;
    }

    setIsOpen(false);
  };

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <i className="fas fa-bell" aria-hidden="true"></i>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          {/* Header */}
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="notification-mark-read-btn"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="notification-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <i className="fas fa-bell-slash" aria-hidden="true"></i>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification: Notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                >
                  {!notification.isRead && (
                    <span className="notification-unread-dot" aria-label="Unread"></span>
                  )}
                  <div className={`notification-icon ${getNotificationIconClass(notification.type)}`}>
                    <i className={`fas ${getNotificationIcon(notification.type)}`} aria-hidden="true"></i>
                  </div>
                  <div className="notification-content">
                    <p className="notification-title">{notification.title}</p>
                    <p className="notification-message">{notification.message}</p>
                  </div>
                  <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <a href="/dashboard" onClick={() => setIsOpen(false)}>
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
