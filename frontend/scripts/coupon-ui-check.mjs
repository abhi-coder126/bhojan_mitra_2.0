import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
const page=await browser.newPage();
await page.addInitScript(()=>{localStorage.setItem('token','audit');localStorage.setItem('user',JSON.stringify({name:'Demo',role:'admin'}));});
await page.route('http://localhost:5000/api/**',route=>route.fulfill({json:{coupons:[{_id:'offer1',code:'WELCOME20',title:'A treat on your first order',discountType:'Percent',discountValue:20,minimumBillAmount:499,usageLimit:100,usedCount:24,status:'Active',activeDays:[0,1,2,3,4,5,6],showOnMenu:true}],notifications:[],branches:[],settings:{}}}));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,390]){
await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:5174/coupons');
await page.getByRole('heading',{name:'Build your next offer'}).waitFor();
await page.getByPlaceholder('WELCOME20').fill('FRIDAY30');
await page.getByPlaceholder('20% off your favourites').fill('Friday favourites');
assert.equal(await page.locator('.cp-ticket-bottom strong').innerText(),'FRIDAY30');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
await page.waitForTimeout(2500); await page.screenshot({path:`coupon-ui-${width}.png`,fullPage:true});
await page.getByRole('button',{name:'Edit',exact:true}).click();
assert.equal(await page.getByPlaceholder('WELCOME20').inputValue(),'WELCOME20');
await page.getByRole('button',{name:'Cancel edit'}).click();
}
assert.deepEqual(errors,[]);console.log('Coupon desktop/mobile layout, live preview and edit/reset passed');
}finally{await browser.close();}

