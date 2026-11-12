const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for (const [w,h,s,n] of [[1920,1080,1,'uxifriendly-thumbnail-16x9.png'],[1920,1080,0.625,'x']]) { if(n==='x')continue;
const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:s});
await p.goto('file://'+process.cwd()+'/thumbnail.html');await p.waitForTimeout(1500);
await p.screenshot({path:n});}
await b.close();})();
