/**
 * Общий substring-фильтр пикеров (T-804): пустой фильтр совпадает со всем,
 * иначе — регистронезависимое вхождение в любую из строк-стогов.
 */

export function pickerMatches(
  filter?: string | null,
  ...haystacks: (string | null | undefined)[]
): boolean {
  if (!filter || filter.trim().length === 0) return true;
  if (haystacks.length === 0) return false;
  const needle = filter.trim().toLowerCase();
  for (const h of haystacks) {
    if (!h) continue;
    if (h.toLowerCase().includes(needle)) return true;
  }
  return false;
}
