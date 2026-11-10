import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-zinc-300 bg-white " +
            "dark:border-zinc-800 dark:bg-zinc-950/60 px-3 py-2 text-sm " +
            "text-zinc-900 dark:text-zinc-100 shadow-sm transition-colors " +
            "placeholder:text-zinc-500 dark:placeholder:text-zinc-500 " +
            "focus-visible:outline-none focus-visible:ring-1 " +
            "focus-visible:ring-indigo-500 disabled:cursor-not-allowed " +
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
Textarea.displayName = "Textarea";

export { Textarea };
