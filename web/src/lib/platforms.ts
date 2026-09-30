// Website platforms for the app: names, staging addresses and redirect export formats (shared/platforms.json).
import data from "@shared/platforms.json"

export type PlatformId = "webflow" | "wordpress" | "shopify" | "framer" | "squarespace" | "wix" | "custom"
export type RedirectFormat = "webflow" | "shopify" | "wordpress" | "squarespace" | "framer" | "wix" | "netlify" | "vercel" | "htaccess" | "nginx"
export interface Platform { id: PlatformId; name: string; staging: string[]; redirects: RedirectFormat[] }

export const PLATFORMS = data.list as Platform[]
export const platformOf = (id?: string | null) => PLATFORMS.find((p) => p.id === id) || null
const RES = PLATFORMS.map((p) => ({ id: p.id, re: p.staging.map((s) => new RegExp(s, "i")) }))
const clean = (h: string) => h.toLowerCase().replace(/^www\./, "")
/** True for a platform's staging or preview address, like *.webflow.io or *.myshopify.com. */
export const isStagingHost = (host?: string | null) => !!host && RES.some((p) => p.re.some((r) => r.test(clean(host))))

/** An example staging address for a platform, for placeholders. */
export const stagingExample = (id?: string | null) =>
  ({ webflow: "new-site.webflow.io", shopify: "store-name.myshopify.com", framer: "new-site.framer.app", squarespace: "site-name.squarespace.com", wix: "name.wixsite.com/site", wordpress: "staging address from your host", custom: "preview or staging address" } as Record<string, string>)[id || ""] || "staging address"

// ---------- redirect exports ----------
/** A whole folder that moved with every page keeping its slug: /blog/x to /articles/x. */
export interface MovedFolder { oldPrefix: string; newPrefix: string }
interface FormatInfo {
  name: string
  file: string
  mime: string
  /** Steps to import it on the platform. */
  how: string[]
  /** It can hold one rule for a moved folder. */
  rules: boolean
  /** Importing replaces every redirect already on the site. */
  replaces?: boolean
  note?: string
}
export const FORMATS: Record<RedirectFormat, FormatInfo> = {
  webflow: { name: "Webflow (CSV)", file: "redirects.csv", mime: "text/csv", rules: true, replaces: true, how: ["In Webflow: Site settings, Publishing, 301 redirects, Import. Choose this file.", "Publish the site, then test the redirects here."] },
  shopify: { name: "Shopify (CSV)", file: "redirects.csv", mime: "text/csv", rules: false, how: ["In Shopify admin, open URL redirects (search for it), choose Import and pick this file.", "Test the redirects here once the store is live."], note: "Shopify only redirects addresses that no longer exist on the store." },
  wordpress: { name: "WordPress, Redirection plugin (CSV)", file: "redirects.csv", mime: "text/csv", rules: true, how: ["Install the free Redirection plugin if the site doesn’t have it.", "Tools, Redirection, Import/Export: import this file.", "Test the redirects here."] },
  squarespace: { name: "Squarespace (URL mappings)", file: "url-mappings.txt", mime: "text/plain", rules: true, how: ["Open URL mappings in the site’s settings (search for “URL mappings”).", "Paste these lines, save, then test the redirects here."] },
  framer: { name: "Framer (rules to add)", file: "framer-redirects.txt", mime: "text/plain", rules: true, how: ["Framer has no import. In Site settings, Redirects, add each rule below with its from and to paths.", "Publish, then test the redirects here."] },
  wix: { name: "Wix (CSV)", file: "redirects.csv", mime: "text/csv", rules: false, how: ["Open Wix’s URL Redirect Manager, choose Import and pick this file. It takes up to 500 redirects at a time.", "Test the redirects here."], note: "If Wix doesn’t accept the columns, download its own template and paste these rows into it." },
  netlify: { name: "Netlify (_redirects)", file: "_redirects", mime: "text/plain", rules: true, how: ["Put this file in the folder you deploy, often public/.", "Deploy, then test the redirects here."] },
  vercel: { name: "Vercel (vercel.json)", file: "vercel.json", mime: "application/json", rules: true, how: ["Merge the redirects list into the project’s vercel.json.", "Deploy, then test the redirects here."] },
  htaccess: { name: "Apache (.htaccess)", file: "htaccess.txt", mime: "text/plain", rules: true, how: ["Add these lines to the site’s .htaccess file, above any other rewrite rules.", "Test the redirects here."] },
  nginx: { name: "nginx", file: "nginx-redirects.conf", mime: "text/plain", rules: true, how: ["Add these lines inside the site’s server block and reload nginx.", "Test the redirects here."] },
}
/** Formats to offer for a platform, its own first. */
export const formatsFor = (id?: string | null): RedirectFormat[] => {
  const own = platformOf(id)?.redirects || ["webflow"]
  return [...own, ...(Object.keys(FORMATS) as RedirectFormat[]).filter((f) => !own.includes(f))]
}

const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const rx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * The redirects in a platform's format. `rows` are single old-to-new paths; `folders` are whole moved folders, written as
 * one pattern rule where the format has them (after the single lines, so exact matches win), else expanded by the caller.
 * `header` keeps the header row of a file being merged (Webflow's own export).
 */
export function renderRedirects(format: RedirectFormat, rows: [string, string][], folders: MovedFolder[], header?: string | null): string {
  const lines: string[] = []
  switch (format) {
    case "webflow":
      if (header) lines.push(header)
      rows.forEach(([a, b]) => lines.push(`${q(a)},${q(b)}`))
      folders.forEach((f) => lines.push(`${q(f.oldPrefix + "/(.*)")},${q(f.newPrefix + "/%1")}`))
      return lines.join("\r\n") + "\r\n"
    case "shopify":
      lines.push("Redirect from,Redirect to")
      rows.forEach(([a, b]) => lines.push(`${q(a)},${q(b)}`))
      return lines.join("\r\n") + "\r\n"
    case "wix":
      lines.push("Old URL,New URL")
      rows.forEach(([a, b]) => lines.push(`${q(a)},${q(b)}`))
      return lines.join("\r\n") + "\r\n"
    case "wordpress":
      rows.forEach(([a, b]) => lines.push(`${q(a)},${q(b)},0,301`))
      folders.forEach((f) => lines.push(`${q("^" + rx(f.oldPrefix) + "/(.*)$")},${q(f.newPrefix + "/$1")},1,301`))
      return lines.join("\r\n") + "\r\n"
    case "squarespace":
      rows.forEach(([a, b]) => lines.push(`${a} -> ${b} 301`))
      folders.forEach((f) => lines.push(`${f.oldPrefix}/[name] -> ${f.newPrefix}/[name] 301`))
      return lines.join("\n") + "\n"
    case "framer":
      rows.forEach(([a, b]) => lines.push(`${a}  →  ${b}`))
      folders.forEach((f) => lines.push(`${f.oldPrefix}/*  →  ${f.newPrefix}/:1`))
      return lines.join("\n") + "\n"
    case "netlify":
      rows.forEach(([a, b]) => lines.push(`${a}  ${b}  301`))
      folders.forEach((f) => lines.push(`${f.oldPrefix}/*  ${f.newPrefix}/:splat  301`))
      return lines.join("\n") + "\n"
    case "vercel":
      return JSON.stringify({ redirects: [...rows.map(([a, b]) => ({ source: a, destination: b, permanent: true })), ...folders.map((f) => ({ source: `${f.oldPrefix}/:path*`, destination: `${f.newPrefix}/:path*`, permanent: true }))] }, null, 2) + "\n"
    case "htaccess":
      rows.forEach(([a, b]) => lines.push(`Redirect 301 ${a} ${b}`))
      folders.forEach((f) => lines.push(`RedirectMatch 301 ^${rx(f.oldPrefix)}/(.*)$ ${f.newPrefix}/$1`))
      return lines.join("\n") + "\n"
    case "nginx":
      rows.forEach(([a, b]) => lines.push(`location = ${a} { return 301 ${b}; }`))
      folders.forEach((f) => lines.push(`location ~ ^${rx(f.oldPrefix)}/(.*)$ { return 301 ${f.newPrefix}/$1; }`))
      return lines.join("\n") + "\n"
  }
}
