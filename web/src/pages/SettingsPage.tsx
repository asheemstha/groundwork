import * as React from "react"
import { cn } from "cn"
import { CalendarPlus, Check, Copy, Download, ExternalLink, Globe, HardDrive, Loader2, RefreshCw, Terminal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { morningLine } from "@/hooks/useMorningNotice"
import { sendFeedback } from "@/components/common/Feedback"
import { store } from "@/lib/store"
import { useTheme } from "@/components/theme-provider"
import { Bar, Dot, Tag, TopBar } from "@/components/common/bits"
import { useApp } from "@/hooks/useApp"
import { api, type EngineId } from "@/lib/api"
import { ago, cap, clock, pct } from "@/lib/format"
import { SkillsSection } from "@/components/settings/Skills"

const SECTIONS = [["you", "You"], ["reminders", "Reminders and calendar"], ["engines", "AI accounts"], ["privacy", "Data and privacy"], ["skills", "AI rules"], ["updates", "Updates"], ["scanning", "Scanning"], ["help", "Help and feedback"]] as const

export function SettingsPage({ focus }: { focus?: EngineId | "privacy" }) {
  const { status } = useApp()
  const [at, setAt] = React.useState<string>("you")
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (focus) document.getElementById(focus === "privacy" ? "s-privacy" : "engine-" + focus)?.scrollIntoView({ behavior: "smooth" }) }, [focus, status])
  // The nav follows the section you've scrolled to.
  React.useEffect(() => {
    const el = scroller.current; if (!el) return
    const on = () => { const top = el.getBoundingClientRect().top + 80; let cur = "you"; for (const [id] of SECTIONS) { const s = document.getElementById("s-" + id); if (s && s.getBoundingClientRect().top <= top) cur = id } setAt(cur) }
    el.addEventListener("scroll", on); return () => el.removeEventListener("scroll", on)
  }, [status])
  if (!status) return null
  const Section = ({ id, title, desc, children }: { id: string; title: string; desc?: React.ReactNode; children: React.ReactNode }) => (
    <section id={"s-" + id} className="scroll-mt-6 pt-10 first:pt-0">
      <h2 className="border-b pb-2 text-[16px] font-medium">{title}</h2>
      {desc && <p className="mt-3 text-[13.5px] text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
  return (
    <div className="flex h-full flex-col">
      <TopBar><span className="px-1.5 text-[14px]">Settings</span></TopBar>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Settings" className="hidden w-52 shrink-0 flex-col gap-px px-3 pt-10 md:flex">
          {SECTIONS.map(([id, label]) => (
            <button key={id} onClick={() => document.getElementById("s-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className={cn("flex h-[30px] items-center rounded-md px-2 text-left text-[14px] hover:bg-muted/60", at === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground")}>{label}</button>
          ))}
        </nav>
        <div ref={scroller} className="scrollbar-thin flex-1 overflow-auto">
          <div className="max-w-3xl px-12 pt-10 pb-16">
            <h1 className="mb-8 text-[32px] leading-tight font-medium">Settings</h1>
            <Section id="you" title="You"><Preferences /></Section>
            <Section id="reminders" title="Reminders and calendar"><Reminders /></Section>
            <Section id="engines" title="AI accounts" desc={<>Optional. The heading and SEO plans run Claude Code or Codex on this computer, signed in to <b className="font-medium text-foreground">your own account</b>, and count toward your Claude or ChatGPT subscription’s limits. Groundwork never sees your password, and nothing goes through a Groundwork server.</>}>
              <div className="grid gap-4"><EngineCard k="claude" highlight={focus === "claude"} /><EngineCard k="codex" highlight={focus === "codex"} /></div>
            </Section>
            <Section id="privacy" title="Data and privacy"><Privacy /></Section>
            <Section id="skills" title="AI rules" desc="The rules each AI plan follows, packaged as a skill (a folder with a SKILL.md). The built-in rules are always here. Add your own to change them, and pick which one each plan uses."><SkillsSection /></Section>
            <Section id="updates" title="Updates"><Updates /></Section>
            <Section id="scanning" title="Scanning">
              <div className="grid gap-px overflow-hidden rounded-xl border bg-border">
                <div className="flex items-center gap-3 bg-card p-4 text-sm"><Globe className="size-4" /><span className="flex-1">Browser for scans</span>{status.browser.ok ? <span className="flex items-center gap-2"><Dot tone="ink" />{status.browser.name}</span> : <span className="text-brand">{status.browser.error}</span>}</div>
              </div>
            </Section>
            <Section id="help" title="Help and feedback"><Help /></Section>
          </div>
        </div>
      </div>
    </div>
  )
}

/** What stays on this Mac and what goes to the AI engine, in plain words. */
function Privacy() {
  const { status } = useApp()
  const row = (title: string, body: React.ReactNode) => (
    <div className="grid gap-1 bg-card p-4 text-[13.5px]"><span className="font-medium">{title}</span><span className="leading-relaxed text-muted-foreground">{body}</span></div>
  )
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border">
      <div className="flex items-center gap-3 bg-card p-4 text-[13.5px]">
        <HardDrive className="size-4 shrink-0" />
        <span className="flex-1"><span className="font-medium">Everything is saved on this Mac.</span> <span className="text-muted-foreground">Projects, checklists, sign-off proof, scans and plans live in Groundwork’s data folder. There’s no Groundwork account or server.</span></span>
        <Button size="sm" variant="outline" onClick={() => api.openData().catch((e) => toast.error(e.message))}>Show in Finder</Button>
      </div>
      <div className="flex items-center gap-3 bg-card p-4 text-[13.5px]">
        <span className="flex-1"><span className="font-medium">Backups.</span> <span className="text-muted-foreground">Save everything as one zip in Documents, Groundwork Backups. To move a single project to another Mac, use Export project in the project’s ⋯ menu.</span></span>
        <BackupButton />
      </div>
      {row("What the AI sees", <>The heading plan and the SEO plan send the pages you chose from a scan (their public text, headings, current titles and descriptions, and a screenshot when a layout is unclear), your notes and the rules they follow to Anthropic (Claude Code) or OpenAI (Codex), through your own account, so that provider’s privacy terms apply. Groundwork runs the AI in that scan’s folder only. {status?.engines.claude.restricted ? "Claude Code is confined to it, so it can’t open your projects, client details, messages, sign-off files or other scans." : "Update Claude Code to confine it to that folder."} Codex (Beta) is pointed at the folder but not confined to it. A few small jobs are optional: reading a project brief you paste in, rewriting a client message in your voice, and suggesting the content inventory’s calls from the old site’s page list (addresses, titles, H1s, word counts and each page’s first lines). Each sends only that text, from an empty folder.</>)}
      {row("Scans and checks", "The site scan, launch check (with its accessibility and speed tests) and redirect tests run in a browser on this Mac. They only visit the addresses you give them, and they don’t use AI. After launch, the live site is checked again on days 3, 7 and 30 while the app is open.")}
      {row("Other connections", "Groundwork checks GitHub for new versions a few times a day. The usage bars ask Claude for your plan’s limits when you refresh them.")}
    </div>
  )
}

/** Where to read more, how to report a problem, and the app details a report needs. */
function Help() {
  const copyDetails = async () => { try { const d = await api.diagnostics(); navigator.clipboard.writeText(d.text); toast("Copied the app details", { description: "Check them before you send them. Error messages can include a site’s address." }) } catch (e) { toast.error((e as Error).message) } }
  const row = (title: string, desc: string, action: React.ReactNode) => (
    <div className="grid gap-3 bg-card p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center"><span><span className="block font-medium">{title}</span><span className="text-muted-foreground">{desc}</span></span>{action}</div>
  )
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-border">
      {row("Send feedback", "What happened, what got in the way, or what you’d change. Groundwork doesn’t collect anything on its own.", <Button size="sm" variant="outline" onClick={() => sendFeedback()}>Send feedback</Button>)}
      {row("App details", "Versions, macOS, the scan browser and recent errors, for a bug report. No project data.", <Button size="sm" variant="outline" onClick={copyDetails}><Copy />Copy</Button>)}
      {row("Guide for testers", "What to try in your first week, and what’s most useful to report.", <Button size="sm" variant="outline" onClick={() => window.open("https://github.com/asheemstha/groundwork/blob/main/TESTING.md")}><ExternalLink />Open</Button>)}
    </div>
  )
}

/** The morning notification, and the calendar feed of launches, sign-offs and due dates. */
function Reminders() {
  const { prefs, setPrefs } = useApp()
  const [items, setItems] = React.useState(false)
  const feed = `${location.host}/api/calendar.ics${items ? "?items=1" : ""}`
  const setNotify = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission().catch(() => {})
    await api.savePrefs({ notify: on }); setPrefs({ notify: on })
    if (on) store.set("notifiedOn", "") // the first one can come today
  }
  const test = async () => {
    const d = await api.home().catch(() => null)
    new Notification("Today in Groundwork", { body: (d && morningLine(d)) || "Nothing is due today." })
  }
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-border">
      <div className="grid gap-3 bg-card p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
        <span><span className="block font-medium">Morning notification</span><span className="text-muted-foreground">Once a day from 9am, while Groundwork is open: what’s due today, what’s late and the messages to send.</span></span>
        <span className="flex items-center gap-3">{prefs.notify && <button onClick={test} className="text-[12.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground">Send a test</button>}<Switch checked={!!prefs.notify} onCheckedChange={setNotify} aria-label="Morning notification" /></span>
      </div>
      <div className="grid gap-3 bg-card p-4 text-sm">
        <span><span className="block font-medium">Calendar</span><span className="text-muted-foreground">Launch days and sign-off dates for every project in Calendar or any app that subscribes to calendars. A subscription refreshes while Groundwork is open.</span></span>
        <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={items} onCheckedChange={(v) => setItems(!!v)} />Include every open item with a due date</label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open("webcal://" + feed)}><CalendarPlus />Subscribe in Calendar</Button>
          <Button size="sm" variant="ghost" onClick={() => { const a = document.createElement("a"); a.href = "/api/calendar.ics" + (items ? "?items=1" : ""); a.download = "groundwork.ics"; a.click() }}><Download />Download .ics</Button>
        </div>
      </div>
    </div>
  )
}

function BackupButton() {
  const [busy, setBusy] = React.useState(false)
  return <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api.backup(); toast.success("Backup saved", { description: r.file.split("/").pop() }) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }}>{busy && <Loader2 className="animate-spin" />}Back up now</Button>
}

function Cmd({ cmd }: { cmd: string }) {
  const [ok, setOk] = React.useState(false)
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#161716] py-2 pr-2 pl-3 tabular text-[13px] text-[#fcfcfb]">
      <span className="text-[#7f7e7a]">$</span><code className="flex-1 overflow-auto whitespace-nowrap">{cmd}</code>
      <button onClick={() => { navigator.clipboard.writeText(cmd); setOk(true); setTimeout(() => setOk(false), 1500) }} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-sans text-xs hover:bg-white/15">
        {ok ? <Check className="size-3" /> : <Copy className="size-3" />}{ok ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

function EngineCard({ k, highlight }: { k: EngineId; highlight?: boolean }) {
  const { status, refreshStatus, setLimits } = useApp()
  const [tab, setTab] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const e = status!.engines[k], cat = status!.catalog[k]
  const step = !e.installed ? 1 : !e.loggedIn ? 2 : 3
  // While setting up, check every few seconds and move on automatically.
  React.useEffect(() => {
    if (step === 3) return
    const t = setInterval(() => refreshStatus(true).catch(() => {}), 4000)
    return () => clearInterval(t)
  }, [step, refreshStatus])
  const prevStep = React.useRef(step)
  React.useEffect(() => { if (prevStep.current < 3 && step === 3) toast.success(`${cat.name} is connected`); prevStep.current = step }, [step, cat.name])

  const w = status!.limits?.windows || {}
  const check = async () => { setBusy(true); try { const l = await api.refreshLimits(); if (l) setLimits(l) } finally { setBusy(false) } }
  const Step = ({ n, title, state, children }: { n: number; title: string; state: "done" | "cur" | "later"; children?: React.ReactNode }) => (
    <div className={cn("grid grid-cols-[28px_1fr] gap-3 py-3", state === "later" && "opacity-50")}>
      <span className={cn("grid size-7 place-items-center rounded-full tabular text-xs font-medium", state === "done" ? "bg-done text-background" : state === "cur" ? "bg-brand text-brand-foreground" : "border")}>{state === "done" ? <Check className="size-3.5" /> : n}</span>
      <div className="min-w-0"><div className="font-medium">{title}</div>{children}</div>
    </div>
  )
  return (
    <section id={"engine-" + k} className={cn("rounded-2xl border bg-card", highlight && "ring-2 ring-brand/40")}>
      <header className="flex items-center gap-3 border-b px-5 py-4">
        <Terminal className="size-5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 font-medium">{cat.name} <span className="font-normal text-muted-foreground">by {cat.vendor}</span>{cat.beta && <span className="tag-label" title="Works, but tested far less than Claude Code">Beta</span>}</div>
          <div className="text-xs text-muted-foreground">Needs {cat.plans}. <a href={cat.plansUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">Plans<ExternalLink className="size-3" /></a></div>
        </div>
        {step === 3 ? <Tag tone="solid"><Check className="size-3" />Ready</Tag> : <Tag tone="bad">{e.installed ? "Not signed in" : "Not installed"}</Tag>}
      </header>
      {step === 3 ? (
        <div className="grid gap-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Account</div><div className="truncate font-medium">{e.account || "Signed in"}</div></div>
            <div><div className="text-xs text-muted-foreground">Plan</div><div className="font-medium">{e.plan ? cap(e.plan) : "–"}</div></div>
            <div><div className="text-xs text-muted-foreground">Billing</div><div className={cn("font-medium", e.billing === "api" && "text-brand-ink")}>{e.billing === "api" ? "API key, per token" : "Subscription"}</div></div>
            <div><div className="text-xs text-muted-foreground">Version</div><div className="tabular text-sm">{e.version || "–"}</div></div>
          </div>
          {k === "claude" && e.billing === "subscription" && (
            <div className="rounded-xl bg-muted p-4">
              <div className="flex items-center gap-2 text-sm font-medium">Plan usage<span className="flex-1" /><Button variant="outline" size="xs" onClick={check} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Check now</Button></div>
              <div className="mt-3 grid gap-2.5">
                {(["five_hour", "seven_day"] as const).map((key) => {
                  const x = w[key]
                  return (
                    <div key={key} className="grid grid-cols-[80px_1fr_60px] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{key === "five_hour" ? "5-hour" : "Weekly"}</span>
                      <Bar value={x ? Math.max(1, pct(x.utilization)) : 0} tone={x && x.utilization > 0.8 ? "brand" : "ink"} className="h-1.5" />
                      <span className="text-right tabular">{x ? `${pct(x.utilization)}%` : "–"}</span>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{status!.limits ? `Checked ${ago(status!.limits.at)}${w.five_hour?.resetsAt ? ` · 5-hour window resets ${clock(w.five_hour.resetsAt * 1000)}` : ""}.` : "Not checked yet."} Read from Claude Code’s own usage reports. “Check now” sends one tiny request.</p>
            </div>
          )}
          {k === "codex" && <p className="text-sm text-muted-foreground">Codex doesn’t share its limits with other apps. Type <code className="tabular">/status</code> in Codex to see yours.</p>}
        </div>
      ) : (
        <div className="px-5 pt-1 pb-4">
          <Step n={1} title={`Install ${cat.name}`} state={step > 1 ? "done" : "cur"}>
            {step > 1 ? <p className="text-sm text-muted-foreground">Installed{e.version ? ` · version ${e.version}` : ""}</p> : (
              <>
                <p className="text-sm text-muted-foreground">Open the Terminal app, paste this and press Return.</p>
                <div className="mt-2 flex gap-1">{cat.install.map((x, i) => <button key={x.label} onClick={() => setTab(i)} className={cn("rounded-md border px-2 py-0.5 text-xs", i === tab ? "border-input bg-muted text-foreground" : "text-muted-foreground")}>{x.label}</button>)}</div>
                <Cmd cmd={cat.install[tab]!.cmd} />
              </>
            )}
          </Step>
          <Step n={2} title="Sign in with your account" state={step > 2 ? "done" : step === 2 ? "cur" : "later"}>
            <p className="text-sm text-muted-foreground">Run this in Terminal. A browser window opens. Sign in with your {cat.vendor === "OpenAI" ? "ChatGPT" : "Claude"} account. An API key works too, but it bills per token.</p>
            <Cmd cmd={cat.login} />
          </Step>
          <Step n={3} title="Ready" state="later"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Checking every few seconds. No need to refresh.</p></Step>
        </div>
      )}
    </section>
  )
}

function Preferences() {
  const { prefs, setPrefs } = useApp()
  const { theme, setTheme } = useTheme()
  const [name, setName] = React.useState(prefs.appliedBy || "")
  React.useEffect(() => setName(prefs.appliedBy || ""), [prefs.appliedBy])
  const [agency, setAgency] = React.useState(prefs.agency || "")
  React.useEffect(() => setAgency(prefs.agency || ""), [prefs.agency])
  const saveAgency = async () => {
    if ((prefs.agency || "") === agency.trim()) return
    await api.savePrefs({ agency: agency.trim() })
    setPrefs({ agency: agency.trim() })
    toast.success("Saved")
  }
  const save = async () => {
    if ((prefs.appliedBy || "") === name.trim()) return
    await api.savePrefs({ appliedBy: name.trim() })
    setPrefs({ appliedBy: name.trim() })
    toast.success("Saved")
  }
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border bg-border">
      <label className="grid gap-3 bg-card p-4 text-sm sm:grid-cols-[1fr_260px] sm:items-center">
        <span><span className="block font-medium">Your name</span><span className="text-muted-foreground">Signs your client messages, and shows on exported guides as the person who applies the changes.</span></span>
        <Input value={name} placeholder="e.g. Alex" onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      </label>
      <label className="grid gap-3 bg-card p-4 text-sm sm:grid-cols-[1fr_260px] sm:items-center">
        <span><span className="block font-medium">Studio or agency name</span><span className="text-muted-foreground">Shows at the top of client status pages.</span></span>
        <Input value={agency} placeholder="e.g. Northwind Studio" onChange={(e) => setAgency(e.target.value)} onBlur={saveAgency} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      </label>
      <div className="grid gap-3 bg-card p-4 text-sm sm:grid-cols-[1fr_260px] sm:items-center">
        <span className="font-medium">Theme</span>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={cn("rounded-md py-1 text-xs font-medium capitalize text-muted-foreground", theme === t && "bg-card text-foreground shadow-sm")}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Updates() {
  const { update, checkUpdate, installUpdate, updating } = useApp()
  const [busy, setBusy] = React.useState(false)
  const check = async () => { setBusy(true); const u = await checkUpdate(); setBusy(false); if (u?.enabled && !u.behind && !u.error) toast.success("Groundwork is up to date") }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium">Groundwork {update?.version}{update?.commit && !update.app && <span className="ml-1 tabular text-xs text-muted-foreground">{update.commit}</span>}</div>
        <div className="text-muted-foreground">
          {!update ? "Checking…" : !update.enabled ? "This copy wasn’t installed from GitHub, so it doesn’t update itself." : update.error ? update.error : update.behind ? `Version ${update.latest || "update"} is ready.` : `Up to date${update.checkedAt ? `, checked ${ago(update.checkedAt)}` : ""}. ${update.app ? "It checks GitHub for new versions every few hours." : "It also updates itself each time it starts."}`}
          {update?.url && <> <a href={update.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">Release notes</a></>}
        </div>
      </div>
      {update?.enabled && (update.behind
        ? <Button onClick={installUpdate} disabled={updating}>{updating ? <Loader2 className="animate-spin" /> : null}Update now</Button>
        : <Button variant="outline" onClick={check} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Check for updates</Button>)}
    </div>
  )
}
