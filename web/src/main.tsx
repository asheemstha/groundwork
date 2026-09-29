import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"

// Inside the desktop app: make room for the window buttons and let the top edge drag the window.
if (/Electron/.test(navigator.userAgent)) document.documentElement.classList.add("desktop")
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
)
