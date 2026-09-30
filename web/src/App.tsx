import { Toaster } from "@/components/ui/sonner"
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

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider>
        <AppShell><Routes /></AppShell>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </AppProvider>
  )
}
