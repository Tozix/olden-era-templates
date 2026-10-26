// Рендерит src/assets/logo.svg в 1024px PNG для `tauri icon`.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("src/assets/logo.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.setContent(
  `<!doctype html><body style="margin:0;background:#000"><div id="i" style="width:1024px;height:1024px;line-height:0">${svg}</div></body>`,
);
await page.locator("#i").screenshot({ path: "icon-src.png" });
await browser.close();
console.log("icon-src.png готов");
