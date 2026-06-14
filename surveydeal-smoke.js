const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  console.log(await page.title());
  console.log(await page.locator("h1").innerText());
  await page.click("#seedDeals");
  console.log("deal cards", await page.locator(".deal-card").count());
  await page.click('button[data-filter="disputed"]');
  console.log("disputed visible", await page.locator(".deal-card").count());
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
