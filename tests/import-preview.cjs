'use strict';

// Optional local browser check of the ignored real-data candidate; no web app deployment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { analyzeImport } = require('../tools/import-core.cjs');
const repo = path.resolve(__dirname, '..');
const snapshotPath = process.env.IMPORT_SNAPSHOT || (fs.existsSync(path.join(repo, '.local/import/import-readback.json'))
  ? '.local/import/import-readback.json' : '.local/import/source-snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(path.resolve(repo, snapshotPath), 'utf8'));
const { candidate, report } = analyzeImport(snapshot);
assert.equal(report.blockers, 0, 'Do not preview a blocked import.');
const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
const server = vm.createContext({});
vm.runInContext(read('Code.js'), server);
vm.runInContext(read('Storage.js'), server);
const readback = snapshot.destination.sheets;
const tables = readback.some(sheet => sheet.title === 'Groups')
  ? Object.fromEntries(readback.map(sheet => [sheet.title, sheet.values])) : candidate.tables;
server.SpreadsheetApp = { openById(id) {
  assert.equal(id, snapshot.destination.spreadsheetId);
  return { getSheetByName(title) { return { getDataRange() { return {
    getDisplayValues: () => tables[title], getFormulas: () => [['']]
  }; } }; } };
} };
const data = server.buildSpreadsheetPreviewState_();
server.previewData = data;
const serialized = vm.runInContext('serializeInitialState_(previewData)', server);
const html = read('Index.html').replace('<?!= include("Styles"); ?>', () => read('Styles.html'))
  .replace('<?!= initialStateJson ?>', () => serialized).replace('<?!= include("Scripts"); ?>', () => read('Scripts.html'));
const output = path.join(repo, '.local/import/dry-run');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], results = [];
    page.on('pageerror', error => errors.push(error.message));
    const check = async (name, action) => { await action(); results.push(name); console.log(`PASS ${name}`); };
    const button = action => page.locator(`[data-action="${action}"]`);
    const search = value => page.locator('#miniV2SearchInput').fill(value);
    const settle = () => page.waitForTimeout(550);
    // Click the visible name, not the center of the deliberately wide browse row.
    const openGroup = rootId => page.locator(`tr[data-group-id="${rootId}"] .mini-v2-name`).click();
    await page.setContent(html); await settle();
    await check('actual collection counts and group/individual browsing', async () => {
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-group-id]').count(), report.stats.groups);
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /612.*496/);
      await page.locator('[data-browse-mode="individuals"]').click();
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-copy-id]').count(), report.stats.copies);
      await page.locator('[data-browse-mode="groups"]').click();
    });
    await check('real sticker search opens its preserved group and copy', async () => {
      await search('A00');
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-group-id]').count(), 1);
      await openGroup('001-BER'); await settle();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Berserker');
      assert.equal(await page.locator('[data-detail-copy-id="001-BER-01"] td').first().innerText(), 'A00');
      await button('close-detail').click(); await search('');
    });
    await check('away shortcut finds all 19 saved-away copies; n/a is not missing', async () => {
      await page.locator('.mini-v2-summary-desktop [data-collection-view="away"]').click();
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-copy-id]').count(), report.stats.away);
      assert.match(await page.locator('.mini-v2-summary-desktop [data-collection-view="missing"]').innerText(), /^0\s/);
      await button('clear-filters').click();
    });
    await check('real variant Set number remains editable as text', async () => {
      await search(data.groups.find(group => group.rootId === '014-CITGUA').name);
      await openGroup('014-CITGUA'); await settle();
      await button('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="setNumber"]').inputValue(), '4a');
      await button('discard-edit').click(); await button('close-detail').click();
    });
    const longestSet = data.groups.filter(group => group.set !== 'n/a').sort((a, b) => b.set.length - a.set.length)[0];
    await check('long real Set labels and large copy groups fit the existing desktop inspector', async () => {
      await search(longestSet.name);
      await openGroup(longestSet.rootId); await settle();
      const set = page.locator('.mini-v2-set-field .mini-v2-read-value');
      assert.ok((await set.getAttribute('title')).includes(longestSet.set));
      assert.equal(await set.evaluate(node => getComputedStyle(node).whiteSpace), 'nowrap');
      assert.equal(await set.evaluate(node => !!node._miniV2MarqueeAnimation), true);
      assert.equal(await page.locator('.mini-v2-list-wrap').evaluate(node => node.scrollLeft), 0);
      await page.screenshot({ path: path.join(output, 'preview-desktop.png') });
      await button('close-detail').click();
      const largest = data.groups.slice().sort((a, b) => b.copies.length - a.copies.length)[0];
      await search(largest.name);
      await openGroup(largest.rootId); await settle();
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), largest.copies.length);
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      await button('close-detail').click();
    });
    await check('preserved missing fields remain visible instead of being guessed', async () => {
      await search('Quickling'); await openGroup('090-QUI'); await settle();
      assert.match(await page.locator('#miniV2DetailHeaderTags .mini-v2-detail-tag').getAttribute('title'), /Race/);
      await button('close-detail').click();
    });
    await check('actual collection opens a visible inspector on a phone without page overflow', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await search('Berserker'); await openGroup('001-BER'); await settle();
      const header = await page.locator('.mini-v2-detail-header').boundingBox();
      assert.ok(header.y >= -1 && header.y + header.height < 844);
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, 'preview-phone.png') });
    });
    await check('full catalogs include unused Sets and exclude temporary locations from Home', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await button('edit-mini').click();
      const choices = selector => page.locator(selector + ' option').evaluateAll(nodes => nodes.map(n => n.value));
      const sets = await choices('[data-edit-field="set"]');
      assert.ok(data.catalogs.set.every(value => sets.includes(value)));
      const unused = data.catalogs.set.filter(value => !data.groups.some(group => group.set === value));
      assert.equal(unused.length, 21);
      assert.deepEqual((await choices('[data-edit-field="home"]')).filter(Boolean), Array.from(data.homeLocations));
      const locations = await page.locator('.mini-v2-copy-select').first().locator('option').evaluateAll(nodes => nodes.map(n => n.value));
      assert.ok(data.locations.every(value => locations.includes(value)));
      const temporary = data.locations.filter(value => !data.homeLocations.includes(value));
      assert.equal(temporary.length, 15);
      await button('discard-edit').click(); await button('close-detail').click();
      await page.locator('button[data-facet-key="more"]').click();
      const filterSets = await choices('#miniV2SetFilter');
      assert.ok(unused.every(value => filterSets.includes(value)));
      await page.locator('button[data-facet-key="more"]').click();
    });
    await check('preview notice fits narrow headers and does not promise persistent saves', async () => {
      for (const width of [1440, 980, 820, 819, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const notice = page.locator('.mini-v2-demo-note');
        assert.match(await notice.innerText(), /^Preview/);
        assert.ok(await notice.evaluate(node => {
          const bounds = node.parentElement.getBoundingClientRect(), box = node.getBoundingClientRect();
          return box.right <= bounds.right + 1 && box.left >= bounds.left && node.scrollWidth <= node.clientWidth;
        }));
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('.mini-v2-demo-note').click();
      assert.match(await page.locator('#miniV2DemoNotice').innerText(), /neither spreadsheet is changed/);
      await page.locator('.mini-v2-demo-note').click();
    });
    await check('saved preview edits, additions, removals, deletion and sticker hints reset on reload', async () => {
      await page.route('https://ppq-preview.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.addInitScript(() => {
        for (const key of ['mock', 'collection']) localStorage.setItem(`ppq-miniature-tracker:${key}:next-sticker:v1`, 'Z99');
        window.google = { script: { run: new Proxy({}, { get() { throw new Error('Unexpected app server call'); } }) } };
      });
      await page.goto('https://ppq-preview.test/'); await settle();
      const awayGroup = data.groups.find(group => group.copies.some(copy => copy.currentLocation !== group.home));
      const awayCopy = awayGroup.copies.find(copy => copy.currentLocation !== awayGroup.home);
      await search(awayGroup.name); await openGroup(awayGroup.rootId); await settle();
      assert.equal(await page.locator(`select[data-copy-id="${awayCopy.id}"]`).inputValue(), awayCopy.currentLocation);
      await button('set-all-home').click(); await button('save-changes').click();
      assert.equal(await page.locator(`select[data-copy-id="${awayCopy.id}"]`).inputValue(), awayGroup.home);
      await button('edit-mini').click();
      await page.locator('#miniV2EditName').fill('Temporary renamed mini');
      await page.locator('[data-edit-field="notes"]').fill('Temporary note');
      await button('add-copy').click();
      assert.equal(await button('apply-next-sticker').innerText(), 'Apply F55');
      await button('apply-next-sticker').click();
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'F55');
      await button('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Temporary renamed mini');
      await button('edit-mini').click();
      await page.locator(`[data-remove-copy="${awayCopy.id}"]`).click();
      await button('save-edit').click();
      assert.equal(await page.locator(`[data-detail-copy-id="${awayCopy.id}"]`).count(), 0);
      await button('edit-mini').click();
      await button('delete-group').click();
      await button('confirm-delete-group').click();
      assert.equal(await page.locator(`tr[data-group-id="${awayGroup.rootId}"]`).count(), 0);
      await button('new-group').click();
      await page.locator('#miniV2EditName').fill('Temporary new group');
      for (const [key, value] of Object.entries({ size: 'Medium', creatureType: 'Humanoid', race: 'Human', sex: 'Male',
        role: 'Melee', set: 'n/a', paint: 'Painted', home: data.homeLocations[0] })) {
        await page.locator(`[data-edit-field="${key}"]`).selectOption(value);
      }
      await button('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Temporary new group');
      assert.deepEqual(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))), {
        'ppq-miniature-tracker:mock:next-sticker:v1': 'Z99', 'ppq-miniature-tracker:collection:next-sticker:v1': 'Z99'
      });
      await page.reload(); await settle();
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /612.*496/);
      assert.equal(await page.locator('tr[data-group-id]').count(), 496);
      await search(awayGroup.name); await openGroup(awayGroup.rootId); await settle();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), awayGroup.name);
      assert.equal(await page.locator(`select[data-copy-id="${awayCopy.id}"]`).inputValue(), awayCopy.currentLocation);
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), awayGroup.copies.length);
      await button('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), awayGroup.notes);
      await button('add-copy').click();
      assert.equal(await button('apply-next-sticker').innerText(), 'Apply F55');
      await button('discard-edit').click();
    });
    await check('failed collection load displays a retry message instead of mock rows or a broken screen', async () => {
      const failureHtml = read('Index.html').replace('<?!= include("Styles"); ?>', () => read('Styles.html'))
        .replace('<?!= initialStateJson ?>', '{"loadError":true}').replace('<?!= include("Scripts"); ?>', () => read('Scripts.html'));
      const failurePage = await browser.newPage();
      try {
        failurePage.on('pageerror', error => errors.push(error.message));
        await failurePage.setContent(failureHtml);
        assert.equal(await failurePage.locator('#miniV2RetryLoad').isVisible(), true);
        assert.match(await failurePage.locator('#app').innerText(), /No data was changed/);
        assert.equal(await failurePage.locator('tr[data-group-id]').count(), 0);
      } finally { await failurePage.close(); }
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'preview-results.json'), JSON.stringify({ candidateHash: report.candidateHash,
      checks: results, browserErrors: errors, actualRemoteWrites: false }, null, 2) + '\n');
    console.log(`PASS ${results.length} local real-data preview checks; no browser script errors`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
