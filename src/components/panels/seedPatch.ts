import { useApp } from "../../state/settingsStore";

/** Сидирует seed в SettingsFile через стор (маппер seed не переносит — как в C#). */
export function patchSeed(seed: number): void {
  useApp.getState().patch((f) => {
    f.seed = seed;
  });
}

/** Снимает seed (null) — «случайный при каждой генерации». */
export function clearSeed(): void {
  useApp.getState().patch((f) => {
    f.seed = null;
  });
}
