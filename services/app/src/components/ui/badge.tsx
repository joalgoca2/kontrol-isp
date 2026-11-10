import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold " +
    "transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 " +
    "focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-500/10 text-emerald-700 " +
          "dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-800 hover:bg-zinc-200 " +
          "dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
        destructive:
          "border-transparent bg-rose-500/10 text-rose-600 " +
          "dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/30",
        outline:
          "text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-800",
        success:
          "border-transparent bg-emerald-600 text-white shadow hover:bg-emerald-500",
        warning:
          "border-transparent bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
