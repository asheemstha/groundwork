// The same automatic checks the server runs (shared/checks.mjs), typed for the app.
import * as shared from "@shared/checks.mjs"
import type { ResultPage, Row, Mode } from "./api"

export interface Check { ok: boolean; info?: boolean; text: string; hard?: boolean }

export const isH = shared.isH as (t?: string) => boolean
export const isTask = shared.isTask as (r: Row) => boolean
export const finalRows = shared.finalRows as (rows: Row[]) => Row[]
export const finalText = shared.finalText as (r: Row) => string
export const pageChecks = shared.pageChecks as (p: ResultPage, mode: Mode) => Check[]
export const siteChecks = shared.siteChecks as (pages: ResultPage[], mode: Mode, shared?: string[]) => Check[]
export const phases = shared.phases as (p: ResultPage) => { combined: boolean; rows: (Row & { mode: Mode; phase: 1 | 2 })[] }
export const taskCounts = shared.taskCounts as (pages: ResultPage[], done: Record<string, unknown>) => { tasks: number; done: number; now: { tasks: number; done: number } }
/** The mode whose automatic checks describe the finished site. */
export const finalMode = (p: ResultPage): Mode => (p.modes.optimize ? "optimize" : "live")
