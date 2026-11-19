import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/DIVYA DHARSHINI/.gemini/antigravity/brain/2788d37d-7189-4ba2-b6c7-45c084419119/screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Starting VELAAN IQ E2E Automated Browser Verification...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 960 },
  });

  const page = await browser.newPage();
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
    console.error(`[Browser Page Error] ${err.toString()}`);
  });

  try {
    // 1. Visit Login
    console.log('1. Navigating to Login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });
    console.log('📸 Captured 01_login_page.png');

    // 2. Perform Login with demo credentials
    console.log('2. Submitting login credentials...');
    // Click autofill button
    const autoFillBtn = await page.$('button ::-p-text(Auto-fill)');
    if (autoFillBtn) {
      await autoFillBtn.click();
    } else {
      await page.type('input[type="email"]', 'manager@velaan.ai');
      await page.type('input[type="password"]', 'Soybean2026!');
    }
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    console.log('3. Waiting for Dashboard to load...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000)); // Allow animations & charts to render
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard_page.png') });
    console.log('📸 Captured 02_dashboard_page.png');

    // 4. Navigate to Procurement Advisor
    console.log('4. Navigating to Procurement Advisor...');
    await page.goto('http://localhost:5173/advisor', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    // Click Compute Recommendation
    const computeBtn = await page.$('button ::-p-text(Compute Recommendation)');
    if (computeBtn) {
      await computeBtn.click();
      await new Promise((r) => setTimeout(r, 2500));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_advisor_page.png') });
    console.log('📸 Captured 03_advisor_page.png');

    // 5. Navigate to Scenario Simulator
    console.log('5. Navigating to Scenario Simulator...');
    await page.goto('http://localhost:5173/scenarios', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    // Click preset Rupee weakens 5%
    const presetBtn = await page.$('button ::-p-text(Rupee weakens 5%)');
    if (presetBtn) {
      await presetBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }
    // Click Run What-If Simulation
    const simBtn = await page.$('button ::-p-text(Run What-If Simulation)');
    if (simBtn) {
      await simBtn.click();
      await new Promise((r) => setTimeout(r, 2500));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_scenarios_page.png') });
    console.log('📸 Captured 04_scenarios_page.png');

    // 6. Navigate to Market & Forecast
    console.log('6. Navigating to Market & Forecast...');
    await page.goto('http://localhost:5173/market', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));
    // Click Generate Forecast
    const genBtn = await page.$('button ::-p-text(Generate Forecast)');
    if (genBtn) {
      await genBtn.click();
      await new Promise((r) => setTimeout(r, 3000));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_market_forecast_page.png') });
    console.log('📸 Captured 05_market_forecast_page.png');

    // 7. Navigate to Sourcing Compare
    console.log('7. Navigating to Sourcing Compare...');
    await page.goto('http://localhost:5173/sourcing', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    // Click Compute Landed Cost
    const compareBtn = await page.$('button ::-p-text(Compute Landed Cost)');
    if (compareBtn) {
      await compareBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_sourcing_compare_page.png') });
    console.log('📸 Captured 06_sourcing_compare_page.png');

    // 8. Navigate to Data Management
    console.log('8. Navigating to Data Management...');
    await page.goto('http://localhost:5173/data', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1000));
    // Click Market Prices & Upload tab
    const marketTab = await page.$('button ::-p-text(Market Prices & Upload)');
    if (marketTab) {
      await marketTab.click();
      await new Promise((r) => setTimeout(r, 1500));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_data_management_page.png') });
    console.log('📸 Captured 07_data_management_page.png');

    console.log('\n🎉 E2E Verification Complete!');
    console.log(`Console Errors encountered: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await browser.close();
  }
}

run();
