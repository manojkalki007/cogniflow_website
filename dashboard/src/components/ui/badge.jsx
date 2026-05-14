import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-[var(--accent)]/20 bg-[var(--accent-subtle)] text-[var(--accent-text)] backdrop-blur-sm",
        secondary: "border-[var(--border-glass)] bg-[var(--surface-glass)] text-[var(--text-secondary)] backdrop-blur-sm",
        destructive: "border-red-500/15 bg-red-500/8 text-red-400 dark:border-red-500/15 dark:bg-red-500/8 dark:text-red-400",
        success: "border-emerald-500/15 bg-emerald-500/8 text-emerald-500 dark:border-emerald-500/15 dark:bg-emerald-500/8 dark:text-emerald-400",
        warning: "border-amber-500/15 bg-amber-500/8 text-amber-500 dark:border-amber-500/15 dark:bg-amber-500/8 dark:text-amber-400",
        outline: "border-[var(--border-glass)] text-[var(--text-muted)] bg-transparent backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
