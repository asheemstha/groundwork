import * as React from "react"
import { Check, ExternalLink, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useApp } from "@/hooks/useApp"
import { api, type GoogleStatus } from "@/lib/api"
import { ago } from "@/lib/format"

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">{children}<ExternalLink className="size-3" /></a>
)

/**
 * Search Console and GA4 read in Groundwork, through the user's own Google Cloud project: they make a Desktop app
 * OAuth client once, add its file here, and sign in on Google's page in their browser. Read-only.
 */
export function GoogleSignIn() {
  const { prefs } = useApp()
  const [s, setS] = React.useState<GoogleStatus | null>(null)
  const [waiting, setWaiting] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => { api.google().then(setS).catch(() => {}) }, [])
  // After the browser opens, look every two seconds until Google sends the person back (three minutes at most).
  React.useEffect(() => {
    if (!waiting) return
    const started = Date.now()
    const t = setInterval(async () => {
      const x = await api.google().catch(() => null); if (!x) return
      if (x.signedIn || x.error || Date.now() - started > 180000) { setS(x); setWaiting(false); if (x.signedIn) toast.success(`Signed in to Google${x.email ? " as " + x.email : ""}`) }
    }, 2000)
    return () => clearInterval(t)
  }, [waiting])
  const addFile = async (f?: File) => {
    if (!f) return
    try { setS(await api.googleClient(await f.text())); toast("Added your OAuth client") } catch (e) { toast.error((e as Error).message) } finally { if (input.current) input.current.value = "" }
  }
  const signIn = async () => {
    try { const { url } = await api.googleSignIn(); window.open(url, "_blank"); setS((x) => (x ? { ...x, error: null } : x)); setWaiting(true) } catch (e) { toast.error((e as Error).message) }
  }
  const P = encodeURIComponent(prefs.gcpProject || s?.client?.project || "")
  if (!s) return null
  const missing = s.signedIn ? [!s.searchConsole && "Search Console", !s.analytics && "Analytics"].filter(Boolean) : []
  return (
    <section className="rounded-2xl border bg-card">
      <div className="grid gap-1 p-4">
        <span className="flex flex-wrap items-baseline gap-x-2"><span className="text-[14.5px] font-medium">Search Console and Analytics</span><span className="text-[12.5px] text-muted-foreground">read by Groundwork, with your own Google sign-in</span></span>
        <span className="text-[13px] leading-relaxed text-muted-foreground">Clicks from Search Console and sessions from GA4, by page: the 3 months before launch for the redirect map, the first 28 days after to compare, and each month for a care report. Groundwork only reads, through your own Google Cloud project, and nothing goes through a Groundwork server.</span>
      </div>
      <div className="grid gap-3 border-t px-4 pt-4 pb-5 text-[13.5px] leading-relaxed">
        {s.signedIn ? (
          <>
            <p className="flex items-center gap-2"><Check className="size-4 shrink-0" />Signed in{s.email ? ` as ${s.email}` : ""}{s.at ? `, ${ago(s.at)}` : ""}.</p>
            {missing.length > 0 && <p className="text-destructive">Google wasn’t allowed to share {missing.join(" or ")}. Sign out, sign in again and tick every box on Google’s page.</p>}
            <p className="text-[12.5px] text-muted-foreground">Pick each project’s properties on its Tools tab, under Search traffic. {s.keychain ? "The sign-in is kept in your Mac’s Keychain, so it isn’t in Groundwork’s backups." : ""}</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={async () => setS(await api.googleSignOut())}>Sign out</Button></div>
          </>
        ) : (
          <>
            <ol className="grid list-decimal gap-2 pl-5">
              <li>In the Google Cloud project from the steps below (or a new one), turn on the Google Search Console API, the Google Analytics Admin API and the Google Analytics Data API. <Link href={`https://console.cloud.google.com/apis/library${P ? "?project=" + P : ""}`}>API library</Link></li>
              <li>Make an OAuth client of the type <b className="font-medium">Desktop app</b> and download its JSON. If you made one for the connectors below, use that. <Link href={`https://console.cloud.google.com/auth/clients${P ? "?project=" + P : ""}`}>OAuth clients</Link>
                <span className="mt-1 block text-[12.5px] text-muted-foreground">On the sign-in screen settings, pick Internal if your studio uses Google Workspace. Otherwise pick External, add yourself as a test user and press Publish app on the Audience page, or Google signs Groundwork out every 7 days.</span>
              </li>
              <li>{s.client ? <>Added the client from {s.client.project || "your project"}. <button onClick={() => input.current?.click()} className="underline underline-offset-2 hover:text-foreground">Use a different one</button></> : "Add that JSON file here."}</li>
            </ol>
            <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={(e) => addFile(e.target.files?.[0])} />
            {s.error && <p className="text-destructive">{s.error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {!s.client ? <Button size="sm" variant="outline" onClick={() => input.current?.click()}><Upload />Add the OAuth client file</Button>
                : <Button size="sm" onClick={signIn} disabled={waiting}>{waiting && <Loader2 className="animate-spin" />}{waiting ? "Finish signing in in your browser" : "Sign in with Google"}</Button>}
              {s.client && <span className="text-[12.5px] text-muted-foreground">If Google warns that the app isn’t verified: it’s your own, so press Advanced, then continue.</span>}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
