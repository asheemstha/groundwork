import { useSyncExternalStore } from "react"

export type Route =
  | { name: "home" }
  | { name: "settings"; engine?: "claude" | "codex" }
  | { name: "run"; id: string }
  | { name: "review"; id: string; view: string }

function parse(): Route {
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean).map(decodeURIComponent)
  if (parts[0] === "settings") return { name: "settings", engine: parts[1] === "codex" ? "codex" : parts[1] === "claude" ? "claude" : undefined }
  if (parts[0] === "run" && parts[1]) {
    if (parts[2] === "review") return { name: "review", id: parts[1], view: parts[3] || "overview" }
    return { name: "run", id: parts[1] }
  }
  return { name: "home" }
}

let current = parse()
const subs = new Set<() => void>()
window.addEventListener("hashchange", () => {
  current = parse()
  subs.forEach((f) => f())
})

export const useRoute = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => current
  )

export const go = (path: string) => {
  location.hash = "#" + path
}
export const routes = {
  home: "/",
  settings: (engine?: string) => (engine ? `/settings/${engine}` : "/settings"),
  run: (id: string) => `/run/${id}`,
  review: (id: string, view = "overview") => `/run/${id}/review/${encodeURIComponent(view)}`,
}
