import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-zinc-300 bg-white " +
            "dark:border-zinc-800 dark:bg-zinc-950/60 px-3 py-1 text-sm " +
            "text-zinc-900 dark:text-zinc-100 shadow-sm transition-colors " +
            "file:border-0 file:bg-transparent file:text-sm file:font-medium " +
            "placeholder:text-zinc-500 dark:placeholder:text-zinc-500 " +
            "focus-visible:outline-none focus-visible:ring-1 " +
            "focus-visible:ring-emerald-500 disabled:cursor-not-allowed " +
            "disabled:opacity-50",
          error && "border-rose-500 focus-visible:ring-rose-500",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
