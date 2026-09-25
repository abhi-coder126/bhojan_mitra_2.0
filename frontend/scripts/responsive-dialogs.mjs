import { chromium } from "playwright";
import fs from "node:fs";

// All API requests are intercepted. This audit never changes live records.
const origin = process.env.UI_AUDIT_ORIGIN || "http://127.0.0.1:5174";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("token", "ui-audit-only");
  localStorage.setItem("user", JSON.stringify({ name: "UI Audit", role: location.pathname === "/branches" ? "master_admin" : "admin" }));
});
const product = { _id: "product-a", name: "Paneer Sandwich with a long menu item name", category: "Sandwich", mrp: 199, sellingPrice: 199, stock: 20, gst: 0, unit: "Plate", foodType: "veg" };
const response = {
  products: [product], orders: [], customers: [], vendors: [], purchases: [], sales: [], returns: [],
  bills: [], payments: [], coupons: [], tiers: [], rewards: [], tables: [], logs: [], materials: [], recipes: [], foodCosts: [], lowStock: [],
  branches: [], invoices: [], users: [], approvals: [],
  branch: {name: "Audit outlet", code: "AUDIT", royaltyPercent: 5}, periods: Object.fromEntries(["today","month","last_month"].map(key=>[key,{royalty:{baseLabel:"Net sales", amount:100, percent:5},range:{start:"2026-09-01",end:"2026-09-30"},sales:{bills:2,grossIncGst:1000,netExGst:900},orders:0}])),
  settings: {}, summary: {last30Days:{purchased:0,consumed:0,wasted:0},materials:0,stockValue:0,lowStock:0,outOfStock:0}, segments: [], topSelling: [], leastSelling: [], hourlyBreakdown: [], tablePerformance: [],
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
page.on("pageerror",e=>console.log("RUNTIME",e.message)); const checks=[['/menu-items','+ Add Item','.menu-item-modal'],['/menu-items','Add Category','.category-manager'],['/menu-items','Add Offer','.offer-manager'],['/restaurant-orders','New Order','[role="dialog"]']];
const results=[];
try{
for(const width of [320,390,768,1024,1440]){
 await page.setViewportSize({width,height:800});
 for(const [path,name,selector] of checks){
 await page.goto(origin+path);await page.getByRole('button',{name,exact:true}).click();
 await page.locator(selector).waitFor({state:'visible',timeout:5000}).catch(async e=>{console.log((await page.locator('body').innerText()).slice(-1800));throw e;}); await page.waitForTimeout(300);
 const data=await page.evaluate((selector)=>{
 let el=document.querySelector(selector); if(!el)el=[...document.querySelectorAll('[role="dialog"], [class*="modal"]')].find(e=>e.getBoundingClientRect().width>0 && !e.className.includes('overlay'));
 if(!el)return {missing:true};
 const r=el.getBoundingClientRect();return {class:el.className,dialogWidth:Math.round(r.width),left:r.left,right:r.right,overflow:el.scrollWidth>el.clientWidth+2,offscreen:r.left< -2||r.right>innerWidth+2,body:document.documentElement.scrollWidth>innerWidth+2};
 },selector);
 results.push({width,path,name,...data});
 }
 console.log(`Dialogs checked at ${width}px`);
}
fs.writeFileSync('responsive-dialog-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.filter(r=>r.missing||r.overflow||r.offscreen||r.body),null,2));
}finally{await browser.close();}

