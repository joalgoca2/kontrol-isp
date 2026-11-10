import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div
    className={
      "relative w-full overflow-auto rounded-2xl border border-zinc-200/70 " +
      "dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/50 " +
      "shadow-sm backdrop-blur-md transition-all"
    }
  >
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm text-zinc-900 dark:text-zinc-100",
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "border-b border-zinc-200/80 dark:border-zinc-800/60 " +
        "bg-zinc-50/70 dark:bg-zinc-900/80 [&_tr]:border-b-0",
      className
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-zinc-200/50 dark:border-zinc-800/40 transition-colors " +
        "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 " +
        "data-[state=selected]:bg-zinc-100 dark:data-[state=selected]:bg-zinc-800",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-bold uppercase " +
        "tracking-wider text-zinc-500 dark:text-zinc-400 " +
        "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle text-zinc-700 dark:text-zinc-300 " +
        "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
};
