import * as React from "react"
import { cn } from "cn"
import { CalendarDays, X } from "lucide-react"
import { fmtDay } from "@/lib/project"

/** A date shown the way the rest of the app writes it ("Sun, Nov 15"), opening the system date picker on click. */
export function DateField({ value, onChange, placeholder = "No date", clearable, className, icon = true }: { value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string; clearable?: boolean; className?: string; icon?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const open = () => { const el = ref.current; if (!el) return; try { el.showPicker() } catch { el.focus(); el.click() } }
  return (
    <span className={cn("relative inline-flex h-8 items-center", className)}>
      <button type="button" onClick={open} className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-[13.5px] hover:bg-muted/70">
        {icon && <CalendarDays className="size-3.5 text-muted-foreground" />}
        {value ? fmtDay(value, true) : <span className="text-muted-foreground">{placeholder}</span>}
      </button>
      {clearable && value && <button type="button" onClick={() => onChange(null)} aria-label="Clear the date" className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground"><X className="size-3.5" /></button>}
      <input ref={ref} type="date" value={value || ""} onChange={(e) => onChange(e.target.value || null)} tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-px opacity-0" />
    </span>
  )
}
