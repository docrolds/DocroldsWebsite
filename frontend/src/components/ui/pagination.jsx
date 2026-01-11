import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Pagination = React.forwardRef(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    role="navigation"
    aria-label="pagination"
    className={cn("flex items-center justify-between gap-4", className)}
    {...props}
  />
));
Pagination.displayName = "Pagination";

const PaginationList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  />
));
PaginationList.displayName = "PaginationList";

const PaginationPage = React.forwardRef(({
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
        ref={ref}
        to={href}
        className={baseClasses}
        aria-current={current ? "page" : undefined}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className={baseClasses}
      aria-current={current ? "page" : undefined}
      {...props}
    >
      {children}
    </button>
  );
});
PaginationPage.displayName = "PaginationPage";

const PaginationPrevious = React.forwardRef(({
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
      <Link ref={ref} to={href} className={baseClasses} {...props}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
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
});
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = React.forwardRef(({
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
      <Link ref={ref} to={href} className={baseClasses} {...props}>
        {children}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  return (
    <button
      ref={ref}
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
});
PaginationNext.displayName = "PaginationNext";

const PaginationGap = React.forwardRef(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("px-2 text-zinc-500", className)}
    {...props}
  >
    ...
  </span>
));
PaginationGap.displayName = "PaginationGap";

export {
  Pagination,
  PaginationList,
  PaginationPage,
  PaginationPrevious,
  PaginationNext,
  PaginationGap,
};
