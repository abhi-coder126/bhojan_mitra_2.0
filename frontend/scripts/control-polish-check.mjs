import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const origin='http://127.0.0.1:5178';
const problems=[];
try{
for(const width of [320,390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.addInitScript(()=>{localStorage.setItem('token','audit');localStorage.setItem('user',JSON.stringify({name:'Audit',role:'admin'}));});
 await page.route('http://localhost:5000/api/**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/auth/me'))return route.fulfill({json:{user:{name:'Audit',role:'admin'}}});return route.fulfill({json:{products:[{_id:'p1',name:'Paneer Tikka',category:'Starters',mrp:199,sellingPrice:199,stock:20}],coupons:[],orders:[],tables:[],settings:{},offers:[],categoryImages:[]}});});
 page.on('pageerror',e=>problems.push({width,error:e.message}));
 for(const path of ['/login','/menu-items','/restaurant-orders','/coupons','/menu/1']){
  await page.goto(origin+path);
  await page.waitForTimeout(450);
  if(path==='/menu-items')await page.getByRole('button',{name:'+ Add Item'}).click();
  if(path==='/restaurant-orders')await page.getByRole('button',{name:'New Order',exact:true}).click();
  if(path==='/menu/1')await page.locator('.menu-item-title').first().click();
  const result=await page.evaluate(()=>{
   const close=[...document.querySelectorAll('button')].filter(b=>{const n=b.getAttribute('aria-label')||'';return /^close/i.test(n)&&b.getClientRects().length&&b.querySelector('svg')});
   const offsets=close.map(b=>{const a=b.getBoundingClientRect(),c=b.querySelector('svg').getBoundingClientRect();return {name:b.getAttribute('aria-label'),dx:Math.round((a.left+a.width/2)-(c.left+c.width/2)),dy:Math.round((a.top+a.height/2)-(c.top+c.height/2)),side:Math.round(a.width),padding:getComputedStyle(b).padding}});
   const fields=[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,ph:e.placeholder}});
   return {url:location.pathname,offsets,fields,overflow:document.documentElement.scrollWidth>innerWidth+2};
  });
  if(result.overflow||result.offsets.some(o=>Math.abs(o.dx)>2||Math.abs(o.dy)>2)||result.fields.some(f=>f.left< -2||f.right>width+2))problems.push({width,path,...result});
 }
 await page.close();
 console.log(`Control checks passed at ${width}px`);
}
assert.deepEqual(problems,[]);console.log('Centered close icons, contained inputs and no page overflow');
}finally{await browser.close();}
