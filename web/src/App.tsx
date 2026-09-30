import * as React from "react"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/shell/AppShell"
import { AppProvider } from "@/hooks/useApp"
import { RunProvider } from "@/hooks/useRun"
import { useRoute } from "@/lib/router"
import { RunPage } from "@/pages/RunPage"
import { ReviewPage } from "@/pages/ReviewPage"
import { SeoPage } from "@/pages/SeoPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { Dashboard } from "@/pages/Dashboard"
import { ProjectPage } from "@/pages/ProjectPage"
import { TemplatesPage } from "@/pages/TemplatesPage"
import { TemplatePage } from "@/pages/TemplatePage"

/** A page that crashes shows what happened and a way out, instead of a blank window. */
class PageBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-md">
          <p className="text-lg font-medium">Something went wrong on this page</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Your data is safe. Reload to try again, and if it keeps happening, please report it with this message: {e.message}</p>
          <div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => { location.hash = "#/"; location.reload() }}>Go home</Button><Button onClick={() => location.reload()}>Reload</Button></div>
        </div>
      </div>
    )
  }
}

function Routes() {
  const r = useRoute()
  if (r.name === "run" || r.name === "review" || r.name === "seo")
    return <RunProvider key={r.id} id={r.id}>{r.name === "run" ? <RunPage tool={r.tool} /> : r.name === "seo" ? <SeoPage view={r.view} /> : <ReviewPage view={r.view} />}</RunProvider>
  if (r.name === "settings") return <SettingsPage focus={r.engine} />
  if (r.name === "project") return <ProjectPage key={r.id} id={r.id} tab={r.tab} sub={r.sub} />
  if (r.name === "templates") return <TemplatesPage />
  if (r.name === "template") return <TemplatePage key={r.id} id={r.id} />
  return <Dashboard />
}

// Keyed by the address, so moving to another page clears an error.
function RouteBoundary() {
  const [key, setKey] = React.useState(location.hash)
  React.useEffect(() => { const on = () => setKey(location.hash); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on) }, [])
  return <PageBoundary key={key}><Routes /></PageBoundary>
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider>
        <PageBoundary><AppShell><RouteBoundary /></AppShell></PageBoundary>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </AppProvider>
  )
}
