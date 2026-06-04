import { chromium, request as playwrightRequest } from 'playwright';
import { mkdirSync } from 'fs';
import { spawn } from 'child_process';

const SS   = 'C:/Users/SABARNA MUKHOPADHYAY/Twin_Mind/subjects-screenshots';
const API_BASE = 'http://localhost:8000';
const API  = `${API_BASE}/api/v1`;
const FE   = 'http://localhost:5173';
const USER = { email: 'burnout_test@twinmind.dev', password: 'BurnoutTest123!' };

mkdirSync(SS, { recursive: true });

// ── Wait for a URL to respond ──────────────────────────────────────────
async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok || r.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 800));
  }
  return false;
}

// ── Start vite dev server ──────────────────────────────────────────────
function startVite() {
  const proc = spawn(
    'C:\\Program Files\\nodejs\\node.exe',
    ['C:\\Users\\SABARNA MUKHOPADHYAY\\Twin_Mind\\Frontend\\node_modules\\vite\\bin\\vite.js'],
    {
      cwd: 'C:\\Users\\SABARNA MUKHOPADHYAY\\Twin_Mind\\Frontend',
      stdio: 'pipe',
      detached: false,
    }
  );
  proc.stdout.on('data', d => { if (d.toString().includes('Local:')) console.log('  Vite:', d.toString().trim().replace(/\[[0-9;]*m/g,'')); });
  proc.stderr.on('data', () => {});
  return proc;
}

async function shot(page, name) {
  await page.screenshot({ path: `${SS}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
}

(async () => {
  // ── STEP 0: Ensure frontend running ───────────────────────────────────
  console.log('0. Starting frontend dev server…');
  const feAlive = await waitForUrl(FE, 3000);
  let viteProc = null;
  if (!feAlive) {
    viteProc = startVite();
    const ready = await waitForUrl(FE, 25000);
    if (!ready) { console.error('❌ Frontend failed to start'); process.exit(1); }
    console.log('  Vite started');
  } else {
    console.log('  Frontend already running');
  }

  // ── STEP 1: Login via Playwright request context ───────────────────────
  console.log('1. Getting auth token…');
  let TOKEN = '';
  try {
    const reqCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const resp = await reqCtx.post('/api/v1/auth/login', {
      data: USER,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    if (resp.ok()) {
      const d = await resp.json();
      TOKEN = d.access_token;
      console.log(`  Token: ${TOKEN.slice(0,32)}…`);
    } else {
      throw new Error(`HTTP ${resp.status()}`);
    }
    await reqCtx.dispose();
  } catch (e) {
    console.log(`  Login failed (${e.message}), using fallback token`);
    TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMSIsImVtYWlsIjoiYnVybm91dF90ZXN0QHR3aW5taW5kLmRldiIsImV4cCI6MTc4MDYzNDI2MX0.5PSsl54Dj1vDvPzacnHBOmhu7hER6HVqGg9uKYGlFrI';
  }

  // ── STEP 2: Seed subject records via Playwright request context ──────────
  console.log('2. Seeding test data…');
  let seeded = 0;
  try {
    const rc = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${TOKEN}` },
    });
    const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
    const records = [
      { subject:'Physics', date:daysAgo(14), score:50, study_hours:1.5, confidence:2, source:'manual', topics:[{name:'Mechanics',score:35},{name:'Optics',score:58},{name:'Thermodynamics',score:62}], notes:'' },
      { subject:'Physics', date:daysAgo(7),  score:46, study_hours:1.0, confidence:2, source:'quiz',   topics:[{name:'Mechanics',score:30},{name:'Optics',score:55},{name:'Thermodynamics',score:60}], notes:'' },
      { subject:'Physics', date:daysAgo(1),  score:42, study_hours:0.5, confidence:1, source:'exam',   topics:[{name:'Mechanics',score:28},{name:'Optics',score:52},{name:'Thermodynamics',score:58}], notes:'' },
      { subject:'Mathematics', date:daysAgo(20), score:72, study_hours:3.0, confidence:4, source:'manual', topics:[{name:'Algebra',score:80},{name:'Calculus',score:65},{name:'Statistics',score:75}], notes:'' },
      { subject:'Mathematics', date:daysAgo(10), score:78, study_hours:2.5, confidence:4, source:'quiz',   topics:[{name:'Algebra',score:85},{name:'Calculus',score:72},{name:'Statistics',score:78}], notes:'' },
      { subject:'Mathematics', date:new Date().toISOString().slice(0,10), score:84, study_hours:2.0, confidence:5, source:'exam', topics:[{name:'Algebra',score:90},{name:'Calculus',score:78},{name:'Statistics',score:83}], notes:'' },
      { subject:'Chemistry', date:daysAgo(12), score:61, study_hours:2.0, confidence:3, source:'manual', topics:[{name:'Organic Chemistry',score:48},{name:'Physical Chemistry',score:72}], notes:'' },
      { subject:'Chemistry', date:daysAgo(5),  score:64, study_hours:1.8, confidence:3, source:'quiz',   topics:[{name:'Organic Chemistry',score:52},{name:'Physical Chemistry',score:75}], notes:'' },
      { subject:'Biology',  date:daysAgo(9),  score:76, study_hours:2.5, confidence:4, source:'manual', topics:[{name:'Genetics',score:82},{name:'Ecology',score:74}], notes:'' },
      { subject:'Biology',  date:daysAgo(3),  score:79, study_hours:2.2, confidence:4, source:'quiz',   topics:[{name:'Genetics',score:85},{name:'Ecology',score:77}], notes:'' },
      { subject:'English',  date:daysAgo(6),  score:68, study_hours:1.5, confidence:3, source:'assignment', topics:[{name:'Grammar',score:74},{name:'Writing',score:62}], notes:'' },
      { subject:'Computer Science', date:daysAgo(15), score:55, study_hours:1.0, confidence:3, source:'manual', topics:[{name:'Algorithms',score:48},{name:'Data Structures',score:60}], notes:'' },
    ];
    for (const r of records) {
      const res = await rc.post('/api/v1/subject-performance/record', { data: r, timeout: 8000 });
      if (res.ok()) seeded++;
      else { const t = await res.text().catch(() => '?'); console.log(`  Skip: ${r.subject} ${r.date} (${res.status()}: ${t.slice(0,60)})`); }
    }
    await rc.dispose();
    console.log(`  ${seeded} records seeded`);
  } catch(e) { console.log(`  Seed error: ${e.message}`); }

  // ── STEP 3: Open browser & test ──────────────────────────────────────
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
  });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  // Inject token
  await page.goto(FE, { waitUntil:'domcontentloaded', timeout:15000 });
  await page.evaluate(t => localStorage.setItem('token', t), TOKEN);
  console.log('3. Token injected into browser');

  // ── STEP 4: Dashboard ────────────────────────────────────────────────
  console.log('4. Testing Dashboard…');
  await page.goto(FE, { waitUntil:'networkidle', timeout:15000 });
  await page.waitForTimeout(2000);
  const skipBtn = page.locator('button:has-text("Skip Tour"), button:has-text("Skip")').first();
  if (await skipBtn.isVisible().catch(() => false)) { await skipBtn.click(); await page.waitForTimeout(500); }
  await shot(page, '01-dashboard-top');
  await page.evaluate(() => window.scrollBy(0, 450));
  await page.waitForTimeout(600);
  await shot(page, '02-dashboard-subject-widgets');
  const dashWeakest  = await page.locator('text=Weakest Subject').first().isVisible().catch(() => false);
  const dashStrongest= await page.locator('text=Strongest Subject').first().isVisible().catch(() => false);
  const dashFocus    = await page.locator('text=Focus Today').first().isVisible().catch(() => false);
  console.log(`  Widgets — Weakest:${dashWeakest} Strongest:${dashStrongest} Focus:${dashFocus}`);

  // ── STEP 5: Navigate to /subjects ────────────────────────────────────
  console.log('5. Loading /subjects page…');
  await page.goto(`${FE}/subjects`, { waitUntil:'networkidle', timeout:15000 });
  await page.waitForTimeout(2500);
  await shot(page, '03-subjects-loaded');
  const pageTitle   = await page.locator('text=Subject Analysis').first().isVisible().catch(() => false);
  console.log(`  Page title: ${pageTitle} | URL: ${page.url()}`);

  // ── STEP 6: Verify all sections ───────────────────────────────────────
  console.log('6. Verifying sections…');
  const focusSect  = await page.locator('text=FOCUS SUBJECT TODAY').first().isVisible().catch(() => false);
  const detecCards = await page.locator('text=Weakest Subject').first().isVisible().catch(() => false);
  const rankSect   = await page.locator('text=Priority Ranking').first().isVisible().catch(() => false);
  const heatSect   = await page.locator('text=Subject Heatmap').first().isVisible().catch(() => false);
  const trendSect  = await page.locator('text=Performance Trend').first().isVisible().catch(() => false);
  const recSect    = await page.locator('text=AI Recommendations').first().isVisible().catch(() => false);
  const planSect   = await page.locator('text=AI Recovery Plans').first().isVisible().catch(() => false);
  console.log(`  Focus:${focusSect} Detection:${detecCards} Ranking:${rankSect} Heatmap:${heatSect}`);
  console.log(`  Trend:${trendSect} Recs:${recSect} Plans:${planSect}`);

  // ── STEP 7: Screenshot each visible section ───────────────────────────
  await page.evaluate(() => window.scrollTo(0,0));
  await shot(page, '04-focus-subject-card');
  await page.evaluate(() => window.scrollBy(0, 380));
  await page.waitForTimeout(300);
  await shot(page, '05-detection-ai-cards');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(300);
  await shot(page, '06-priority-ranking');
  await page.evaluate(() => window.scrollBy(0, 550));
  await page.waitForTimeout(400);
  await shot(page, '07-heatmap-grid');
  await page.evaluate(() => window.scrollBy(0, 650));
  await page.waitForTimeout(500);
  await shot(page, '08-trend-chart');
  await page.evaluate(() => window.scrollBy(0, 650));
  await page.waitForTimeout(300);
  await shot(page, '09-ai-recommendations');
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(300);
  await shot(page, '10-action-plans');

  // ── STEP 8: Click heatmap cell → detail modal ─────────────────────────
  console.log('7. Testing heatmap click → detail modal…');
  // Scroll the heatmap section into view
  await page.locator('text=Subject Heatmap').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
  // Target cells specifically inside .subj-heatmap — direct children
  const heatmapGrid = page.locator('.subj-heatmap');
  const heatCells = await heatmapGrid.locator('> div').all();
  console.log(`  Heatmap cells found: ${heatCells.length}`);
  let modalStat = false, topicBreak = false, modalRecs = false;
  if (heatCells.length > 0) {
    // Click Physics cell (index 1, since index 0 = Mathematics which is first alphabetically)
    const cellToClick = heatCells[1] ?? heatCells[0];
    await cellToClick.click();
    await page.waitForTimeout(900);
    await shot(page, '11-subject-detail-modal');
    modalStat  = await page.locator('text=Current Score').first().isVisible().catch(() => false);
    topicBreak = await page.locator('text=Topic Breakdown').first().isVisible().catch(() => false);
    modalRecs  = await page.locator('text=AI Recommendations').nth(1).isVisible().catch(() => false);
    console.log(`  Modal — Stats:${modalStat} Topics:${topicBreak} Recs:${modalRecs}`);
    // Close via Escape key (avoids overlay interception)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else {
    await shot(page, '11-subject-detail-modal');
  }

  // ── STEP 9: Expand action plan ────────────────────────────────────────
  console.log('8. Testing action plan accordion…');
  // Use JS click to bypass sticky-header interception
  const planExpanded = await page.evaluate(async () => {
    const btns = Array.from(document.querySelectorAll('button'));
    const showBtn = btns.find(b => b.textContent.includes('Show'));
    if (showBtn) { showBtn.click(); await new Promise(r => setTimeout(r, 500)); }
    const tasks = document.querySelectorAll('p');
    return Array.from(tasks).some(p => p.textContent.includes('Foundation Review'));
  });
  await page.waitForTimeout(500);
  await shot(page, '12-action-plan-expanded');
  console.log(`  Day-1 task visible: ${planExpanded}`);

  // ── STEP 10: Add Record modal ─────────────────────────────────────────
  console.log('9. Testing Add Record modal…');
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForTimeout(300);
  // Use JS click to bypass sticky-header interception
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Record'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(600);
  await shot(page, '13-add-record-modal');
  const addModalTitle = await page.locator('text=Add Performance Record').first().isVisible().catch(() => false);
  const sliders = await page.locator('input[type="range"]').count();
  console.log(`  Add modal:${addModalTitle} | Sliders:${sliders}`);
  // Interact: pick Biology, set score to 72
  await page.locator('select').first().selectOption('Biology');
  await page.waitForTimeout(300);
  const allSliders = await page.locator('input[type="range"]').all();
  if (allSliders[0]) await allSliders[0].fill('72');
  await shot(page, '14-add-form-filled');
  // Close without saving
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── STEP 11: Mobile view ──────────────────────────────────────────────
  console.log('10. Mobile (390px) view…');
  await ctx.close();
  const mobCtx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const mob = await mobCtx.newPage();
  await mob.goto(FE, { waitUntil:'domcontentloaded' });
  await mob.evaluate(t => localStorage.setItem('token', t), TOKEN);
  await mob.goto(`${FE}/subjects`, { waitUntil:'networkidle', timeout:12000 });
  await mob.waitForTimeout(1500);
  await mob.screenshot({ path:`${SS}/15-mobile-subjects.png` });
  console.log('  📸 15-mobile-subjects.png');
  const mobFocus = await mob.locator('text=FOCUS SUBJECT TODAY').first().isVisible().catch(() => false);
  console.log(`  Mobile focus: ${mobFocus}`);
  await mobCtx.close();

  await browser.close();
  if (viteProc) viteProc.kill();

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('RESULTS');
  console.log('══════════════════════════════════');
  const checks = {
    'Page title renders':              pageTitle,
    'Focus Subject Today card':        focusSect,
    'AI Detection 4-card grid':        detecCards,
    'Priority Ranking strip':          rankSect,
    'Subject Heatmap grid':            heatSect,
    'Performance Trend chart':         trendSect,
    'AI Recommendations section':      recSect,
    'AI Recovery Plans accordion':     planSect,
    'Subject detail modal — stats':    modalStat,
    'Topic breakdown in modal':        topicBreak,
    'Action plan Day-1 task':          planExpanded,
    'Add Record modal':                addModalTitle,
    'Dashboard Weakest widget':        dashWeakest,
    'Dashboard Strongest widget':      dashStrongest,
    'Dashboard Focus Today widget':    dashFocus,
    'Mobile layout renders':           mobFocus,
  };
  let pass = 0, fail = 0;
  for (const [k,v] of Object.entries(checks)) {
    console.log(`  ${v?'✅':'❌'} ${k}`); v?pass++:fail++;
  }
  console.log(`\n  ${pass} passed · ${fail} failed`);
  if (jsErrors.length) {
    console.log('\n  JS errors:');
    jsErrors.slice(0,4).forEach(e => console.log('  ⚠', e.slice(0,100)));
  } else {
    console.log('  ✅ No JavaScript errors');
  }
  console.log(`\n  Screenshots → ${SS}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
