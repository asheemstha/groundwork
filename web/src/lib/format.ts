export const fmtDur = (s?: number | null) => {
  s = Math.max(0, Math.round(s || 0))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim()
}
export const fmtClock = (s?: number | null) => {
  s = Math.max(0, Math.round(s || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
export const fmtRange = (s: number) => {
  const lo = Math.max(1, Math.round((s * 0.8) / 60))
  const hi = Math.max(lo + 1, Math.round((s * 1.3) / 60))
  return `${lo}–${hi} min`
}
export const fmtTok = (n?: number) => (!n ? "0" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))
export const ago = (t?: number) => {
  if (!t) return ""
  const s = (Date.now() - t) / 1000
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" })
}
export const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
export const pct = (x?: number) => Math.round((x || 0) * 100)
export const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : many || one + "s"}`
export const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "")
  } catch {
    return u
  }
}
export const initials = (name?: string | null) =>
  (name || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
export const cap = (s?: string | null) => (s ? s[0]!.toUpperCase() + s.slice(1) : "")
