import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[14.5px] font-medium transition-all outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper shadow-2xs hover:bg-ink-2",
        gold: "bg-gold text-ink shadow-2xs hover:bg-gold-light font-semibold",
        destructive: "bg-chalk text-paper shadow-2xs hover:bg-chalk/90",
        outline: "border border-ink/20 bg-white text-ink shadow-2xs hover:bg-paper-2/70",
        secondary: "bg-paper-2 text-ink shadow-2xs hover:bg-paper-3",
        ghost: "text-ink hover:bg-ink/8",
        link: "text-gold-dark underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8.5 rounded-md px-3 text-[13.5px]",
        lg: "h-11 rounded-md px-6 text-[15.5px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
