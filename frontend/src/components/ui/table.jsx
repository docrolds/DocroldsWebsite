import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Context for table configuration
const TableContext = React.createContext({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
});

/**
 * Table Component
 * @param {boolean} bleed - Whether the table should bleed into the gutter
 * @param {boolean} dense - Whether the table should use condensed spacing
 * @param {boolean} grid - Whether display vertical grid lines
 * @param {boolean} striped - Whether display striped table rows
 */
const Table = React.forwardRef(({
  className,
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  ...props
}, ref) => (
  <TableContext.Provider value={{ bleed, dense, grid, striped }}>
    <div
      className={cn(
        "relative w-full overflow-auto",
        bleed && "-mx-[var(--gutter,1rem)] px-[var(--gutter,1rem)]"
      )}
      style={{ '--gutter': 'var(--table-gutter, 1rem)' }}
    >
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm",
          striped && "table-striped",
          grid && "table-grid",
          className
        )}
        {...props}
      />
    </div>
  </TableContext.Provider>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "[&_tr]:border-b [&_tr]:border-border/50",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => {
  const { striped } = React.useContext(TableContext);

  return (
    <tbody
      ref={ref}
      className={cn(
        "[&_tr:last-child]:border-0",
        striped && "[&_tr:nth-child(even)]:bg-zinc-900/30",
        className
      )}
      {...props}
    />
  );
});
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

/**
 * TableRow Component
 * @param {string} href - The URL for the row when used as a link
 * @param {string} target - The target for the row when used as a link
 * @param {string} title - The title for the row when used as a link
 */
const TableRow = React.forwardRef(({
  className,
  href,
  target,
  title,
  children,
  ...props
}, ref) => {
  const { striped } = React.useContext(TableContext);

  const rowClasses = cn(
    "border-b border-border/30 transition-colors",
    !striped && "hover:bg-white/[0.02]",
    href && "cursor-pointer hover:bg-primary/5",
    "data-[state=selected]:bg-muted",
    className
  );

  if (href) {
    return (
      <tr ref={ref} className={cn(rowClasses, "relative group")} {...props}>
        {children}
        <td className="absolute inset-0 p-0">
          <Link
            to={href}
            target={target}
            title={title}
            className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded"
            aria-label={title || "View details"}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr ref={ref} className={rowClasses} {...props}>
      {children}
    </tr>
  );
});
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, ...props }, ref) => {
  const { dense, grid } = React.useContext(TableContext);

  return (
    <th
      ref={ref}
      className={cn(
        "text-left align-middle font-semibold text-zinc-400 uppercase text-xs tracking-wider",
        dense ? "h-10 px-3 py-2" : "h-12 px-4 py-3",
        grid && "border-x border-border/20 first:border-l-0 last:border-r-0",
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
});
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => {
  const { dense, grid } = React.useContext(TableContext);

  return (
    <td
      ref={ref}
      className={cn(
        "align-middle text-zinc-300",
        dense ? "px-3 py-2" : "p-4",
        grid && "border-x border-border/20 first:border-l-0 last:border-r-0",
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
});
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
