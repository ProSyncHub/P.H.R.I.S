import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-10 w-full rounded-md border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring", className)} {...props} />
));
Input.displayName = "Input";
