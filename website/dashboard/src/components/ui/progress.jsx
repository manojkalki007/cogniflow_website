import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Progress = forwardRef(({ className, value = 0, color = "bg-blue-500", ...props }, ref) => (
  <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-gray-800", className)} {...props}>
    <div
      className={cn("h-full rounded-full transition-all duration-500", color)}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
));
Progress.displayName = "Progress";

export { Progress };
