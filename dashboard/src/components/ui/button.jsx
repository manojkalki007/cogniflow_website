import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default: "text-white shadow-sm hover:opacity-90 hover:shadow-md",
        destructive: "bg-[var(--danger)] text-white hover:opacity-90 shadow-sm",
        outline: "border border-[var(--border-glass)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] bg-[var(--surface-glass)] backdrop-blur-sm hover:bg-[var(--surface-raised)]",
        secondary: "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]",
        ghost: "hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
        glass: "bg-[var(--surface-glass)] backdrop-blur-md border border-[var(--border-glass)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] shadow-[var(--shadow-glass)]",
      },
      size: {
        default: "h-9 px-4 py-2",
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

const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      style={variant === "default" || !variant ? {
        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
        boxShadow: "0 4px 14px var(--accent-glow)",
      } : undefined}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
