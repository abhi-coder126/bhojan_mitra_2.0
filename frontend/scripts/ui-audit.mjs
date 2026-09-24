import { chromium } from "playwright";
import assert from "node:assert/strict";

// All API requests are intercepted. This audit never changes live records.
const origin = process.env.UI_AUDIT_ORIGIN || "http://localhost:5173";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("token", "ui-audit-only");
  localStorage.setItem("user", JSON.stringify({ name: "UI Audit", role: "admin" }));
});
const product = { _id: "product-a", name: "Paneer Sandwich with a long menu item name", category: "Sandwich", mrp: 199, sellingPrice: 199, stock: 20, gst: 0, unit: "Plate", foodType: "veg" };
const response = {
  products: [product], orders: [], customers: [], vendors: [], purchases: [], sales: [], returns: [],
  bills: [], payments: [], coupons: [], tiers: [], rewards: [], tables: [], logs: [], materials: [], recipes: [], foodCosts: [], lowStock: [],
  settings: {}, summary: {}, segments: [], topSelling: [], leastSelling: [], hourlyBreakdown: [], tablePerformance: [],
};
let vendorPosts = 0;
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith("onrender.com")) {
    if (route.request().method() === "POST" && url.pathname.endsWith("/vendors")) {
      vendorPosts += 1;
      await new Promise((resolve) => setTimeout(resolve, 450));
      return route.fulfill({ status: 400, json: { message: "Audit validation error" } });
    }
    return route.fulfill({ json: response });
  }
  if (url.origin === origin || url.protocol === "data:") return route.continue();
  return route.abort();
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const routes = ["/", "/restaurant-orders", "/menu-items", "/all-products", "/purchase", "/grn-management", "/supplier-bills", "/sales-return", "/reports", "/customers", "/vendors", "/accounts", "/coupons", "/rewards", "/settings", "/table-barcodes", "/tables", "/kds", "/smart-inventory", "/audit-logs", "/login", "/menu/1"];
const issues = [];
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      const before = errors.length;
      await page.goto(origin + path);
      await page.waitForTimeout(1100);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 2,
        content: document.body.innerText.trim().length,
        clipped: [...document.querySelectorAll("button")].filter((button) => {
          const rect = button.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          // Scrollable tables intentionally contain offscreen row actions.
          for (let parent = button.parentElement; parent; parent = parent.parentElement) {
            if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) return false;
          }
          return rect.right > innerWidth + 2 || rect.left < -2;
        }).map((button) => button.textContent.trim().slice(0, 40)),
      }));
      if (layout.overflow || !layout.content || layout.clipped.length || errors.length > before) issues.push({ width, path, ...layout, errors: errors.slice(before) });
    }
    console.log(`Scanned ${routes.length} routes at ${width}px`);
  }

  await page.goto(origin + "/vendors");
  await page.waitForTimeout(1100);
  await page.getByPlaceholder("Vendor Name").fill("Test Vendor");
  await page.locator("form").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
  await page.waitForTimeout(100);
  assert(await page.getByRole("button", { name: "Add Vendor" }).isDisabled(), "Submit is disabled while saving");
  await page.getByRole("alert").filter({ hasText: "Audit validation error" }).waitFor();
  assert.equal(vendorPosts, 1, "Rapid duplicate submits send one request");
  assert(await page.getByRole("button", { name: "Add Vendor" }).isEnabled(), "Failed submissions unlock for retry");
  console.log("Form duplicate-submit / error / retry checks passed");

  let updates = 0;
  await page.route("**/rewards/tiers**", async (route) => {
    if (route.request().method() === "PUT") {
      updates += 1;
      await new Promise((resolve) => setTimeout(resolve, 450));
      return route.fulfill({ status: 400, json: { message: "Audit action error" } });
    }
    return route.fulfill({ json: { tiers: [{ _id: "tier-a", title: "Test tier", minOrders: 1, offerText: "Test", validityDays: 7, isActive: true }] } });
  });
  await page.goto(origin + "/rewards");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Pause", exact: true }).evaluate((button) => { button.click(); button.click(); });
  await page.getByRole("button", { name: /Working/ }).waitFor();
  await page.getByText("Audit action error", { exact: true }).waitFor();
  assert.equal(updates, 1, "Async buttons lock before a second click");
  assert(await page.getByRole("button", { name: "Pause", exact: true }).isEnabled());
  console.log("Async button duplicate-click / error / retry checks passed");

  await page.route("**/api/coupons**", async (route) => {
    if (route.request().method() === "DELETE") {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return route.fulfill({ status: 400, json: { message: "Audit incorrect password" } });
    }
    return route.fulfill({ json: { coupons: [{ _id: "coupon-a", code: "TEST", discountType: "Amount", discountValue: 10, status: "Active" }] } });
  });
  await page.goto(origin + "/coupons");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const deleteModal = page.locator(".delete-confirm-modal");
  await deleteModal.getByPlaceholder("Enter password").fill("test-only");
  await deleteModal.getByRole("button", { name: "Delete", exact: true }).click();
  assert(await deleteModal.getByRole("button", { name: "Close" }).isDisabled());
  await deleteModal.getByRole("alert").filter({ hasText: "Audit incorrect password" }).waitFor();
  await deleteModal.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  assert.equal(await deleteModal.getByPlaceholder("Enter password").inputValue(), "");
  await deleteModal.getByRole("button", { name: "Cancel" }).click();
  console.log("Delete error / pending close / password reset checks passed");

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(origin + "/restaurant-orders");
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: "New Order", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: `Add ${product.name}`, exact: true }).click();
    assert(await dialog.getByRole("button", { name: "Place Order", exact: true }).isEnabled());
    await dialog.getByRole("button", { name: `Add one ${product.name}`, exact: true }).click();
    await dialog.getByRole("button", { name: `Remove one ${product.name}`, exact: true }).click();
    await dialog.getByRole("button", { name: `Remove one ${product.name}`, exact: true }).click();
    assert(await dialog.getByRole("button", { name: "Add items to place order" }).isDisabled());
    await dialog.getByRole("button", { name: "Delivery", exact: true }).click();
    assert.equal(await dialog.getByRole("combobox").count(), 0);
    await dialog.getByRole("button", { name: "Dine-in", exact: true }).click();
    assert.equal(await dialog.getByRole("combobox").count(), 1);
    assert(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 2), `Dialog fits at ${width}px`);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    console.log(`New Order add / quantity / toggle / close passed at ${width}px`);
  }
  console.log(JSON.stringify({ issues, runtimeErrors: errors }, null, 2));
  if (issues.length || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
