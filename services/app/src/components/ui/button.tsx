import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm " +
    "font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-emerald-500/50 disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer shadow-sm",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 " +
          "dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 shadow-emerald-500/20",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500",
        outline:
          "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 hover:text-zinc-900 " +
          "dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white",
        secondary:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
        ghost:
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
          "dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100",
        link: "text-emerald-600 dark:text-emerald-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9.5 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
