/**
 * CSV-кодек для списков SID (T-006): share-кодек переносит только скаляры/строки,
 * поэтому списки сериализуются запятыми. Токены тримятся, пустое → пустой список.
 */

export function parseSidCsv(raw?: string | null): string[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((t) => t.length > 0);
}

export function joinSidCsv(list?: readonly string[] | null): string {
  return list && list.length > 0 ? list.join(",") : "";
}

export function normalizeSidCsv(raw?: string | null): string {
  return joinSidCsv(parseSidCsv(raw));
}
