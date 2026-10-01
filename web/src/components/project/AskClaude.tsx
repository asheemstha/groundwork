import * as React from "react"
import { Check, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, type ConnectorCheck, type ConnectorId, type Project } from "@/lib/api"
import { hostOfUrl } from "@/lib/project"
import { go, routes } from "@/lib/router"

const long = (d: string) => new Date(d + "T00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
const NAMES: Record<ConnectorId, string> = { ga4: "Google Analytics", ads: "Google Ads", meta: "Meta ads", gsc: "Search Console" }
interface Question { id: string; title: string; needs: ConnectorId; text: string; after?: string }

/** The questions, filled in from the project: its domain, launch date, and the account IDs in Accounts and access. */
export function questionsFor(p: Project): Question[] {
  // Before launch, the client's site is the old one; a project with no site at all goes by its name.
  const domain = hostOfUrl(p.sites.live || "") || hostOfUrl(p.sites.old || "") || p.host || ""
  const old = p.sites.old && hostOfUrl(p.sites.old) !== domain ? hostOfUrl(p.sites.old) : ""
  const named = domain || p.name
  const launched = !!p.launched
  const where = (kind: string) => p.accounts.find((a) => a.kind === kind)?.where || ""
  const ga4Id = where("ga4").match(/\b\d{6,12}\b/)?.[0]
  const adsId = where("google-ads").match(/\b\d{3}-?\d{3}-?\d{4}\b/)?.[0]
  const metaId = where("meta").match(/\b(act_)?\d{8,20}\b/)?.[0]
  const site = ga4Id ? `the GA4 property ${ga4Id} (${named})` : `the GA4 property for ${named}`
  const ads = adsId ? `the Google Ads account ${adsId}` : `the Google Ads account that advertises ${named}`
  const meta = metaId ? `the ad account ${metaId}` : `the ad account that advertises ${named}`
  const list: (Question | false)[] = [
    launched && { id: "launch", title: "Before and after the launch", needs: "ga4", text: `Using Google Analytics, compare ${site} for the 28 days before ${long(p.launch!)} and the days since. Show sessions and key events by landing page, and list the pages that lost more than 30% of their sessions. Only read data; don’t change anything.` },
    { id: "events", title: "Key events still recording", needs: "ga4", text: `Using Google Analytics, list every key event on ${site} with its count for each of the last 8 weeks, and point out any that dropped to zero or fell by more than half${launched ? `, especially since the launch on ${long(p.launch!)}` : ""}.` },
    { id: "month", title: "Last month, for the client", needs: "ga4", text: `Using Google Analytics, write a short summary of last month on ${site} for the client, in five plain sentences: visits, where they came from, the top pages, and key events, each compared with the month before. No jargon.` },
    p.website && !!domain && { id: "urls", title: "Where the ads send people", needs: "ads", text: `Using Google Ads, list the final URLs of every enabled ad and sitelink in ${ads} that point to ${domain}${old ? ` or ${old}` : ""}, one per line, with no other text.`, after: "Paste the list into the redirect map’s list test to see that each address lands on a page that loads." },
    { id: "spend", title: "Spend and conversions", needs: "ads", text: `Using Google Ads, show last month’s spend, clicks, conversions and cost per conversion by campaign for ${ads}, and the landing pages each campaign sent people to. Only read data; don’t change anything.` },
    { id: "meta", title: "Meta ads results", needs: "meta", text: `Using the Meta ads connector, report last month’s spend, results and cost per result by campaign for ${meta}. Only read data: don’t create, pause or change anything.` },
  ]
  return list.filter(Boolean) as Question[]
}

/** Questions to paste into Claude Code, for the connectors set up in Settings, Connected data. */
export function AskClaudeDialog({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const [chk, setChk] = React.useState<ConnectorCheck | null>(null)
  React.useEffect(() => { if (open) api.connectors().then(setChk).catch(() => {}) }, [open])
  const qs = questionsFor(p)
  const missing = (["ga4", "ads", "meta"] as ConnectorId[]).filter((id) => !chk?.found[id])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[720px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Ask Claude Code</DialogTitle>
          <DialogDescription>Questions about {p.name}’s traffic, conversions and ads, filled in from the project. Copy one into Claude Code: it answers with the connectors you’ve added to it, and Groundwork never sees the data.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[64vh] gap-3 overflow-auto p-6">
          {qs.map((q) => <QuestionRow key={q.id} q={q} ready={!!chk?.found[q.needs]} />)}
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {chk && missing.length < 3 ? `Claude Code has ${(["ga4", "ads", "meta"] as ConnectorId[]).filter((id) => chk.found[id]).map((id) => NAMES[id]).join(" and ")}. ` : ""}
            {missing.length > 0 && <>To ask about {missing.map((id) => NAMES[id]).join(", ").replace(/, ([^,]*)$/, " or $1")}, set {missing.length === 1 ? "it" : "them"} up first in <button onClick={() => { onClose(); go(routes.settings("connectors")) }} className="underline underline-offset-2 hover:text-foreground">Settings, Connected data</button>. </>}
            Account IDs come from Accounts and access on the Client tab.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function QuestionRow({ q, ready }: { q: Question; ready: boolean }) {
  const [ok, setOk] = React.useState(false)
  const copy = () => { navigator.clipboard.writeText(q.text); setOk(true); setTimeout(() => setOk(false), 1500) }
  return (
    <section className="grid gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[14px] font-medium">{q.title}</h3>
        <span className="text-[12.5px] text-muted-foreground">{NAMES[q.needs]}{ready ? "" : ", not set up yet"}</span>
        <span className="flex-1" />
        <button onClick={copy} className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12.5px] hover:bg-muted">{ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{ok ? "Copied" : "Copy"}</button>
      </div>
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">{q.text}</p>
      {q.after && <p className="text-[12.5px] text-muted-foreground">{q.after}</p>}
    </section>
  )
}
