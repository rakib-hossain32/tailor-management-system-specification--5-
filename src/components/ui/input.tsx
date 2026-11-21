import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-ink/20 bg-white px-3.5 py-2 text-[14.5px] leading-tight text-ink shadow-2xs transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-stone focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30",
        "aria-invalid:border-chalk aria-invalid:ring-chalk/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55",
        "selection:bg-gold-light selection:text-ink",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
