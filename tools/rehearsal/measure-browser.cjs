'use strict';
// Browser-only measurement of a local captured snapshot. Never calls Google.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { rehearsalFixture } = require('../../tests/helpers/rehearsal-fixture.cjs');

(async () => {
  assert(process.argv[2], 'Provide a local persistence snapshot JSON file');
  const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const f = rehearsalFixture();
  f.server.persistenceContractLoad_ = () => ({ ok: true, snapshot });
  const html = f.html();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    for (let run = 0; run < 3; run++) {
      await page.goto('about:blank'); await page.setContent(html);
      await page.waitForFunction(() => MiniRehearsalStartup.report().browser.firstFramesMs !== null);
      measurements.push(await page.evaluate(() => MiniRehearsalStartup.report().browser));
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-group-id]').count(), snapshot.groups.filter(group => !group.deletedAt).length);
    console.log(JSON.stringify({ scope: 'Local headless browser only; excludes Google, server reads and network',
      groups: snapshot.groups.length, copies: snapshot.copies.length, measurements }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
