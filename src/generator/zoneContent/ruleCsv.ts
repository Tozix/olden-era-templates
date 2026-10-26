import type { ZoneContentRule } from "../settings";

/**
 * Порт ZoneContentRuleCsv: кодек per-row «rules» CSV для хост-UI (T-202).
 * Форма одной строкой: `Type|args1/args2|min|max|weight; Type|...`
 * У каждой правила 5 полей, разделитель `|`; args — подсписок через `/`
 * (может быть пустым). Десятичные числа — invariant culture, чтобы
 * локаль с запятой-разделителем не конфликтовала с разделителем правил.
 * Битые токены молча отбрасываются — round-trip ручного .oetgs не должен
 * падать. ZoneContentItem.rules остаётся авторитетной формой в памяти.
 */

const RULE_SEPARATOR = ";";
const FIELD_SEPARATOR = "|";
const ARG_SEPARATOR = "/";

/** Разбор CSV-строки в список правил. Пустой ввод → пустой список; битые записи пропускаются. */
export function parseRulesCsv(raw: string | null | undefined): ZoneContentRule[] {
  const result: ZoneContentRule[] = [];
  if (!raw || raw.trim().length === 0) return result;

  for (const part of raw.split(RULE_SEPARATOR)) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;

    const fields = trimmed.split(FIELD_SEPARATOR);
    // Type обязателен. Остальные поля по умолчанию «не заданы».
    const type = fields[0].trim();
    if (type.length === 0) continue;

    const rule: ZoneContentRule = { type, args: [] };
    if (fields.length >= 2) {
      const argsRaw = fields[1];
      if (argsRaw.length > 0) {
        for (const a of argsRaw.split(ARG_SEPARATOR)) {
          const t = a.trim();
          if (t.length > 0) rule.args.push(t);
        }
      }
    }
    if (fields.length >= 3) rule.targetMin = parseDouble(fields[2]);
    if (fields.length >= 4) rule.targetMax = parseDouble(fields[3]);
    if (fields.length >= 5) rule.weight = parseDouble(fields[4]);

    result.push(rule);
  }
  return result;
}

/** Рендер списка в памяти в однострочную CSV-форму. */
export function joinRulesCsv(rules: readonly ZoneContentRule[] | null | undefined): string {
  if (!rules || rules.length === 0) return "";
  const parts: string[] = [];
  for (const r of rules) {
    parts.push(
      (r.type ?? "") +
        FIELD_SEPARATOR +
        r.args.join(ARG_SEPARATOR) +
        FIELD_SEPARATOR +
        formatDouble(r.targetMin) +
        FIELD_SEPARATOR +
        formatDouble(r.targetMax) +
        FIELD_SEPARATOR +
        formatDouble(r.weight),
    );
  }
  return parts.join("; ");
}

function parseDouble(raw: string): number | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  const v = Number(t); // строгий invariant-парсинг: «1.5» ок, «1,5»/«abc» → NaN
  return Number.isFinite(v) ? v : null;
}

function formatDouble(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}
