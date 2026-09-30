// The SEO plan's rules (shared/seo.mjs), typed for the app.
import * as shared from "@shared/seo.mjs"
import type { SeoFieldId, SeoPage } from "./api"
import type { Check } from "./checks"

export type SeoTask = { key: string; field: SeoFieldId | "redirect" }
type Edits = Record<string, string> | undefined
export const LIMIT = shared.LIMIT as Record<"title" | "description", number>
export const norm = shared.norm as (s: string) => string
export const normPath = shared.normPath as (s: string) => string
export const value = shared.value as (p: SeoPage, f: SeoFieldId, edits: Edits) => string
export const edited = shared.edited as (p: SeoPage, f: SeoFieldId, edits: Edits) => boolean
export const changed = shared.changed as (p: SeoPage, f: SeoFieldId, edits: Edits) => boolean
export const tasks = shared.tasks as (p: SeoPage, edits: Edits) => SeoTask[]
export const counts = shared.counts as (pages: SeoPage[], done: Record<string, unknown>, edits: Edits) => { tasks: number; done: number }
export const pageChecks = shared.pageChecks as (p: SeoPage, edits: Edits) => Check[]
export const siteChecks = shared.siteChecks as (pages: SeoPage[], edits: Edits) => Check[]
