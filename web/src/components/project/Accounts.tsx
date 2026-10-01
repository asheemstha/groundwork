import * as React from "react"
import { cn } from "cn"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { api, type Account, type Project } from "@/lib/api"

const OWNERS: [Account["owner"], string][] = [["", "Not set"], ["client", "Client"], ["us", "Us"], ["none", "Not used"]]

/**
 * Every account the work depends on: where it is, who owns it, the login it's under (never a password), whether we
 * have access, and whether our access comes off at handoff. It goes into the handoff document.
 */
export function AccountsSection({ p, setP }: { p: Project; setP: (x: Project) => void }) {
  const [list, setList] = React.useState<Account[]>(p.accounts)
  React.useEffect(() => setList(p.accounts), [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next: Account[]) => { setList(next); try { setP(await api.setAccounts(p.id, next)) } catch (e) { toast.error((e as Error).message) } }
  const change = (i: number, patch: Partial<Account>, now = true) => { const next = list.map((a, j) => (j === i ? { ...a, ...patch } : a)); if (now) save(next); else setList(next) }
  const used = list.filter((a) => a.owner !== "none")
  const set = used.filter((a) => a.owner).length, ours = list.filter((a) => a.access && a.revoke).length
  const cols = "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_104px_minmax(0,1.2fr)_76px_92px_24px]"
  return (
    <section className="grid gap-2 px-12 pb-12">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-medium">Accounts and access</h2>
        <span className="text-[13px] text-muted-foreground">{set} of {used.length} with an owner{ours ? `, ${ours} of ours to remove at handoff` : ""}</span>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">Who owns each account the site depends on, and the login it’s under. This goes into the handoff document. Never put a password here: keep those in a password manager.</p>
      <div className="mt-1 text-[13.5px]">
        <div className={cn("grid h-[30px] items-center gap-3 border-b text-[12.5px] text-muted-foreground", cols)}><span>Account</span><span>Where</span><span>Owner</span><span>Login (email or user name)</span><span className="text-center">We have access</span><span className="text-center">Remove at handoff</span><span /></div>
        {list.map((a, i) => (
          <div key={a.id} className={cn("grid min-h-11 items-center gap-3 border-b border-border/60", cols, a.owner === "none" && "text-muted-foreground")}>
            {a.kind === "custom" ? <input value={a.name} onChange={(e) => change(i, { name: e.target.value }, false)} onBlur={() => save(list)} aria-label="Account" className="-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none hover:bg-muted/60 focus:bg-muted/60" /> : <span className="truncate">{a.name}</span>}
            <input value={a.where} onChange={(e) => change(i, { where: e.target.value }, false)} onBlur={() => save(list)} disabled={a.owner === "none"} placeholder={a.kind === "registrar" ? "e.g. Namecheap" : a.kind === "dns" ? "e.g. Cloudflare" : ""} aria-label={`Where ${a.name} is`} className="-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-muted/60" />
            <select value={a.owner} onChange={(e) => change(i, { owner: e.target.value as Account["owner"] })} aria-label={`Who owns ${a.name}`} className={cn("h-8 rounded-md border border-transparent bg-transparent px-1 text-[13px] hover:border-input", !a.owner && "text-muted-foreground")}>
              {OWNERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={a.login} onChange={(e) => change(i, { login: e.target.value }, false)} onBlur={() => save(list)} disabled={a.owner === "none"} autoComplete="off" spellCheck={false} aria-label={`Login for ${a.name}`} className="-ml-1.5 h-8 min-w-0 rounded-md bg-transparent px-1.5 outline-none hover:bg-muted/60 focus:bg-muted/60" />
            <span className="grid place-items-center"><Checkbox checked={a.access} disabled={a.owner === "none"} onCheckedChange={(v) => change(i, { access: !!v, revoke: v ? a.revoke : false })} aria-label={`We have access to ${a.name}`} /></span>
            <span className="grid place-items-center"><Checkbox checked={a.revoke} disabled={!a.access || a.owner === "us" || a.owner === "none"} onCheckedChange={(v) => change(i, { revoke: !!v })} aria-label={`Remove our access to ${a.name} at handoff`} /></span>
            {a.kind === "custom" ? <button onClick={() => save(list.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button> : <span />}
          </div>
        ))}
        <button onClick={() => save([...list, { id: "a" + Date.now().toString(36), kind: "custom", name: "New account", where: "", owner: "", login: "", access: false, revoke: false, note: "" }])} className="mt-2 inline-flex h-7 items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="size-3.5" />Add an account</button>
      </div>
    </section>
  )
}
