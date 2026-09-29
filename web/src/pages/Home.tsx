import * as React from "react"
import { ArrowRight, ArrowUp, Cpu, Globe, Loader2, Tag } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Composer } from "@/components/composer/Composer"
import { Logo, Tag as MonoTag, TopBar } from "@/components/common/bits"
import { useApp } from "@/hooks/useApp"
import { api } from "@/lib/api"
import { go, routes } from "@/lib/router"

/** Scanning uses no AI, so the first screen only asks for an address. AI settings come at plan time. */
export function Home() {
  const { status, refreshRuns } = useApp()
  const [url, setUrl] = React.useState("")
  const [name, setName] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => inputRef.current?.focus(), [])

  const submit = async () => {
    if (!url.trim()) return inputRef.current?.focus()
    setBusy(true)
    try {
      const { id } = await api.scan(url.trim(), name.trim() || undefined)
      await refreshRuns()
      go(routes.run(id))
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }
  const E = status?.engines
  const noEngine = E && !(["claude", "codex"] as const).some((k) => E[k].installed && E[k].loggedIn)

  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="text-sm font-medium">New plan</span><span className="flex-1" /><MonoTag tone="muted">Heading structure</MonoTag></TopBar>
      <div className="grid flex-1 place-items-center overflow-auto px-6">
        <div className="flex max-w-2xl flex-col items-center text-center">
          <Logo className="size-10 rounded-xl [&_svg]:size-5" />
          <h1 className="mt-5 text-3xl font-medium tracking-[-0.035em] sm:text-4xl">What site are we planning?</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Paste an address. The scan runs on your Mac and doesn’t use your AI plan. You choose the AI and see the cost before anything is planned.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <MonoTag>01 Scan</MonoTag><ArrowRight className="size-3" /><MonoTag>02 AI plan</MonoTag><ArrowRight className="size-3" /><MonoTag>03 To-do list</MonoTag>
          </div>
        </div>
      </div>
      <Composer
        above={noEngine && (
          <div className="mb-2 flex items-center gap-3 rounded-xl border border-brand/30 bg-card px-3 py-2.5 text-sm">
            <Cpu className="size-4 text-brand" />
            <span className="flex-1"><b>Connect Claude Code or Codex to get plans.</b> <span className="text-muted-foreground">Scanning works without one.</span></span>
            <Button size="sm" variant="outline" onClick={() => go(routes.settings("claude"))}>Set up</Button>
          </div>
        )}
        submit={
          <Button size="icon" className="size-8 rounded-full" onClick={submit} disabled={busy} aria-label="Scan site">
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        }
        footer={<span>Scanning runs on your Mac and doesn’t use your AI plan. The name is for you, e.g. the client’s name. You can change it later.</span>}
      >
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex items-center gap-2 px-3 pt-3 pb-1">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a site address, e.g. client-site.webflow.io"
            aria-label="Site address"
            className="h-8 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80"
          />
          <span className="h-5 w-px shrink-0 bg-border" />
          <Tag className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            aria-label="Site name, optional"
            maxLength={60}
            className="h-8 w-40 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80"
          />
          <button type="submit" hidden />
        </form>
      </Composer>
    </div>
  )
}
