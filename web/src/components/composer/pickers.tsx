import * as React from "react"
import { cn } from "cn"
import { Check, ChevronDown, Cpu, FileText, Flag, Sparkles } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useApp } from "@/hooks/useApp"
import type { EngineId, Output } from "@/lib/api"
import { COUNTRIES, POPULAR, countryByName } from "@/lib/countries"
import { Dot, Meter } from "@/components/common/bits"
import { go, routes } from "@/lib/router"
import { cap } from "@/lib/format"

/** A chip in the composer's context row, like Codex's folder / Local / branch chips. */
export function ChipButton({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-foreground/80 transition-colors hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent [&_svg]:size-3.5 [&_svg]:shrink-0", className)}
      {...props}
    >
      {children}
    </button>
  )
}

export const OUTPUTS: Record<Output, { label: string; short: string; desc: string }> = {
  live: { label: "Tags only", short: "Tags only", desc: "Fixes heading tags. The wording stays, so the developer can do it today with no client sign-off." },
  both: { label: "Tags + rewrites", short: "Tags + rewrites", desc: "The same tag fixes to do now, plus keyword rewrites and new headings that wait for client sign-off. Takes longer." },
  optimize: { label: "Rewrites only", short: "Rewrites", desc: "Older option: rewrites without a separate tag-fix phase." },
}
const CHOICES: Output[] = ["live", "both"]

export function OutputPicker({ value, onChange }: { value: Output; onChange: (v: Output) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<ChipButton />}><FileText />{OUTPUTS[value].short}<ChevronDown className="opacity-60" /></DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>What to make</DropdownMenuLabel>
          {CHOICES.map((k) => (
            <DropdownMenuItem key={k} className="items-start" onClick={() => onChange(k)}>
              <span className="flex-1"><span className="block font-medium">{OUTPUTS[k].label}</span><span className="block text-xs text-muted-foreground">{OUTPUTS[k].desc}</span></span>
              <Check className={cn("mt-0.5", k !== value && "invisible")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const c = countryByName(value)
  const item = (x: (typeof COUNTRIES)[number], key: string) => (
    <CommandItem key={key} value={`${x.name} ${x.keywords}`} onSelect={() => { onChange(x.name); setOpen(false) }}>
      <span className="text-base leading-none">{x.flag}</span>
      <span className="flex-1">{x.name}</span>
      {x.name === value && <Check />}
    </CommandItem>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<ChipButton aria-label="Search market" />}>
        {c ? <span className="text-sm leading-none">{c.flag}</span> : <Flag />}{value}<ChevronDown className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search countries" />
          <CommandList className="max-h-72">
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup heading="Popular">{POPULAR.map((x) => item(x, "p" + x.code))}</CommandGroup>
            <CommandGroup heading="All countries">{COUNTRIES.map((x) => item(x, x.code))}</CommandGroup>
          </CommandList>
        </Command>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">Sets the wording buyers search with, like “colour” or “color”.</p>
      </PopoverContent>
    </Popover>
  )
}

export function EnginePicker({ value, onChange }: { value: EngineId; onChange: (v: EngineId) => void }) {
  const { status } = useApp()
  if (!status) return null
  const E = status.engines
  const ready = (k: EngineId) => E[k].installed && E[k].loggedIn
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<ChipButton className={cn(E[value].billing === "api" && "text-brand-ink")} />}>
        <Dot tone={ready(value) ? "ink" : "muted"} />{status.catalog[value].name}
        <span className="text-muted-foreground">{!ready(value) ? "· not set up" : E[value].billing === "api" ? "· API key" : E[value].plan ? `· ${cap(E[value].plan)} plan` : "· your plan"}</span>
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Runs on your own account and counts toward its usage limits</DropdownMenuLabel>
          {(["claude", "codex"] as EngineId[]).map((k) => (
            <DropdownMenuItem key={k} className="items-start" onClick={() => (ready(k) ? onChange(k) : go(routes.settings(k)))}>
              <Cpu className="mt-0.5" />
              <span className="flex-1">
                <span className="block font-medium">{status.catalog[k].name}</span>
                <span className="block text-xs text-muted-foreground">
                  {ready(k) ? `${E[k].account || "Signed in"}${E[k].plan ? ` · ${cap(E[k].plan)} plan` : ""}` : E[k].installed ? "Installed, not signed in. Set up →" : "Not installed. Set up →"}
                </span>
              </span>
              <Check className={cn("mt-0.5", k !== value && "invisible")} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go(routes.settings())}>Manage engines and usage</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One picker for model and effort, like Codex's “GPT-6 Astra · Extra High”. */
export function ModelPicker({ engine, model, effort, custom, onChange }: { engine: EngineId; model: string; effort: string; custom?: string; onChange: (p: { model?: string; effort?: string; custom?: string }) => void }) {
  const { status } = useApp()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState(custom || "")
  if (!status) return null
  const cat = status.catalog[engine], eff = status.effort
  const m = cat.models.find((x) => x.id === model)
  const label = model === "custom" ? custom || "Custom model" : m?.name || model
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<ChipButton className="font-medium text-foreground" />}>
        <Sparkles />{label}<span className="font-normal text-muted-foreground">{eff[effort]?.name}</span><ChevronDown className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-[360px] gap-0 p-1.5" align="end" side="top">
        <div className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">{cat.name} model</div>
        {cat.models.map((x) => (
          <button key={x.id} onClick={() => onChange({ model: x.id })} className={cn("flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-accent", model === x.id && "bg-accent/70")}>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-medium">{x.name}{x.rec && <span className="tag-label border-brand/40 text-brand-ink">Recommended</span>}</span>
              <span className="block text-xs text-muted-foreground">{x.desc}</span>
            </span>
            <Meter value={x.usage} className="mt-1" />
            <Check className={cn("mt-0.5 size-4", model !== x.id && "invisible")} />
          </button>
        ))}
        {engine === "codex" && (
          <div className="flex items-center gap-2 px-2 py-2">
            <Input className="h-7" placeholder="Other model, e.g. gpt-5.5" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!draft.trim()} onClick={() => onChange({ model: "custom", custom: draft.trim() })}>Use</Button>
          </div>
        )}
        <div className="mt-1 border-t px-2 pt-2.5 pb-1">
          <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground"><span>Effort</span><span>{eff[effort]?.desc}</span></div>
          <div className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${cat.efforts.length},1fr)` }}>
            {cat.efforts.map((k) => (
              <button key={k} onClick={() => onChange({ effort: k })} className={cn("flex flex-col items-center gap-1 rounded-md py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground", effort === k && "bg-card text-foreground shadow-sm")}>
                <Meter value={eff[k]!.usage} max={5} className={cn(effort !== k && "opacity-50")} />
                {eff[k]!.name.replace("Extra high", "X-high")}
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Meter value={2} /> Bars show how much of your plan’s usage each option takes.</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
