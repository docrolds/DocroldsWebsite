import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications, Notification, getNotificationActionUrl } from '../context/NotificationContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import NotificationItem from './NotificationItem';

function NotificationBell(): JSX.Element | null {
  const { isAuthenticated } = useCustomerAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
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

  const handleNotificationClick = async (notification: Notification): Promise<void> => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    setIsOpen(false);

    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      navigate(actionUrl);
    }
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
              notifications
                .slice(0, 10)
                .map((notification: Notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                  />
                ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <Link to="/dashboard?section=notifications" onClick={() => setIsOpen(false)}>
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
