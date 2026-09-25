import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
for(const width of [1440,390]){
const page=await browser.newPage({viewport:{width,height:900}});
await page.addInitScript(()=>{localStorage.setItem('bhojan_customer_token','audit');localStorage.setItem('bhojan_customer_profile',JSON.stringify({name:'Asha',contact:'9999999999'}));});
let fail=true;
const reward={id:'r1',title:'A sweet little thank you',offerText:'Free dessert on your next order',scratched:false,expired:false,expiresAt:'2026-12-31'};
await page.route('http://localhost:5000/api/**',route=>{
const path=new URL(route.request().url()).pathname;
if(path.endsWith('/scratch')){if(fail){fail=false;return route.fulfill({status:500,json:{message:'Retry'}});}return route.fulfill({json:{reward:{...reward,scratched:true}}});}
if(path.endsWith('/rewards'))return route.fulfill({json:{rewards:[reward,{...reward,id:'old',expired:true,scratched:true}]}});
if(path.endsWith('/me'))return route.fulfill({json:{customer:{name:'Asha',contact:'9999999999'}}});
return route.fulfill({json:{products:[],offers:[]}});
});
page.on('pageerror',e=>console.log(e.message)); await page.goto('http://127.0.0.1:5174/menu/1'); await page.waitForTimeout(2000);await page.locator('.foodora-profile-chip').click();
await page.locator('.customer-auth-card').getByRole('button',{name:'My Rewards'}).click();
await page.locator('.customer-auth-card').getByRole('button',{name:'Unwrap reward'}).click();
await page.waitForTimeout(500);await page.screenshot({path:`reward-wrapped-${width}.png`});
await page.getByRole('button',{name:'Tap to reveal instead'}).click();
await page.getByRole('button',{name:'Try again',exact:true}).waitFor();
await page.getByRole('button',{name:'Try again',exact:true}).click();
await page.getByText('Lucky looks good on you!',{exact:true}).waitFor();
assert.match(await page.locator('.rw-offer').innerText(),/Free dessert/);
assert.equal(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
await page.screenshot({path:`reward-revealed-${width}.png`});
await page.getByRole('button',{name:'Lovely, thank you!'}).click();
assert.equal(await page.locator('.customer-auth-card').getByRole('button',{name:'Unwrap reward'}).count(),0);
await page.screenshot({path:`reward-list-${width}.png`});
await page.close();
}
console.log('Rewards desktop/mobile, reveal retry, saved list and dialog sizing passed');
}finally{await browser.close();}


