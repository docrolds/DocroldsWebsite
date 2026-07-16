import { Notification } from '../context/NotificationContext';
import { getTimeAgo } from '../lib/timeAgo';

// Every notification type today is system-generated (an order confirmation,
// a welcome message, etc.) - there's no other "sender" - so the Doc Rolds
// logo is always shown as the avatar, with a small icon badge distinguishing
// the notification type (same pattern as Messenger/Facebook system alerts).
const TYPE_META: Record<string, { icon: string; badgeClass: string }> = {
  ORDER_COMPLETED: { icon: 'fa-check-circle', badgeClass: 'order' },
  DOWNLOAD_READY: { icon: 'fa-download', badgeClass: 'download' },
  DOWNLOAD_EXPIRING: { icon: 'fa-clock', badgeClass: 'expiring' },
  WELCOME: { icon: 'fa-star', badgeClass: 'welcome' },
};

function getTypeMeta(type: string): { icon: string; badgeClass: string } {
  return TYPE_META[type] || { icon: 'fa-bell', badgeClass: 'default' };
}

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
  variant?: 'compact' | 'full';
}

export default function NotificationItem({
  notification,
  onClick,
  variant = 'compact',
}: NotificationItemProps): JSX.Element {
  const { icon, badgeClass } = getTypeMeta(notification.type);

  return (
    <button
      onClick={() => onClick(notification)}
      className={`notification-item ${variant === 'full' ? 'notification-item-full' : ''} ${!notification.isRead ? 'unread' : ''}`}
    >
      {!notification.isRead && (
        <span className="notification-unread-dot" aria-label="Unread"></span>
      )}
      <div className="notification-avatar">
        <img src="/logo.jpg" alt="" className="notification-avatar-logo" />
        <span className={`notification-type-badge ${badgeClass}`}>
          <i className={`fas ${icon}`} aria-hidden="true"></i>
        </span>
      </div>
      <div className="notification-content">
        <p className="notification-title">{notification.title}</p>
        <p className="notification-message">{notification.message}</p>
      </div>
      <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
    </button>
  );
}
