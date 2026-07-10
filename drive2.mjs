import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
await page.goto('http://localhost:5173/');
await page.waitForSelector('text=Grid Layout');
await page.waitForTimeout(300);

const CARD_W = 140, CARD_H = 196, GAP = 6, PAD = 12;
const grid = await page.$('.select-none.touch-none');
const gbox = await grid.boundingBox();
function cellCenter(row, col) {
  return { x: gbox.x + PAD + col * (CARD_W + GAP) + CARD_W / 2, y: gbox.y + PAD + row * (CARD_H + GAP) + CARD_H / 2 };
}

// Fill all 9 cells individually with distinct single-card images (9 cards -> 1 page)
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    const cc = cellCenter(r, c);
    await page.mouse.click(cc.x, cc.y);
    await page.waitForTimeout(250);
    await page.click('button:has-text("Image URL")');
    await page.fill('#image-url', `https://placehold.co/200x280/333333/FFFFFF/png?text=${r}${c}`);
    await page.waitForTimeout(300);
    await page.click('button:has-text("Assign")');
    await page.waitForTimeout(300);
  }
}
// Add page 2 with one more card -> should overflow to a genuine 2nd page
await page.click('button:has-text("Add page")');
await page.waitForTimeout(300);
const grid2 = await page.$('.select-none.touch-none');
const gbox2 = await grid2.boundingBox();
const cc2 = { x: gbox2.x + PAD + CARD_W / 2, y: gbox2.y + PAD + CARD_H / 2 };
await page.mouse.click(cc2.x, cc2.y);
await page.waitForTimeout(300);
await page.click('button:has-text("Image URL")');
await page.fill('#image-url', 'https://placehold.co/200x280/9B5DE5/FFFFFF/png?text=10');
await page.waitForTimeout(300);
await page.click('button:has-text("Assign")');
await page.waitForTimeout(300);

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.click('button:has-text("Export PDF")'),
]);
await download.saveAs('/tmp/overflow-check.pdf');
console.log('Downloaded PDF');
console.log('Console errors:', JSON.stringify(errors, null, 2));
await browser.close();
