import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Context for table configuration
interface TableContextValue {
  bleed: boolean;
  dense: boolean;
  grid: boolean;
  striped: boolean;
}

const TableContext = React.createContext<TableContextValue>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
});

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Whether the table should bleed into the gutter */
  bleed?: boolean;
  /** Whether the table should use condensed spacing */
  dense?: boolean;
  /** Whether display vertical grid lines */
  grid?: boolean;
  /** Whether display striped table rows */
  striped?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({
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
        style={{ '--gutter': 'var(--table-gutter, 1rem)' } as React.CSSProperties}
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
  )
);
Table.displayName = "Table";

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "[&_tr]:border-b [&_tr]:border-border/50",
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = "TableHeader";

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
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
  }
);
TableBody.displayName = "TableBody";

export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
);
TableFooter.displayName = "TableFooter";

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** The URL for the row when used as a link */
  href?: string;
  /** The target for the row when used as a link */
  target?: string;
  /** The title for the row when used as a link */
  title?: string;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({
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
  }
);
TableRow.displayName = "TableRow";

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
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
  }
);
TableHead.displayName = "TableHead";

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
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
  }
);
TableCell.displayName = "TableCell";

export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {}

const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
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
