import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex min-h-22 w-full rounded-md border border-ink/20 bg-white px-3.5 py-2.5 text-[14.5px] text-ink shadow-2xs transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-stone focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30",
        "aria-invalid:border-chalk aria-invalid:ring-chalk/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
