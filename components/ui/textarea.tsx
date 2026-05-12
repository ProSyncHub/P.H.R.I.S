import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-32 w-full rounded-md border bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring", className)} {...props} />
));
Textarea.displayName = "Textarea";
