import * as React from "react"
import { cn } from "cn"
import { Check, ChevronRight, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useApp } from "@/hooks/useApp"
import { api, type ConnectorCheck, type ConnectorId } from "@/lib/api"
import { ago } from "@/lib/format"

/** A command to run in Terminal, with a copy button. */
export function Command({ cmd, note }: { cmd: string; note?: string }) {
  const [ok, setOk] = React.useState(false)
  return (
    <div className="mt-2 grid gap-1">
      <div className="flex items-start gap-2 rounded-lg bg-[#161716] py-2 pr-2 pl-3 text-[13px] text-[#fcfcfb]">
        <code className="flex-1 font-sans leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{cmd}</code>
        <button onClick={() => { navigator.clipboard.writeText(cmd); setOk(true); setTimeout(() => setOk(false), 1500) }} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/15">
          {ok ? <Check className="size-3" /> : <Copy className="size-3" />}{ok ? "Copied" : "Copy"}
        </button>
      </div>
      {note && <span className="text-[12.5px] text-muted-foreground">{note}</span>}
    </div>
  )
}

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">{children}<ExternalLink className="size-3" /></a>
)

const STATE: Record<"connected" | "auth" | "failed", string> = { connected: "Set up in Claude Code", auth: "Added, needs signing in (type /mcp in Claude Code)", failed: "Added, but it didn’t start" }
const ADC = "$HOME/.config/gcloud/application_default_credentials.json"

/**
 * Settings, Connected data: how to add Google's and Meta's official connectors to your own Claude Code, so you can ask
 * it about a client's traffic, conversions and ads. Groundwork never connects to them; it checks which ones Claude Code
 * has when asked, and each project writes the questions.
 */
export function ConnectorsSection() {
  const { prefs, setPrefs } = useApp()
  const [chk, setChk] = React.useState<ConnectorCheck | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [proj, setProj] = React.useState(prefs.gcpProject || "")
  const [withAds, setWithAds] = React.useState(false)
  React.useEffect(() => { api.connectors().then(setChk).catch(() => {}) }, [])
  const check = async () => { setBusy(true); try { setChk(await api.checkConnectors()) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }
  const saveProj = () => { const v = proj.trim(); if ((prefs.gcpProject || "") !== v) { api.savePrefs({ gcpProject: v }).catch(() => {}); setPrefs({ gcpProject: v }) } }
  const P = proj.trim() || "YOUR_PROJECT_ID"
  const scopes = ["https://www.googleapis.com/auth/analytics.readonly", ...(withAds ? ["https://www.googleapis.com/auth/adwords"] : []), "https://www.googleapis.com/auth/cloud-platform"].join(",")
  const signIn = `gcloud auth application-default login --scopes ${scopes} --client-id-file=$HOME/Downloads/google-client.json`
  const found = (id: ConnectorId) => chk?.found[id]
  const googleSetup = (
    <>
      <Step n={1}>Make a Google Cloud project, or use one you have, and type its ID here. <Link href="https://console.cloud.google.com/projectcreate">New project</Link>
        <Input value={proj} onChange={(e) => setProj(e.target.value)} onBlur={saveProj} placeholder="Project ID, like studio-data-123" spellCheck={false} className="mt-2 h-8 max-w-xs text-[13px]" />
      </Step>
      <Step n={2}>Turn on the Google Analytics Admin API and the Google Analytics Data API{withAds ? ", and the Google Ads API" : ""}. <Link href={`https://console.cloud.google.com/apis/library?project=${encodeURIComponent(P)}`}>API library</Link></Step>
      <Step n={3}>Make an OAuth client of the type <b className="font-medium">Desktop app</b>, download its JSON and rename it google-client.json in Downloads. <Link href={`https://console.cloud.google.com/auth/clients?project=${encodeURIComponent(P)}`}>OAuth clients</Link>
        <span className="mt-1 block text-[12.5px] text-muted-foreground">Google asks you to set up the sign-in screen first. Pick Internal if your studio uses Google Workspace. Otherwise pick External, add yourself as a test user, then press Publish app on the Audience page, or you’ll have to sign in again every 7 days. Google warns that the app isn’t verified: it’s your own, so continue.</span>
      </Step>
      <Step n={4}>Install pipx and Google’s command line tool, if you haven’t. <Link href="https://cloud.google.com/sdk/docs/install">Install gcloud</Link><Command cmd="brew install pipx && pipx ensurepath" /></Step>
      <Step n={5}>Sign in with the Google account that can see your clients’ Analytics{withAds ? " and Ads" : ""}.
        <label className="mt-2 flex items-center gap-2 text-[13px]"><Checkbox checked={withAds} onCheckedChange={(v) => setWithAds(!!v)} />I’ll use Google Ads too</label>
        <Command cmd={signIn} />
      </Step>
    </>
  )
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
        <span className="flex-1">{!chk ? "Not checked yet." : !chk.installed ? "Claude Code isn’t installed on this Mac." : `Checked ${ago(chk.at)}.`}{chk?.error && ` ${chk.error}`}</span>
        <Button size="sm" variant="outline" onClick={check} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}{busy ? "Checking, this can take a minute" : "Check Claude Code"}</Button>
      </div>

      <Card title="Google Analytics" by="Google’s own, reads only" what="Visits, where they came from, landing pages and key events, for any GA4 property you can see." state={found("ga4")?.state}>
        {googleSetup}
        <Step n={6}>Add it to Claude Code.<Command cmd={`claude mcp add analytics-mcp --scope user -e GOOGLE_APPLICATION_CREDENTIALS=${ADC} -e GOOGLE_PROJECT_ID=${P} -- pipx run analytics-mcp`} /></Step>
      </Card>

      <Card title="Google Ads" by="Google’s own, reads only" what="Spend, clicks, conversions and the final URLs of ads, for accounts under your manager account." state={found("ads")?.state}>
        <p className="text-[13px] text-muted-foreground">Needs a developer token from a Google Ads manager account (Admin, then API Center) with at least Explorer access. A new token only reaches test accounts until you apply for more. Do the Google Analytics steps first, with “I’ll use Google Ads too” ticked.</p>
        <Step n={1}>Add it to Claude Code. Replace YOUR_TOKEN and YOUR_MANAGER_ID (10 digits, no dashes) before you run it. Groundwork doesn’t keep the token.
          <Command cmd={`claude mcp add google-ads-mcp --scope user -e GOOGLE_APPLICATION_CREDENTIALS=${ADC} -e GOOGLE_PROJECT_ID=${P} -e GOOGLE_ADS_DEVELOPER_TOKEN=YOUR_TOKEN -e GOOGLE_ADS_LOGIN_CUSTOMER_ID=YOUR_MANAGER_ID -- pipx run --spec git+https://github.com/googleads/google-ads-mcp.git google-ads-mcp`} />
        </Step>
      </Card>

      <Card title="Meta ads" by="Meta’s own, in beta, can change ads" what="Spend, results and cost per result by campaign. It can also create campaigns and change budgets, so ask it for reports, and read what Claude Code wants to do before you allow it." state={found("meta")?.state}>
        <p className="text-[13px] text-muted-foreground">Needs a Meta developer app for its App ID (<Link href="https://developers.facebook.com/apps">Meta for Developers</Link>). Meta is opening it to ad accounts in stages, so yours may not have it yet.</p>
        <Step n={1}>Add it to Claude Code, with your App ID in place of YOUR_META_APP_ID.<Command cmd="claude mcp add --transport http --scope user --client-id YOUR_META_APP_ID meta-ads https://mcp.facebook.com/ads" /></Step>
        <Step n={2}>In Claude Code, type /mcp, pick meta-ads and sign in with Facebook.</Step>
      </Card>

      <Card title="Search Console" by="No connector from Google" what="Google doesn’t publish one for Search Console. Import a Search Console export on a project’s Tools tab: the redirect map and the care report use it." state={found("gsc")?.state} plain />

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">The connectors run inside Claude Code on this Mac, with your access to the client’s accounts, and Anthropic’s, Google’s and Meta’s terms apply. Groundwork doesn’t connect to Google or Meta and never sees the data: it writes the questions, in each project’s ⋯ menu under Ask Claude Code. Checking runs “claude mcp list”, which starts each connector you’ve added to see that it answers.</p>
    </div>
  )
}

function Card({ title, by, what, state, plain, children }: { title: string; by: string; what: string; state?: "connected" | "auth" | "failed"; plain?: boolean; children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <section className="rounded-2xl border bg-card">
      <button onClick={() => !plain && setOpen(!open)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left", !plain && "hover:bg-muted/30")}>
        <span className="grid gap-1">
          <span className="flex flex-wrap items-baseline gap-x-2"><span className="text-[14.5px] font-medium">{title}</span><span className="text-[12.5px] text-muted-foreground">{by}</span></span>
          <span className="text-[13px] leading-relaxed text-muted-foreground">{what}</span>
          {state && <span className={cn("mt-0.5 flex items-center gap-1.5 text-[13px]", state === "failed" && "text-destructive")}>{state === "connected" && <Check className="size-3.5" />}{STATE[state]}</span>}
        </span>
        {!plain && <span className="flex items-center gap-1 pt-0.5 text-[12.5px] text-muted-foreground">{state === "connected" ? "Steps" : "Set up"}<ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} /></span>}
      </button>
      {open && children && <div className="grid gap-4 border-t px-4 pt-4 pb-5">{children}</div>}
    </section>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[13.5px] leading-relaxed">
      <span className="grid size-[22px] place-items-center rounded-full bg-muted text-[12px] tabular text-muted-foreground">{n}</span>
      <div className="min-w-0 pt-px">{children}</div>
    </div>
  )
}
