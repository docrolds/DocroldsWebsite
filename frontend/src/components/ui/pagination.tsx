import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {}

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      role="navigation"
      aria-label="pagination"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    />
  )
);
Pagination.displayName = "Pagination";

export interface PaginationListProps extends React.HTMLAttributes<HTMLDivElement> {}

const PaginationList = React.forwardRef<HTMLDivElement, PaginationListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
);
PaginationList.displayName = "PaginationList";

export interface PaginationPageProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  current?: boolean;
}

const PaginationPage = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, PaginationPageProps>(
  ({
    className,
    href,
    current = false,
    children,
    ...props
  }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-medium rounded transition-colors",
      current
        ? "bg-primary text-white"
        : "text-zinc-400 hover:text-white hover:bg-zinc-800",
      className
    );

    if (href) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={href}
          className={baseClasses}
          aria-current={current ? "page" : undefined}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={baseClasses}
        aria-current={current ? "page" : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PaginationPage.displayName = "PaginationPage";

export interface PaginationPreviousProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
}

const PaginationPrevious = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, PaginationPreviousProps>(
  ({
    className,
    href,
    disabled = false,
    children = "Previous",
    ...props
  }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center gap-1 px-3 h-8 text-sm font-medium rounded transition-colors",
      disabled
        ? "text-zinc-600 cursor-not-allowed"
        : "text-zinc-400 hover:text-white hover:bg-zinc-800",
      className
    );

    if (href && !disabled) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={href}
          className={baseClasses}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={baseClasses}
        disabled={disabled}
        {...props}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {children}
      </button>
    );
  }
);
PaginationPrevious.displayName = "PaginationPrevious";

export interface PaginationNextProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
}

const PaginationNext = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, PaginationNextProps>(
  ({
    className,
    href,
    disabled = false,
    children = "Next",
    ...props
  }, ref) => {
    const baseClasses = cn(
      "inline-flex items-center gap-1 px-3 h-8 text-sm font-medium rounded transition-colors",
      disabled
        ? "text-zinc-600 cursor-not-allowed"
        : "text-zinc-400 hover:text-white hover:bg-zinc-800",
      className
    );

    if (href && !disabled) {
      return (
        <Link
          ref={ref as React.Ref<HTMLAnchorElement>}
          to={href}
          className={baseClasses}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {children}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={baseClasses}
        disabled={disabled}
        {...props}
      >
        {children}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }
);
PaginationNext.displayName = "PaginationNext";

export interface PaginationGapProps extends React.HTMLAttributes<HTMLSpanElement> {}

const PaginationGap = React.forwardRef<HTMLSpanElement, PaginationGapProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("px-2 text-zinc-500", className)}
      {...props}
    >
      ...
    </span>
  )
);
PaginationGap.displayName = "PaginationGap";

export {
  Pagination,
  PaginationList,
  PaginationPage,
  PaginationPrevious,
  PaginationNext,
  PaginationGap,
};
