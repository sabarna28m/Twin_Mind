import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const SCREENSHOTS = 'C:/Users/SABARNA MUKHOPADHYAY/Twin_Mind/burnout-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMSIsImVtYWlsIjoiYnVybm91dF90ZXN0QHR3aW5taW5kLmRldiIsImV4cCI6MTc4MDYzNDI2MX0.5PSsl54Dj1vDvPzacnHBOmhu7hER6HVqGg9uKYGlFrI';

async function shot(page, name) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: false });
  console.log(`   📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  // ── STEP 1: Inject token and navigate to Dashboard ──
  console.log('1. Injecting auth token...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
  }, TOKEN);
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '01-dashboard');
  console.log('   URL:', page.url());

  // Check burnout widget on dashboard
  const widgetVisible = await page.locator('text=Burnout Risk').first().isVisible().catch(() => false);
  console.log('   Burnout widget on dashboard:', widgetVisible);

  // Scroll to find widget
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);
  await shot(page, '02-dashboard-widget-area');

  // ── STEP 2: Navigate to /burnout ──
  console.log('\n2. Navigating to /burnout...');
  await page.goto('http://localhost:5173/burnout', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot(page, '03-burnout-page-initial');

  // Verify key elements
  const scoreWidget = await page.locator('text=Burnout Score').first().isVisible().catch(() => false);
  const checkinForm = await page.locator("text=Today's Check-in").first().isVisible().catch(() => false);
  const sliders     = await page.locator('input[type="range"]').count();
  const trendTitle  = await page.locator('text=Burnout Trend').first().isVisible().catch(() => false);
  console.log(`   Score widget: ${scoreWidget} | Check-in form: ${checkinForm} | Sliders: ${sliders} | Trend: ${trendTitle}`);

  // ── STEP 3: Fill form for HIGH RISK scenario ──
  console.log('\n3. Filling form for HIGH RISK scenario...');
  const allSliders = await page.locator('input[type="range"]').all();
  if (allSliders.length >= 1) {
    await allSliders[0].fill('11'); // study hours > 8
    await page.waitForTimeout(200);
  }
  if (allSliders.length >= 2) {
    await allSliders[1].fill('4'); // sleep hours < 6
    await page.waitForTimeout(200);
  }

  // Set breaks to 0 (click − twice)
  const minusBtns = await page.locator('button').filter({ hasText: '−' }).all();
  for (let i = 0; i < 3; i++) {
    if (minusBtns.length > 0) await minusBtns[0].click().catch(() => {});
  }
  await page.waitForTimeout(200);

  // Select lowest mood (😔)
  const moodBtn = page.locator('button').filter({ hasText: '😔' }).first();
  await moodBtn.click().catch(() => {});

  // Select lowest energy (🪫)
  const energyBtn = page.locator('button').filter({ hasText: '🪫' }).first();
  await energyBtn.click().catch(() => {});

  // Set streak > 10
  const plusBtns = await page.locator('button').filter({ hasText: '+' }).all();
  for (let i = 0; i < 11; i++) {
    if (plusBtns.length > 1) await plusBtns[1].click().catch(() => {});
  }
  await page.waitForTimeout(300);

  // Check live preview
  const previewText = await page.locator('text=Live score estimate').first().textContent().catch(() => 'not found');
  console.log('   Live preview:', previewText?.trim()?.replace(/\s+/g, ' '));
  await shot(page, '04-form-high-risk-filled');

  // ── STEP 4: Submit ──
  console.log('\n4. Submitting check-in...');
  const submitBtn = page.locator('button[type="submit"]').first();
  const btnText = await submitBtn.textContent().catch(() => '');
  console.log('   Submit button text:', btnText?.trim());
  await submitBtn.click();
  await page.waitForTimeout(3500);
  await shot(page, '05-after-submit');

  // Check results
  const alertBanner  = await page.locator('text=High Burnout Risk Detected').first().isVisible().catch(() => false);
  const recsSection  = await page.locator('text=AI Recommendations').first().isVisible().catch(() => false);
  const twinSection  = await page.locator('text=AI Twin Says').first().isVisible().catch(() => false);
  console.log(`   Alert banner: ${alertBanner} | Recommendations: ${recsSection} | Twin msg: ${twinSection}`);

  // ── STEP 5: Scroll through the page ──
  console.log('\n5. Scrolling through full page...');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(400);
  await shot(page, '06-recommendations-section');

  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '07-twin-message');

  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await shot(page, '08-trend-chart');

  // Check trend data appeared
  const trendChart = await page.locator('.recharts-line').first().isVisible().catch(() => false);
  console.log('   Recharts line visible:', trendChart);

  // ── STEP 6: Test LOW RISK scenario ──
  console.log('\n6. Testing LOW RISK scenario...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const allSliders2 = await page.locator('input[type="range"]').all();
  if (allSliders2.length >= 1) await allSliders2[0].fill('5');  // low study
  if (allSliders2.length >= 2) await allSliders2[1].fill('8');  // good sleep

  // Set mood to happy
  const happyBtn = page.locator('button').filter({ hasText: '😄' }).first();
  await happyBtn.click().catch(() => {});
  // Set energy to max
  const rocketBtn = page.locator('button').filter({ hasText: '🚀' }).first();
  await rocketBtn.click().catch(() => {});

  const previewLow = await page.locator('text=Live score estimate').first().textContent().catch(() => '');
  console.log('   Low risk preview:', previewLow?.trim()?.replace(/\s+/g, ' '));
  await shot(page, '09-low-risk-form');

  // ── STEP 7: Mobile view ──
  console.log('\n7. Testing mobile (390px) view...');
  await ctx.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mob = await mobileCtx.newPage();
  await mob.evaluate(() => {});
  await mob.goto('http://localhost:5173/burnout', { waitUntil: 'domcontentloaded' });
  await mob.evaluate((token) => { localStorage.setItem('token', token); }, TOKEN);
  await mob.goto('http://localhost:5173/burnout', { waitUntil: 'networkidle', timeout: 12000 });
  await mob.waitForTimeout(1500);
  await mob.screenshot({ path: `${SCREENSHOTS}/10-burnout-mobile.png` });
  console.log('   📸 10-burnout-mobile.png');
  const mobileScore = await mob.locator('text=Burnout Score').first().isVisible().catch(() => false);
  console.log('   Mobile - Score widget visible:', mobileScore);
  await mobileCtx.close();

  await browser.close();

  // ── SUMMARY ──
  console.log('\n══════════════════════════════════');
  console.log('TEST RESULTS SUMMARY');
  console.log('══════════════════════════════════');
  const results = {
    'Score widget rendered': scoreWidget,
    'Check-in form rendered': checkinForm,
    'Range sliders present': sliders >= 2,
    'Trend chart rendered': trendTitle,
    'High-risk alert banner': alertBanner,
    'AI Recommendations section': recsSection,
    'AI Twin message section': twinSection,
    'Recharts line visible': trendChart,
    'Mobile layout works': mobileScore,
  };
  let passed = 0, failed = 0;
  for (const [check, result] of Object.entries(results)) {
    const icon = result ? '✅' : '❌';
    console.log(`  ${icon} ${check}`);
    result ? passed++ : failed++;
  }
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (jsErrors.length > 0) {
    console.log('\nJS Errors:');
    jsErrors.forEach(e => console.log('  ⚠', e.slice(0, 120)));
  } else {
    console.log('\n  ✅ No JavaScript errors');
  }
  console.log(`\n  Screenshots in: ${SCREENSHOTS}`);
})().catch(err => {
  console.error('\n❌ Test script error:', err.message);
  process.exit(1);
});
