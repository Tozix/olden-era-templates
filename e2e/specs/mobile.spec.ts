import { test, expect } from "@playwright/test";
import { devices } from "@playwright/test";

// Эмулируем мобильный вьюпорт, но на chromium (webkit в CI не ставим).
test.use({ ...devices["iPhone 13"], browserName: "chromium" });

test("мобильный вьюпорт: генерация и превью работают", async ({ page }) => {
  await page.goto("/");
  const generate = page.getByRole("button", { name: /Сгенерировать шаблон/ });
  await expect(generate).toBeVisible();
  await generate.click();
  await expect(page.locator("img.preview-img")).toBeVisible({ timeout: 60_000 });
  const box = await page.locator("img.preview-img").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(50);
});
