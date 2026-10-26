/**
 * Путь PNG-соседа для `.rmg.json`: `Foo.rmg.json` → `Foo.png`; прочее — замена расширения.
 */

export function getSidecarPath(rmgJsonPath: string): string {
  if (rmgJsonPath.toLowerCase().endsWith(".rmg.json")) {
    return rmgJsonPath.slice(0, rmgJsonPath.length - ".rmg.json".length) + ".png";
  }
  const dot = rmgJsonPath.lastIndexOf(".");
  return dot > 0 ? rmgJsonPath.slice(0, dot + 1) + "png" : rmgJsonPath + ".png";
}

/** Санитизация имени шаблона для имени файла (аналог InstallerPackager.SanitizeTemplateName). */
export function sanitizeTemplateName(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "").replace(/^[.\s]+|[.\s]+$/g, "");
  return cleaned.length > 0 ? cleaned : "Custom Template";
}
