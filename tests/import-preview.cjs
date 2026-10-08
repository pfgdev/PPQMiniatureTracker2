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
let tables = readback.some(sheet => sheet.title === 'Groups')
  ? Object.fromEntries(readback.map(sheet => [sheet.title, sheet.values])) : candidate.tables;
server.SpreadsheetApp = { openById(id) {
  assert.equal(id, snapshot.destination.spreadsheetId);
  return { getSheetByName(title) { return { getDataRange() { return {
    getDisplayValues: () => tables[title], getFormulas: () => [['']]
  }; } }; } };
} };
const originalData = server.buildSpreadsheetPreviewState_();
// Exercise the actual imported records through the reordered-column adapter, without editing a sheet.
tables = Object.fromEntries(Object.entries(tables).map(([title, rows]) => [title, rows.map(row => {
  const cells = Array.from({ length: rows[0].length }, (_, index) => row[index] ?? '');
  return cells.reverse();
})]));
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
    await check('all real-data columns can move without changing identities, blanks or catalog values', async () => {
      const contents = ({ generatedAt, ...state }) => JSON.stringify(state);
      assert.equal(contents(data), contents(originalData));
    });
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
    await check('long imported titles keep controls and fields inside the sidebar and use the shared marquee', async () => {
      const group = data.groups.find(group => group.name === 'Human Paladin of the Oath of Vengeance (Invisible)')
        || data.groups.slice().sort((a, b) => b.name.length - a.name.length)[0];
      await search(group.name); await openGroup(group.rootId); await settle();
      for (const width of [1440, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 }); await settle();
        const title = page.locator('#miniV2DetailHeaderTitle');
        assert.equal(await title.textContent(), group.name);
        assert.equal(await title.getAttribute('title'), group.name);
        assert.equal(await title.evaluate(node => !!node._miniV2MarqueeAnimation), true);
        assert.equal(await page.locator('#miniV2DetailPanel').evaluate(panel => {
          const bounds = panel.getBoundingClientRect();
          const header = panel.querySelector('.mini-v2-detail-header').getBoundingClientRect();
          const actions = panel.querySelector('.mini-v2-detail-header-actions').getBoundingClientRect();
          return header.right <= bounds.right && actions.right <= header.right
            && panel.querySelector('.mini-v2-detail-stage').scrollWidth <= panel.clientWidth;
        }), true);
        if (width === 1440) await page.locator('#miniV2DetailPanel').screenshot({ path: path.join(output, 'preview-long-title.png') });
      }
      await button('edit-mini').click();
      assert.equal(await page.locator('#miniV2EditName').inputValue(), group.name);
      await button('discard-edit').click(); await button('close-detail').click();
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check('preserved missing fields remain visible instead of being guessed', async () => {
      await search('Quickling'); await openGroup('090-QUI'); await settle();
      assert.equal(await button('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
      assert.match(await page.locator('#miniV2DetailStatusTip').textContent(), /Race/);
      const race = page.locator('.mini-v2-detail-grid .mini-v2-read-card').nth(2).locator('.mini-v2-read-value');
      assert.equal(await race.textContent(), 'Not entered');
      assert.equal(await race.evaluate(n => n.classList.contains('mini-v2-missing-value')), true);
      assert.equal(await page.locator('tr[data-group-id="090-QUI"] .mini-v2-cell-race').textContent(), 'Not entered');
      await page.locator('#miniV2DetailPanel').screenshot({ path: path.join(output, 'preview-quickling-missing-race.png') });
      await button('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), '');
      await button('discard-edit').click();
      assert.equal(await race.textContent(), 'Not entered');
      await button('close-detail').click();
      await page.locator('button[data-facet-key="races"]').click();
      await page.locator('[data-facet-kind="races"][data-facet-value="n/a"]').click();
      assert.equal(await page.locator('tr[data-group-id="090-QUI"]').count(), 0);
      await button('clear-open-facet').click();
      assert.equal(await page.locator('tr[data-group-id="090-QUI"]').count(), 1);
      await page.locator('button[data-facet-key="races"]').click();
    });
    await check('Record status finds imported omissions in either browse mode and remains separate from stickers', async () => {
      const blank = value => value == null || String(value).trim() === '';
      const missingFields = group => ['name', 'home', 'size', 'creatureType', 'race', 'sex', 'role', 'paint', 'set'].some(field => blank(group[field]))
        || (!['', 'n/a', 'not specified'].includes(String(group.set || '').trim().toLowerCase()) && blank(group.setNumber));
      const incompleteGroups = data.groups.filter(group => missingFields(group) || group.copies.some(copy => blank(copy.sticker)));
      const incompleteCopies = data.groups.flatMap(group => group.copies.filter(copy => missingFields(group) || blank(copy.sticker)).map(copy => copy.id));
      assert.ok(incompleteGroups.some(group => group.rootId === '090-QUI'));
      await search('');
      await page.locator('button[data-facet-key="more"]').click();
      const status = value => page.locator(`[data-facet-kind="recordStatuses"][data-facet-value="${value}"]`);
      const rows = () => page.locator('.mini-v2-browse-table tbody tr');
      await status('Incomplete').click();
      assert.deepEqual(new Set(await rows().evaluateAll(nodes => nodes.map(n => n.dataset.groupId))), new Set(incompleteGroups.map(group => group.rootId)));
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('[data-browse-mode="individuals"]').click();
      assert.deepEqual(new Set(await rows().evaluateAll(nodes => nodes.map(n => n.dataset.copyId))), new Set(incompleteCopies));
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('[data-facet-kind="stickers"][data-facet-value="Missing"]').click();
      assert.equal(await rows().count(), 0, 'the imported omissions are descriptive fields, not blank stickers');
      await button('clear-open-facet').click();
      await status('Complete').click();
      assert.equal(await rows().count(), report.stats.copies - incompleteCopies.length);
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('[data-browse-mode="groups"]').click();
      assert.equal(await rows().count(), report.stats.groups - incompleteGroups.length);
      await button('clear-filters').click();
      assert.equal(await rows().count(), report.stats.groups);
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
    await check('real-data list manager fits long Set names and resets catalog changes on reload', async () => {
      await page.goto('https://ppq-preview.test/'); await settle();
      await search(longestSet.name); await openGroup(longestSet.rootId); await settle();
      await button('edit-mini').click();
      await page.locator('[data-action="open-lists"]:visible').click();
      await page.locator('[data-list-key="set"]').click();
      const names = await page.locator('.mini-v2-list-choice-name').allTextContents();
      assert.ok(data.catalogs.set.every(value => names.includes(value)));
      const row = page.locator('.mini-v2-list-choice').filter({ has: page.getByText(longestSet.set, { exact: true }) });
      await row.locator('[data-list-action="rename"]').click();
      const renamed = `${longestSet.set} (preview rename)`;
      await page.locator('#miniV2ListName').fill(renamed);
      await page.screenshot({ path: path.join(output, 'preview-lists-desktop.png') });
      await page.locator('[data-list-action="save"]').click();
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), renamed);
      assert.equal(await button('save-edit').isDisabled(), true, 'a catalog rename is independent of the miniature draft');
      await page.locator('[data-list-action="add"]').click();
      await page.locator('#miniV2ListName').fill('Temporary catalog choice');
      await page.locator('[data-list-action="save"]').click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#miniV2ListsSearch').fill(longestSet.set);
      const dialog = page.locator('#miniV2ListsDialog');
      assert.ok(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth));
      assert.equal(await page.locator('.mini-v2-list-choice-name').innerText(), renamed);
      await page.screenshot({ path: path.join(output, 'preview-lists-phone.png') });
      await page.locator('[data-list-action="close"]').click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.reload(); await settle();
      await search(longestSet.name); await openGroup(longestSet.rootId); await settle();
      await button('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), longestSet.set);
      const restored = await page.locator('[data-edit-field="set"] option').evaluateAll(nodes => nodes.map(n => n.value));
      assert.ok(!restored.includes(renamed) && !restored.includes('Temporary catalog choice'));
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /612.*496/);
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
