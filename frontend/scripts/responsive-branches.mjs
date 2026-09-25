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
  if (url.pathname.endsWith("/auth/me")) return route.fulfill({ json: { user: { name: "Audit", role: new URL(route.request().frame().url()).pathname === "/branches" ? "master_admin" : "admin" } } });
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
const routes = ['/branches','/order-management'];
const issues=[], results=[];
try {
 await page.goto(origin);
 for(const width of [320,390,480,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  for(const path of routes){
   await page.evaluate((master)=>{localStorage.setItem('user',JSON.stringify({name:'Audit',role:master?'master_admin':'admin'}));localStorage.removeItem('activeBranch');},path==='/branches');
   const before=errors.length;
   await page.goto(origin+path);
   await page.waitForTimeout(550);
   const layout=await page.evaluate(()=>{
    const visible=e=>!!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
    const scrollParent=e=>{for(let p=e.parentElement;p;p=p.parentElement){if(['auto','scroll'].includes(getComputedStyle(p).overflowX))return true;}return false;};
    const clipped=[...document.querySelectorAll('button,input,select,textarea')].filter(e=>{if(!visible(e)||scrollParent(e))return false;const r=e.getBoundingClientRect();return r.left < -2 || r.right > innerWidth+2;}).map(e=>({tag:e.tagName,text:(e.innerText||e.placeholder||e.getAttribute('aria-label')||'').slice(0,45),class:e.className}));
    const overflowNodes=[...document.querySelectorAll('body *')].filter(e=>{if(!visible(e)||scrollParent(e))return false;const r=e.getBoundingClientRect();return r.right>innerWidth+2;}).slice(0,12).map(e=>({tag:e.tagName,class:e.className}));
    return {overflow:document.documentElement.scrollWidth>innerWidth+2,content:document.body.innerText.trim().length,clipped,overflowNodes};
   });
   const result={width,path,actual:new URL(page.url()).pathname,...layout,errors:errors.slice(before)};
   results.push(result);
   if(layout.overflow||!layout.content||layout.clipped.length||result.errors.length){issues.push(result); console.log(JSON.stringify(result));}
  }
  console.log(`Checked ${routes.length} pages at ${width}px`);
 }
 fs.writeFileSync('responsive-branches-results.json',JSON.stringify({results,issues},null,2));
 console.log(`Finished ${results.length} checks; ${issues.length} issues`);
}finally{await browser.close();}

