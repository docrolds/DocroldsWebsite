import * as React from "react";
import { createPortal } from "react-dom";
import { Toast } from "./toast";
import { useNotifications } from "@/context/NotificationContext";

/**
 * Toaster component - renders toasts in a portal
 * Position: bottom-center, stacking upward
 */
export function Toaster(): React.ReactElement | null {
  const { toasts, dismissToast } = useNotifications();
  const [mounted, setMounted] = React.useState(false);

  // Only render on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column-reverse', // Stack upward
    alignItems: 'center',
    gap: '12px',
    pointerEvents: 'none',
    maxWidth: '420px',
    width: '100%',
    padding: '0 16px',
    boxSizing: 'border-box',
  };

  const toastWrapperStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    width: '100%',
  };

  return createPortal(
    <div
      style={containerStyle}
      aria-label="Notifications"
      role="region"
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={toastWrapperStyle}>
          <Toast
            id={toast.id}
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            action={toast.action ?? undefined}
            actionLabel={toast.actionLabel ?? undefined}
            onDismiss={(id) => id && dismissToast(id)}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default Toaster;
