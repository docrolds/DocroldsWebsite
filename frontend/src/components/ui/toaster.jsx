import * as React from "react";
import { createPortal } from "react-dom";
import { Toast } from "./toast";
import { useNotifications } from "@/context/NotificationContext";

/**
 * Toaster component - renders toasts in a portal
 * Position: top-right, stacking downward
 */
export function Toaster() {
  const { toasts, dismissToast } = useNotifications();
  const [mounted, setMounted] = React.useState(false);

  // Only render on client side
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const containerStyle = {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    pointerEvents: 'none',
    maxHeight: 'calc(100vh - 32px)',
    overflow: 'hidden',
  };

  const toastWrapperStyle = {
    pointerEvents: 'auto',
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
            action={toast.action}
            actionLabel={toast.actionLabel}
            onDismiss={dismissToast}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default Toaster;
