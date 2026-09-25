import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.addInitScript(()=>{localStorage.setItem('token','audit');localStorage.setItem('user',JSON.stringify({name:'Audit',role:'admin'}));});
await page.route('http://localhost:5000/api/**',r=>{const p=new URL(r.request().url()).pathname;if(p.endsWith('/auth/me'))return r.fulfill({json:{user:{name:'Audit',role:'admin'}}});return r.fulfill({json:{products:[{_id:'p',name:'Paneer Tikka',category:'Starters',mrp:199,sellingPrice:199,stock:20}],orders:[],customers:[],vendors:[],coupons:[],settings:{},offers:[],tables:[],branches:[],categoryImages:[],summary:{last30Days:{purchased:0,consumed:0,wasted:0}},periods:{month:{royalty:{baseLabel:'Net sales'},range:{start:'2026-09-01',end:'2026-09-30'},sales:{}}}}});});
const routes=['/','/restaurant-orders','/menu-items','/purchase','/grn-management','/invoices','/customers','/vendors','/coupons','/rewards','/settings','/tables','/kds','/smart-inventory','/order-management','/menu/1'];
const records=[];
for(const route of routes){await page.goto('http://127.0.0.1:5178'+route);await page.waitForTimeout(300);records.push(...await page.evaluate(()=>[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'}).map(e=>({route:location.pathname,label:(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,32),class:e.className,bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}))));}
fs.writeFileSync('theme-button-audit.json',JSON.stringify(records,null,2));
console.log(JSON.stringify(records.filter(r=>/rgb\((5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99),/.test(r.bg)).slice(0,120),null,2));
await browser.close();
