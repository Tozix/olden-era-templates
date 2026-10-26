// Визуальный обход UI: скриншоты ключевых состояний для критики.
// Использование: npm run build && npx vite preview ... уже запущен, затем node scripts/ui-shots.mjs
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5230";
const OUT = "/tmp/ui-shots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/01-map.png` });

// Генерация → превью
await page.getByRole("button", { name: /Сгенерировать шаблон/ }).click();
await page.waitForSelector("img.preview-img", { timeout: 60_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02-generated.png` });

// Топология с выбранным хабом
await page.locator(".section-nav button", { hasText: "Топология" }).click();
await page.locator(".topology-tile", { hasText: "Хаб" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/03-topology.png` });

// Герои
await page.locator(".section-nav button", { hasText: "Герои" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/04-heroes.png` });

// AI-чат + модалка конфига
await page.getByRole("button", { name: /AI/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05-chat.png` });
await page.locator(".ai-header button[title='Настройки ИИ']").click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/06-config.png` });

// Пресеты
await page.keyboard.press("Escape");
await page.locator(".modal button", { hasText: "Отмена" }).click().catch(() => {});
await page.getByRole("button", { name: /Загрузить пресет/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/07-presets.png` });

await browser.close();
console.log("скриншоты в", OUT);
