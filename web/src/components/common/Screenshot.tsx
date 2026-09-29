import * as React from "react"
import { cn } from "cn"
import { Check, ChevronsLeftRight, ImageOff } from "lucide-react"
import type { Rect } from "@/lib/api"

export interface Marker {
  key: string
  n?: number
  rect?: Rect | null
  done?: boolean
  quiet?: boolean
  label: string
}

const SHOT_W = 1280 // screenshots are captured at 1280 css px

/**
 * A full-page screenshot with numbered pins on each change.
 * Hovering or selecting a change scrolls it into view, so nothing hides below the fold,
 * and a thin track on the right shows where every change sits on the page.
 */
export function Screenshot({ src, markers, active, onPick, className }: { src: string; markers: Marker[]; active?: string | null; onPick?: (key: string) => void; className?: string }) {
  const scroller = React.useRef<HTMLDivElement>(null)
  const img = React.useRef<HTMLImageElement>(null)
  const [k, setK] = React.useState(0)
  const [natural, setNatural] = React.useState(0)
  const [view, setView] = React.useState({ top: 0, h: 1, total: 1 })
  const [failed, setFailed] = React.useState(false)

  const measure = React.useCallback(() => {
    const i = img.current, s = scroller.current
    if (!i || !s || !i.naturalWidth) return
    setK(i.clientWidth / SHOT_W)
    setNatural(i.naturalHeight)
    setView({ top: s.scrollTop, h: s.clientHeight, total: i.clientHeight || 1 })
  }, [])
  React.useEffect(() => {
    const ro = new ResizeObserver(measure)
    if (scroller.current) ro.observe(scroller.current)
    return () => ro.disconnect()
  }, [measure])
  React.useEffect(() => { setFailed(false); setK(0) }, [src])

  const visible = (r: Rect) => r[1] < natural && r[0] + r[2] > -2000
  const offscreen = (r: Rect) => r[0] + r[2] <= 0 || r[0] >= SHOT_W

  // Auto-scroll to the active change when it's outside the visible part of the screenshot.
  React.useEffect(() => {
    const m = markers.find((x) => x.key === active), s = scroller.current
    if (!m?.rect || !s || !k || !visible(m.rect)) return
    const y = m.rect[1] * k, h = Math.max(m.rect[3], 12) * k
    if (y < s.scrollTop + 24 || y + h > s.scrollTop + s.clientHeight - 24) s.scrollTo({ top: Math.max(0, y - s.clientHeight * 0.3), behavior: "smooth" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, k])

  const act = markers.find((x) => x.key === active)
  const placed = markers.filter((m) => m.rect && visible(m.rect))
  return (
    <div className={cn("relative min-h-0", className)}>
      <div ref={scroller} onScroll={measure} className="scrollbar-thin h-full overflow-auto bg-muted/60 pr-3">
        {failed ? (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground"><div><ImageOff className="mx-auto mb-2 size-5" />No screenshot for this page.</div></div>
        ) : (
          <div className="relative">
            <img ref={img} src={src} alt="Full-page screenshot" onLoad={measure} onError={() => setFailed(true)} className="block w-full select-none" draggable={false} />
            {k > 0 && act?.rect && visible(act.rect) && !offscreen(act.rect) && (
              <div
                className="pointer-events-none absolute rounded-[3px] border-2 border-brand bg-brand/10 transition-all duration-200"
                style={{ left: act.rect[0] * k - 3, top: act.rect[1] * k - 3, width: act.rect[2] * k + 6, height: Math.max(act.rect[3], 10) * k + 6 }}
              />
            )}
            {k > 0 &&
              placed.map((m) => {
                const off = offscreen(m.rect!)
                const x = off ? (m.rect![0] < 0 ? 4 : SHOT_W * k - 26) : Math.min(Math.max(m.rect![0] * k - 10, 2), SHOT_W * k - 24)
                const y = m.rect![1] * k - 10
                const on = m.key === active
                if (m.quiet && !on) return <span key={m.key} className="pointer-events-none absolute size-2 rounded-full bg-muted-foreground/60" style={{ left: x + 6, top: y + 6 }} />
                return (
                  <button
                    key={m.key}
                    title={off ? `${m.label} · off-screen in the screenshot (slider or hidden panel)` : m.label}
                    onClick={() => onPick?.(m.key)}
                    className={cn(
                      "absolute z-10 grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10.5px] font-semibold shadow-sm ring-2 ring-background transition-transform",
                      on ? "z-20 scale-125 bg-brand text-brand-foreground" : m.done ? "bg-foreground text-background" : "border border-foreground bg-card text-foreground",
                      off && "border-dashed"
                    )}
                    style={{ left: x, top: y }}
                  >
                    {off ? <ChevronsLeftRight className="size-3" /> : m.done && !on ? <Check className="size-3" /> : m.n ?? "•"}
                  </button>
                )
              })}
          </div>
        )}
      </div>
      {k > 0 && natural > 0 && (
        <div className="absolute top-2 right-0.5 bottom-2 w-2" aria-hidden>
          <div className="absolute inset-x-0 rounded-full bg-foreground/10" style={{ top: `${(view.top / view.total) * 100}%`, height: `${Math.min(100, (view.h / view.total) * 100)}%` }} />
          {placed.filter((m) => !m.quiet).map((m) => (
            <button
              key={m.key}
              onClick={() => onPick?.(m.key)}
              className={cn("absolute left-0 h-[3px] w-2 rounded-full", m.key === active ? "bg-brand" : m.done ? "bg-foreground/40" : "bg-foreground")}
              style={{ top: `${(m.rect![1] / natural) * 100}%` }}
              tabIndex={-1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
