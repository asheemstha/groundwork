import { Check, Palette } from "lucide-react"
import { DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu"
import type { ProjectColor } from "@/lib/api"

export const PROJECT_COLORS: { id: ProjectColor; label: string }[] = [
  { id: "sky", label: "Blue" }, { id: "iris", label: "Purple" }, { id: "teal", label: "Teal" }, { id: "moss", label: "Green" },
  { id: "amber", label: "Yellow" }, { id: "clay", label: "Orange" }, { id: "rose", label: "Pink" }, { id: "slate", label: "Grey" },
]

/** "Colour" in a project's ⋯ menu: the eight project colours, with the current one ticked. */
export function ColorSub({ value, onPick }: { value: ProjectColor; onPick: (c: ProjectColor) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger><Palette /> Colour</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-40">
        {PROJECT_COLORS.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => onPick(c.id)}>
            <span className="grid size-4 place-items-center rounded-[4px] text-[9px] font-medium" style={{ background: `var(--p-${c.id}-tint)`, color: `var(--p-${c.id})` }}>A</span>
            {c.label}
            {value === c.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
