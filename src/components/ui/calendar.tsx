"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { bn } from "date-fns/locale";
import { cn } from "@/lib/utils";

import "react-day-picker/dist/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, captionLayout = "label", locale, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      locale={locale ?? bn}
      className={cn(
        "bg-paper p-3 text-ink [--rdp-cell-size:2.25rem] [--rdp-accent-color:#D9A21B] [--rdp-background-color:#F6E3B8]",
        className,
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col gap-4 sm:flex-row sm:gap-8", defaultClassNames.months),
        month: cn("flex flex-col gap-3", defaultClassNames.month),
        month_caption: cn("flex items-center justify-center gap-2 px-2 pb-1", defaultClassNames.month_caption),
        caption_label: cn("text-base font-medium", defaultClassNames.caption_label),
        nav: cn("flex items-center gap-1", defaultClassNames.nav),
        button_previous: cn(
          "absolute left-1 top-1 flex size-8 items-center justify-center rounded-sm border border-ink/15 bg-paper text-ink hover:bg-ink/8 outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          "absolute right-1 top-1 flex size-8 items-center justify-center rounded-sm border border-ink/15 bg-paper text-ink hover:bg-ink/8 outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          defaultClassNames.button_next,
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("mb-1 flex", defaultClassNames.weekdays),
        weekday: cn("flex-1 rounded-sm py-1 text-center text-[13px] font-medium text-stone", defaultClassNames.weekday),
        week: cn("flex w-full", defaultClassNames.week),
        day: cn(
          "relative flex size-full items-center justify-center rounded-sm p-0 text-base outline-none focus-visible:bg-gold-light focus-visible:ring-2 focus-visible:ring-gold/50",
          defaultClassNames.day,
        ),
        today: cn("bg-gold-light font-semibold text-ink", defaultClassNames.today),
        selected: cn("bg-ink font-medium text-paper hover:bg-ink hover:text-paper", defaultClassNames.selected),
        outside: cn("text-stone opacity-55", defaultClassNames.outside),
        disabled: cn("text-stone opacity-40", defaultClassNames.disabled),
        range_middle: cn("bg-gold-light text-ink", defaultClassNames.range_middle),
        chevron: cn("size-4", defaultClassNames.chevron),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />,
        DayButton: (props) => <CalendarDayButton {...props} />,
      }}
      {...props}
    />
  );
}

function CalendarDayButton(props: React.ComponentProps<typeof DayButton>) {
  return <DayButton {...props} className={cn("hover:bg-gold-light", props.className)} />;
}

export { Calendar };
