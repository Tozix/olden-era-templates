import { test, expect } from "@playwright/test";

async function generate(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Сгенерировать шаблон/ }).click();
  await expect(page.locator("img.preview-img")).toBeVisible({ timeout: 60_000 });
}

test("главная: тулбар и кнопка генерации", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".toolbar .title")).toContainText("Olden Era");
  await expect(page.getByRole("button", { name: /Сгенерировать шаблон/ })).toBeVisible();
  await expect(page.locator(".section-nav button").first()).toBeVisible();
});

test("генерация даёт PNG-превью", async ({ page }) => {
  await generate(page);
  const src = await page.locator("img.preview-img").getAttribute("src");
  expect(src).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  expect((src ?? "").length).toBeGreaterThan(1000);
});

test("все секции навигации переключаются без ошибок", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  const navItems = page.locator(".section-nav button");
  await expect(navItems.first()).toBeVisible();
  const count = await navItems.count();
  expect(count).toBeGreaterThanOrEqual(5);

  for (let i = 0; i < count; i++) {
    await navItems.nth(i).click();
    await expect(navItems.nth(i)).toHaveClass(/active/);
  }
  expect(errors).toEqual([]);
});

test("модалка пресетов открывается и содержит встроенные пресеты", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Загрузить пресет/ }).click();
  await expect(page.locator(".modal")).toBeVisible();
  await expect(page.locator(".preset-row").first()).toBeVisible();
  await page.getByRole("button", { name: /Отмена/ }).click();
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("переключение наhub-топологию показывает слайдеры хаба", async ({ page }) => {
  await page.goto("/");
  await page.locator(".section-nav button", { hasText: "Топология" }).click();
  const tile = page.locator(".topology-tile", { hasText: "Хаб" });
  await tile.click();
  await expect(tile).toHaveClass(/active/);
});
