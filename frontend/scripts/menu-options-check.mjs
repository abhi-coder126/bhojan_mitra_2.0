import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage(); page.on('pageerror', e=>console.log(e.message));
 await page.route('http://localhost:5000/api/**',route=>route.fulfill({json:{products:[{_id:'shake',name:'Chocolate Shake',category:'Shakes',itemType:'beverage',mrp:100,stock:999,variants:[{id:'small',label:'250 ml',price:100},{id:'large',label:'1 L',price:300}],optionGroups:[]}],offers:[]}}));
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});
 await page.goto((process.env.UI_AUDIT_ORIGIN || 'http://127.0.0.1:5174') + '/menu/1');
 await page.getByRole('button',{name:'Chocolate Shake',exact:true}).click();
 await page.locator('.menu-choice').filter({hasText:'1 L'}).click();
 assert.match(await page.locator('.menu-detail-footer').innerText(),/300.00/);
 assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await page.getByRole('button',{name:/Add to cart/}).click();
 assert.match(await page.locator('.menu-cart-items').innerText(),/1 L/);
 await page.getByRole('button',{name:'Chocolate Shake',exact:true}).click();
 await page.getByRole('button',{name:/Add to cart/}).click();
 assert.match(await page.locator('.menu-cart-items').innerText(),/250 ml/);
 }
 console.log('Desktop/mobile popup, volume price and distinct cart selections passed');
} finally {await browser.close();}






