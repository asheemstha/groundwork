import { useSyncExternalStore } from "react"

export type Route =
  | { name: "home" }
  | { name: "project"; id: string; tab: "checklist" | "client" | "tools" | "money" | "launch" | "redirects" | "inventory"; sub?: string; item?: string }
  | { name: "time"; project?: string }
  | { name: "templates" }
  | { name: "template"; id: string }
  | { name: "settings"; engine?: "claude" | "codex" | "privacy" | "connectors" }
  | { name: "run"; id: string; tool?: "seo" | "headings" }
  | { name: "review"; id: string; view: string }
  | { name: "seo"; id: string; view: string }

function parse(): Route {
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean).map(decodeURIComponent)
  if (parts[0] === "project" && parts[1] && parts[2] === "item") return { name: "project", id: parts[1], tab: "checklist", item: parts[3] }
  if (parts[0] === "project" && parts[1]) return { name: "project", id: parts[1], tab: parts[2] === "client" || parts[2] === "tools" || parts[2] === "money" || parts[2] === "launch" || parts[2] === "redirects" || parts[2] === "inventory" ? parts[2] : "checklist", sub: parts[3] }
  if (parts[0] === "time") return { name: "time", project: parts[1] }
  if (parts[0] === "templates") return parts[1] ? { name: "template", id: parts[1] } : { name: "templates" }
  if (parts[0] === "settings") return { name: "settings", engine: parts[1] === "codex" || parts[1] === "claude" || parts[1] === "privacy" || parts[1] === "connectors" ? parts[1] : undefined }
  if (parts[0] === "run" && parts[1]) {
    if (parts[2] === "review") return { name: "review", id: parts[1], view: parts[3] || "overview" }
    if (parts[2] === "seo") return { name: "seo", id: parts[1], view: parts[3] || "all" }
    return { name: "run", id: parts[1], tool: parts[2] === "tool" && (parts[3] === "seo" || parts[3] === "headings") ? parts[3] : undefined }
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
  project: (id: string, tab?: "client" | "tools" | "money" | "redirects" | "inventory") => `/project/${id}${tab ? "/" + tab : ""}`,
  /** A checklist item, opened in the side panel. */
  item: (id: string, itemId: string) => `/project/${id}/item/${itemId}`,
  /** A phase of the checklist, scrolled to its sign-off. */
  phase: (id: string, phaseId: string) => `/project/${id}/checklist/${phaseId}`,
  /** The Client tab set up for a reminder: the late items already asked for, with the reminder template. */
  remind: (id: string) => `/project/${id}/client/remind`,
  /** The Client tab, at the files to get from the client. */
  clientFiles: (id: string) => `/project/${id}/client/files`,
  /** The Client tab set up for the weekly update. */
  clientUpdate: (id: string) => `/project/${id}/client/update`,
  launch: (id: string, checkId?: string, check?: string) => `/project/${id}/launch${checkId ? "/" + checkId + (check ? "?" + check : "") : ""}`,
  /** The work log, for every project or just one. */
  time: (project?: string | null) => (project ? `/time/${project}` : "/time"),
  templates: "/templates",
  template: (id: string) => `/templates/${id}`,
  settings: (engine?: string) => (engine ? `/settings/${engine}` : "/settings"),
  /** A scan, or with `tool` the page that plans headings or SEO from it. */
  run: (id: string, tool?: "seo" | "headings") => `/run/${id}${tool ? "/tool/" + tool : ""}`,
  seo: (id: string, view?: string) => `/run/${id}/seo${view ? "/" + encodeURIComponent(view) : ""}`,
  review: (id: string, view = "overview") => `/run/${id}/review/${encodeURIComponent(view)}`,
}
