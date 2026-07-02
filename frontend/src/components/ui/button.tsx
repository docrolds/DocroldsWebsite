import * as React from "react";

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon';

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: '600',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  border: 'none',
  textDecoration: 'none',
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    boxShadow: '0 4px 14px var(--primary-muted)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--foreground)',
  },
  secondary: {
    background: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
  },
  destructive: {
    background: 'var(--destructive)',
    color: 'var(--destructive-foreground)',
  },
  link: {
    background: 'transparent',
    color: 'var(--primary)',
    textDecoration: 'underline',
    boxShadow: 'none',
  },
};

const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: 'var(--primary-hover)',
    boxShadow: '0 6px 20px var(--primary-muted)',
    transform: 'translateY(-1px)',
  },
  outline: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
  },
  ghost: {
    background: 'var(--muted)',
    color: 'var(--primary)',
  },
  secondary: {
    opacity: 0.8,
  },
  destructive: {
    opacity: 0.9,
  },
  link: {
    textDecoration: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  default: {
    height: '40px',
    padding: '0.5rem 1rem',
  },
  sm: {
    height: '36px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
  },
  lg: {
    height: '44px',
    padding: '0.5rem 2rem',
    fontSize: '1rem',
  },
  xl: {
    height: '56px',
    padding: '0.75rem 2.5rem',
    fontSize: '1.1rem',
    borderRadius: '8px',
  },
  icon: {
    height: '40px',
    width: '40px',
    padding: '0',
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, style, children, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const combinedStyles: React.CSSProperties = {
      ...baseStyles,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...(isHovered ? hoverStyles[variant] : {}),
      ...style,
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        style: { ...combinedStyles, ...(children.props as any).style },
        onMouseEnter: (e: React.MouseEvent) => {
          setIsHovered(true);
          (children.props as any).onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          setIsHovered(false);
          (children.props as any).onMouseLeave?.(e);
        },
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        style={combinedStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
