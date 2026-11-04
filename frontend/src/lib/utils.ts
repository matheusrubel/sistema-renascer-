/** Junta classes CSS ignorando valores vazios (equivalente enxuto ao `cn` do shadcn). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
