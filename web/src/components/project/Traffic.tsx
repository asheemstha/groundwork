import * as React from "react"
import { Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ToolCard } from "@/components/project/ToolCard"
import { api, type Project } from "@/lib/api"

const day = (t: number) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" })

/**
 * Search traffic from an export: a CSV from Search Console (Pages), GA4 or Google Ads (Landing page), dropped in.
 * It ranks the redirect map by real clicks, and keeps a before-launch number to compare with one taken after.
 */
export function TrafficCard({ p, setP }: { p: Project; setP: (x: Project) => void }) {
  const [busy, setBusy] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const list = p.traffic || []
  const pick = (f?: File) => {
    if (!f) return
    if (f.size > 20e6) return toast.error("That file is over 20 MB.")
    setBusy(true)
    f.text().then(async (text) => {
      try { const x = await api.importTraffic(p.id, f.name, text); setP(x); const i = x.traffic?.[0]; if (i) toast.success(`Imported ${i.total.toLocaleString()} ${i.metric} on ${i.pages.toLocaleString()} pages`, { description: `From ${i.source}${p.tools.redirects ? ". The redirect map now lists the URLs with the most " + i.metric + " first." : "."}` }) }
      catch (e) { toast.error((e as Error).message) } finally { setBusy(false); if (input.current) input.current.value = "" }
    })
  }
  const remove = async (id: string) => { try { setP(await api.removeTraffic(p.id, id)) } catch (e) { toast.error((e as Error).message) } }
  // Before and after launch, when both exports count the same thing.
  const before = list.find((x) => x.before), after = list.find((x) => !x.before)
  const compare = before && after && before.metric === after.metric ? Math.round((100 * (after.total - before.total)) / Math.max(1, before.total)) : null
  return (
    <ToolCard
      title="Search traffic" cost="from a CSV you export, no account connected"
      status={list.length ? <>{before ? <>Before launch: {before.total.toLocaleString()} {before.metric} ({before.source}, {day(before.at)}). </> : null}{after ? <>After launch: {after.total.toLocaleString()} {after.metric} ({after.source}, {day(after.at)}){compare != null ? <>, <span className="text-foreground">{compare === 0 ? "the same as before" : `${Math.abs(compare)}% ${compare > 0 ? "more" : "fewer"} than before`}</span>. Compare exports that cover the same number of days.</> : "."}</> : null}</>
        : "Export the Pages report from Search Console, or Landing page from GA4 or Google Ads, and drop the CSV here. It ranks the redirect map by real clicks, and keeps a number from before launch to compare with after."}
      action={<>
        <input ref={input} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}Import a CSV</Button>
      </>}
    >
      {list.length > 0 && (
        <div className="grid border-t pt-1">
          {list.map((x) => (
            <div key={x.id} className="group grid min-h-9 grid-cols-[minmax(0,1fr)_110px_110px_90px_24px] items-center gap-3 text-[13px]">
              <span className="truncate">{x.name || x.source}<span className="text-muted-foreground"> · {x.source}</span></span>
              <span className="text-right text-muted-foreground tabular">{x.total.toLocaleString()} {x.metric}</span>
              <span className="text-right text-muted-foreground tabular">{x.pages.toLocaleString()} pages</span>
              <span className="text-right text-muted-foreground">{x.before ? "Before launch" : "After launch"}</span>
              <button onClick={() => remove(x.id)} aria-label="Remove this import" className="grid size-6 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </ToolCard>
  )
}
