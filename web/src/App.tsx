import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/shell/AppShell"
import { AppProvider } from "@/hooks/useApp"
import { RunProvider } from "@/hooks/useRun"
import { useRoute } from "@/lib/router"
import { Home } from "@/pages/Home"
import { RunPage } from "@/pages/RunPage"
import { ReviewPage } from "@/pages/ReviewPage"
import { SettingsPage } from "@/pages/SettingsPage"

function Routes() {
  const r = useRoute()
  if (r.name === "run" || r.name === "review")
    return <RunProvider key={r.id} id={r.id}>{r.name === "run" ? <RunPage /> : <ReviewPage view={r.view} />}</RunProvider>
  if (r.name === "settings") return <SettingsPage focus={r.engine} />
  return <Home />
}

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider>
        <AppShell><Routes /></AppShell>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </AppProvider>
  )
}
