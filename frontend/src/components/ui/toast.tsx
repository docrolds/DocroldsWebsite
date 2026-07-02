import * as React from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface VariantStyle {
  border: string;
  borderLeft: string;
  iconColor: string;
}

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderLeft: '4px solid #22c55e',
    iconColor: '#22c55e',
  },
  error: {
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderLeft: '4px solid #ef4444',
    iconColor: '#ef4444',
  },
  warning: {
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderLeft: '4px solid #eab308',
    iconColor: '#eab308',
  },
  info: {
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderLeft: '4px solid #3b82f6',
    iconColor: '#3b82f6',
  },
};

const VARIANT_ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique identifier for the toast */
  id?: string;
  /** Visual variant of the toast */
  variant?: ToastVariant;
  /** Title displayed prominently */
  title?: string;
  /** Optional message displayed below the title */
  message?: string;
  /** Action callback when action button is clicked */
  action?: () => void;
  /** Label for the action button */
  actionLabel?: string;
  /** Callback when toast is dismissed */
  onDismiss?: (id?: string) => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      id,
      variant = "info",
      title,
      message,
      action,
      actionLabel,
      onDismiss,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [isExiting, setIsExiting] = React.useState(false);

    const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
    const IconComponent = VARIANT_ICONS[variant] || Info;

    const handleDismiss = React.useCallback(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss?.(id);
      }, 200);
    }, [id, onDismiss]);

    const toastStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '14px 16px',
      background: '#0d0d0d',
      borderRadius: '8px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
      minWidth: '320px',
      maxWidth: '420px',
      animation: isExiting ? 'toastSlideOut 0.2s ease forwards' : 'toastSlideIn 0.3s ease',
      ...variantStyle,
      ...style,
    };

    const iconStyle: React.CSSProperties = {
      flexShrink: 0,
      width: '20px',
      height: '20px',
      color: variantStyle.iconColor,
      marginTop: '2px',
    };

    const contentStyle: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
    };

    const titleStyle: React.CSSProperties = {
      fontWeight: 600,
      fontSize: '0.9rem',
      color: '#ffffff',
      marginBottom: message ? '4px' : 0,
      lineHeight: 1.4,
    };

    const messageStyle: React.CSSProperties = {
      fontSize: '0.85rem',
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: 1.5,
    };

    const actionsStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
    };

    const actionButtonStyle: React.CSSProperties = {
      padding: '6px 12px',
      fontSize: '0.8rem',
      fontWeight: 600,
      background: variantStyle.iconColor,
      color: '#000',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    };

    const closeButtonStyle: React.CSSProperties = {
      flexShrink: 0,
      background: 'transparent',
      border: 'none',
      padding: '4px',
      cursor: 'pointer',
      color: 'rgba(255, 255, 255, 0.5)',
      borderRadius: '4px',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    };

    const handleActionButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.opacity = '0.8';
    };

    const handleActionButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.opacity = '1';
    };

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        style={toastStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn("toast", className)}
        {...props}
      >
        <IconComponent style={iconStyle} />

        <div style={contentStyle}>
          {title && <div style={titleStyle}>{title}</div>}
          {message && <div style={messageStyle}>{message}</div>}

          {action && actionLabel && (
            <div style={actionsStyle}>
              <button
                style={actionButtonStyle}
                onClick={action}
                onMouseEnter={handleActionButtonMouseEnter}
                onMouseLeave={handleActionButtonMouseLeave}
              >
                {actionLabel}
              </button>
            </div>
          )}
        </div>

        <button
          style={{
            ...closeButtonStyle,
            background: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            color: isHovered ? '#fff' : 'rgba(255, 255, 255, 0.5)',
          }}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    );
  }
);

Toast.displayName = "Toast";

export { Toast };
