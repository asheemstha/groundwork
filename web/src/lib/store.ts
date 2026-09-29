// Per-viewer conveniences in localStorage. Everything that matters lives on the server.
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem("gw." + key)
      return v == null ? fallback : (JSON.parse(v) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem("gw." + key, JSON.stringify(value))
    } catch {
      /* private mode */
    }
  },
}
