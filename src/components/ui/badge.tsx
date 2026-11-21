import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-ink text-paper",
        secondary: "border-transparent bg-paper-2 text-ink-3",
        gold: "border-transparent bg-gold-light text-gold-dark",
        destructive: "border-transparent bg-chalk text-paper",
        outline: "border-ink/25 text-ink-3",
        success: "border-transparent bg-[#D9F0E1] text-[#1D6B3F]",
        warning: "border-transparent bg-[#FCE4CC] text-[#8A4B08]",
        info: "border-transparent bg-[#DCE9F8] text-[#1B4F8F]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
