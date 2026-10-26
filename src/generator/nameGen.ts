import { Rng } from "./rng";

/**
 * Осмысленные русские названия для карт пакетной генерации:
 * прилагательное + существительное из фэнтезийно-походных пулов,
 * дедупликация внутри партии римской цифрой.
 */

const ADJECTIVES = [
  "Пепельные",
  "Костяные",
  "Лунные",
  "Забытые",
  "Серные",
  "Морозные",
  "Кровавые",
  "Туманные",
  "Древние",
  "Проклятые",
  "Вечные",
  "Штормовые",
  "Изумрудные",
  "Обсидиановые",
  "Сумеречные",
  "Янтарные",
  "Ветреные",
  "Полынные",
];

const NOUNS = [
  "равнины",
  "пустоши",
  "перелески",
  "топи",
  "долины",
  "пределы",
  "окраины",
  "утёсы",
  "поймы",
  "хребты",
  "холмы",
  "выжиги",
  "низины",
  "кручи",
];

const ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];

/** Уникальные осмысленные имена; при коллизии — римский суффикс. */
export function generateMapNames(count: number, rng: Rng): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  let guard = count * 40 + 100;
  while (out.length < count && guard-- > 0) {
    const name = `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`;
    if (!used.has(name)) {
      used.add(name);
      out.push(name);
      continue;
    }
    // Коллизия: ищем свободный римский суффикс.
    for (const suffix of ROMAN.slice(1)) {
      const numbered = `${name}${suffix}`;
      if (!used.has(numbered)) {
        used.add(numbered);
        out.push(numbered);
        break;
      }
    }
  }
  // Крайний резерв (пулы исчерпаны): нумерация.
  let n = out.length + 1;
  while (out.length < count) {
    out.push(`Карта ${n}`);
    n++;
  }
  return out;
}
