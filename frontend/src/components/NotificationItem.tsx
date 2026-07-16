import { Notification } from '../context/NotificationContext';
import { getTimeAgo } from '../lib/timeAgo';

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
      </div>
      <div className="notification-content">
        <p className="notification-title">{notification.title}</p>
        <p className="notification-message">{notification.message}</p>
      </div>
      <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
    </button>
  );
}
