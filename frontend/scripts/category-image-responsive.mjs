import { chromium } from "playwright";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const cssFile = readdirSync("dist/assets").find((file) => file.endsWith(".css"));
const css = readFileSync(join("dist/assets", cssFile), "utf8");
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
try {
  for (const width of [320, 375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent(`<style>${css}</style><div style="max-width:100%;padding:12px"><nav class="foodora-categories-row with-images" aria-label="Menu categories">${["starters", "main-course", "breads", "rice", "desserts", "beverages", "burgers", "pizza"].map((name) => `<button type="button"><span class="category-menu-thumbnail"><img src="data:image/png;base64,${readFileSync(join("public/category-food", `${name}.png`)).toString("base64")}" alt=""></span><b>${name}</b></button>`).join("")}</nav></div>`);
    const result = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      imagesLoaded: [...document.images].every((image) => image.naturalWidth > 0),
      categoryScrolls: document.querySelector("nav").scrollWidth > document.querySelector("nav").clientWidth,
    }));
    if (result.pageWidth > result.viewportWidth || !result.imagesLoaded || (width <= 768 && !result.categoryScrolls)) {
      throw new Error(`${width}px: ${JSON.stringify(result)}`);
    }
    if (result.categoryScrolls) {
      const moved = await page.evaluate(() => {
        const row = document.querySelector("nav");
        row.scrollLeft = row.scrollWidth;
        return row.scrollLeft > 0;
      });
      if (!moved) throw new Error(`${width}px: categories cannot be scrolled`);
    }
    console.log(`${width}px: category images loaded; no page overflow`);
    await page.close();
  }
} finally {
  await browser.close();
}
