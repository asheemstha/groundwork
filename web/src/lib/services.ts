// What a person does for clients, from the first run, and the checklists each one puts first.
export const SERVICES: { id: string; label: string; templates: string[] }[] = [
  { id: "websites", label: "Websites", templates: ["website-lean", "website-new", "landing"] },
  { id: "stores", label: "Online stores", templates: ["store"] },
  { id: "care", label: "Care plans", templates: ["care"] },
  { id: "brand", label: "Brand identity", templates: ["brand"] },
  { id: "seo", label: "SEO", templates: ["seo-monthly", "migration"] },
  { id: "ads", label: "Ads or Meta setup", templates: ["ads-setup"] },
  { id: "social", label: "Social content", templates: ["social-month"] },
  { id: "other", label: "Something else", templates: [] },
]
