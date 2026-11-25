"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dateShort } from "@/lib/format";

/**
 * Calendar-backed date input. Keeps a hidden <input name> so it works inside
 * plain server-action forms while the user picks from the Calendar.
 */
export function DateField({
  name,
  defaultValue,
  placeholder = "তারিখ বাছুন",
  disabledBefore,
  className,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  disabledBefore?: Date;
  className?: string;
  /** Fires with the ISO date (or "" when cleared) — for live filters. */
  onChange?: (iso: string) => void;
}) {
  const [value, setValue] = useState<Date | undefined>(
    defaultValue ? new Date(`${defaultValue}T00:00:00`) : undefined,
  );
  const [open, setOpen] = useState(false);

  const iso = value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : "";

  return (
    <>
      <input type="hidden" name={name} value={iso} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between font-normal text-[15px] text-ink hover:bg-paper",
              !value && "text-stone",
              className,
            )}
          >
            <span>{value ? dateShort(value) : placeholder}</span>
            <CalendarIcon className="size-4 text-stone" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              setValue(d ?? undefined);
              setOpen(false);
              if (onChange) {
                onChange(
                  d
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                    : "",
                );
              }
            }}
            disabled={disabledBefore ? { before: disabledBefore } : undefined}
          />
          {value && (
            <div className="border-t border-ink/12 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setValue(undefined);
                  setOpen(false);
                  onChange?.("");
                }}
              >
                মুছুন
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
