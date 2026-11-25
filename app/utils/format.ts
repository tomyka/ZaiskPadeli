/** €42, €40.50 */
export function formatPrice(p: number): string {
  return `€${Number.isInteger(p) ? p : p.toFixed(2)}`
}

/** Lithuanian noun form for a count: 1 kortas, 2 kortai, 10 kortų, 21 kortas. */
export function ltPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2) return few
  return many
}
