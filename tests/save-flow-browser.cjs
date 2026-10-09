const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const server = vm.createContext({}); vm.runInContext(read('Code.js'), server);
const data = server.buildMockAppState_(); data.saveTestMode = true;
const html = read('Index.html').replace('<?!= initialStateJson ?>', JSON.stringify(data))
  .replace(/<\?!= include\("(\w+)"\); \?>/g, (_, file) => read(file + '.html'));
const soldier = '013-ZHESOL', fighter = '048-SPIFOLFIG';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const action = name => page.locator(`[data-action="${name}"]`);
    const settled = () => page.waitForFunction(() => document.getElementById('miniV2Root').dataset.saveState !== 'saving');
    const fresh = async () => { await page.goto('about:blank'); await page.setContent(html); await page.waitForTimeout(350); };
    const open = async id => { await page.locator(`tr[data-group-id="${id}"] .mini-v2-name`).click(); await page.waitForTimeout(300); };
    const edit = async () => { await action('edit-mini').click(); await page.locator('[data-edit-field="notes"]').fill('Keep my draft'); };
    // Choose using the actual preview control, since starting a request consumes that setting.
    const choose = async mode => {
      await page.locator('[data-summary-panel="demo"]').click();
      await page.locator('.mini-v2-save-trials summary').click();
      await page.locator('[data-save-outcome]').selectOption(mode);
      await page.keyboard.press('Escape');
    };
    const inspect = () => page.evaluate(() => window.__miniSaveTest.transport.inspect());
    const warning = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    let count = 0;
    const check = async (name, fn) => { await fresh(); await fn(); assert.deepEqual(errors, []); count++; console.log('PASS ' + name); };

    await check('acknowledgment gates saving; closing in flight keeps draft and does not reopen inspector', async () => {
      await open(soldier); await edit();
      const header = await page.locator('.mini-v2-detail-header').boundingBox();
      await action('save-edit').click();
      assert.equal(await action('save-edit').innerText(), 'Saving...');
      assert.equal(await action('save-edit').isDisabled(), true);
      assert.equal(await page.locator('[data-edit-field="notes"]').isDisabled(), true);
      assert.equal(await warning(), true);
      assert.equal((await page.locator('.mini-v2-detail-header').boundingBox()).height, header.height);
      await action('close-detail').click(); await settled();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Mini Details');
      await open(soldier); assert.match(await page.locator('.mini-v2-note-body').innerText(), /Keep my draft/);
      assert.equal(await warning(), false); assert.equal((await inspect()).commits, 1);
    });
    await check('failed save keeps exact request and enables safe Retry without duplicate submissions', async () => {
      await choose('failure'); await open(soldier); await edit(); await action('save-edit').click(); await settled();
      assert.equal(await action('save-edit').innerText(), 'Retry'); assert.equal(await warning(), true);
      assert.equal((await inspect()).commits, 0);
      const before = await page.evaluate(() => window.__miniSaveTest.job().request);
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my draft');
      await action('save-edit').dblclick(); await settled();
      assert.equal((await inspect()).sends, 2); assert.equal((await inspect()).commits, 1);
      assert.ok(before.requestId); assert.equal(await warning(), false);
    });
    await check('lost confirmation protects submitted work, and retry adds a new copy only once', async () => {
      await choose('lost'); await open(soldier); await action('edit-mini').click(); await action('add-copy').click();
      await action('save-edit').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await action('discard-edit').isDisabled(), true);
      assert.equal(await page.locator('[data-save-notice="detail"] [data-save-action="edit"]').count(), 0);
      await action('save-edit').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await page.locator('[data-detail-copy-id]').count(), 4);
    });
    await check('missing callback times out without losing the draft; late requests can be retried safely', async () => {
      await open(soldier); await edit();
      await page.evaluate(() => {
        const transport = window.__miniSaveTest.transport, send = transport.send, timeout = window.setTimeout;
        let first = true;
        window.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 15000 ? 20 : ms, ...args);
        transport.send = request => { if (first) { first = false; return new Promise(() => {}); } return send(request); };
      });
      await action('save-edit').click(); await settled();
      assert.equal(await warning(), true); assert.equal(await action('discard-edit').isDisabled(), true);
      await page.evaluate(() => {
        const timeout = window.setTimeout;
        window.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 15000 ? 14000 : ms, ...args);
      });
      await action('save-edit').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await warning(), false);
    });
    await check('malformed acknowledgment after commit retains exact retry and avoids duplicate writes', async () => {
      await open(soldier); await edit();
      await page.evaluate(() => {
        const transport = window.__miniSaveTest.transport, send = transport.send; let first = true;
        transport.send = async request => { const result = await send(request); if (first) { first = false; return { ok: true }; } return result; };
      });
      await action('save-edit').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await warning(), true);
      await action('save-edit').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await warning(), false);
    });
    await check('Save Anyway keeps unrelated saved fields without a comparison step', async () => {
      await choose('conflict'); await open(soldier); await edit(); await action('save-edit').click(); await settled();
      const notice = page.locator('[data-save-notice="detail"]');
      assert.match(await notice.innerText(), /This entry changed since you opened it\.\s+Save your changes anyway\?/);
      assert.equal(await notice.locator('button').count(), 2);
      assert.equal(await action('save-edit').isDisabled(), true);
      assert.equal((await inspect()).commits, 0);
      await notice.getByRole('button', { name: 'Save Anyway', exact: true }).click(); await settled();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier - Updated');
      assert.match(await page.locator('.mini-v2-note-body').innerText(), /Keep my draft/);
    });
    await check('Save Anyway replaces conflicting saved values with the users changes', async () => {
      await choose('conflict'); await open(soldier); await action('edit-mini').click();
      await page.locator('#miniV2EditName').fill('My revised name'); await action('save-edit').click(); await settled();
      const notice = page.locator('[data-save-notice="detail"]');
      assert.equal(await notice.locator('select').count(), 0);
      await notice.locator('[data-save-action="overwrite"]').click(); await settled();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'My revised name');
      assert.equal((await inspect()).commits, 1);
    });
    await check('Discard My Changes loads the saved entry and leaves an unrelated draft alone', async () => {
      await open(fighter); await edit(); await action('close-detail').click();
      await choose('conflict'); await open(soldier); await edit();
      await action('add-copy').click(); await action('save-edit').click(); await settled();
      await page.locator('[data-save-notice="detail"]').getByRole('button', { name: 'Discard My Changes', exact: true }).click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier - Updated');
      assert.doesNotMatch(await page.locator('.mini-v2-note-body').innerText(), /Keep my draft/);
      assert.equal(await page.locator('[data-detail-copy-id]').count(), 3);
      assert.equal((await inspect()).sends, 1); assert.equal((await inspect()).commits, 0);
      assert.equal(await page.evaluate(() => window.__miniSaveTest.job()), null);
      await open(fighter); assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my draft');
      assert.equal(await warning(), true);
      await action('discard-edit').click(); assert.equal(await warning(), false);
    });
    await check('discarding location-only changes restores saved destinations', async () => {
      await choose('conflict'); await open(fighter); await action('set-all-home').click();
      await action('save-changes').click(); await settled();
      await page.locator('[data-save-notice="detail"] [data-save-action="discard"]').click();
      assert.equal(await action('save-changes').isDisabled(), true);
      assert.equal(await page.locator('select[data-copy-id]').evaluateAll(nodes => nodes.filter(node => node.value !== 'Spare People').length), 2);
      assert.equal(await warning(), false); assert.equal((await inspect()).commits, 0);
    });
    await check('discard from Save All affects only the named changed entry, not the other pending groups', async () => {
      await choose('conflict'); await open(soldier); await edit(); await action('close-detail').click();
      await open(fighter); await action('set-all-home').click(); await action('close-detail').click();
      await page.locator('[data-summary-panel="changes"]').click(); await action('save-all-pending').click(); await settled();
      const notice = page.locator('[data-save-notice="summary"]');
      assert.match(await notice.innerText(), /Discard only affects: Zhent Soldier\./);
      await notice.locator('[data-save-action="discard"]').click();
      assert.match(await page.locator('.mini-v2-pending-scope').innerText(), /1 group/);
      assert.equal((await inspect()).commits, 0); assert.equal(await warning(), true);
      await action('save-all-pending').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await warning(), false);
      const stored = (await inspect()).records.find(record => record.value?.rootId === soldier).value;
      assert.equal(stored.name, 'Zhent Soldier - Updated'); assert.notEqual(stored.notes, 'Keep my draft');
    });
    await check('discarding a list rename adopts the saved choice without losing miniature or other list drafts', async () => {
      await choose('conflict'); await open(soldier); await edit(); await page.locator('[data-action="open-lists"]:visible').click();
      await page.locator('[data-list-key="set"]').click(); await page.locator('[data-list-action="add"]').click();
      await page.locator('#miniV2ListName').fill('My unfinished set');
      await page.locator('[data-list-key="race"]').click();
      const row = page.locator('.mini-v2-list-choice').filter({ has: page.getByText('Human', { exact: true }) });
      await row.locator('[data-list-action="rename"]').click(); await page.locator('#miniV2ListName').fill('Humans');
      await page.locator('[data-list-action="save"]').click(); await settled();
      await page.locator('[data-save-notice="list"] [data-save-action="discard"]').click();
      assert.equal(await page.locator('#miniV2ListName').count(), 0);
      assert.equal(await page.locator('.mini-v2-list-choice').getByText('Human - Updated', { exact: true }).count(), 1);
      await page.locator('[data-list-key="set"]').click();
      assert.equal(await page.locator('#miniV2ListName').inputValue(), 'My unfinished set');
      await page.locator('[data-list-action="close"]').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), 'Human - Updated');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my draft');
      assert.equal((await inspect()).sends, 1); assert.equal((await inspect()).commits, 0);
    });
    await check('discarding a stale deletion keeps the saved group and creates no deletion history', async () => {
      await choose('conflict'); await open(soldier); await edit(); await action('delete-group').click();
      await action('confirm-delete-group').click(); await settled();
      const notice = page.locator('[data-save-notice="detail"]');
      assert.equal(await notice.getByRole('button', { name: 'Delete Anyway', exact: true }).count(), 1);
      await notice.locator('[data-save-action="discard"]').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier - Updated');
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 1);
      await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await action('undo-delete-group').count(), 0);
      assert.equal(await warning(), false); assert.equal((await inspect()).commits, 0);
    });
    await check('unrelated drafts and navigation survive an in-flight save', async () => {
      await open(soldier); await edit(); await action('close-detail').click();
      await open(fighter); await action('set-all-home').click(); await choose('failure');
      await action('save-changes').click(); await settled();
      await open(soldier); assert.equal(await page.locator('[data-edit-field="notes"]').isDisabled(), false);
      await page.locator('[data-edit-field="notes"]').fill('Newer unrelated draft');
      await page.locator('[data-summary-panel="changes"]').click();
      await page.locator('[data-save-notice="summary"] [data-save-action="retry"]').click(); await settled();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Newer unrelated draft');
      assert.equal(await warning(), true);
    });
    await check('list failure preserves form and miniature draft, and successful rename is independent', async () => {
      await choose('failure'); await open(soldier); await edit(); await page.locator('[data-action="open-lists"]:visible').click();
      await page.locator('[data-list-key="race"]').click();
      const row = page.locator('.mini-v2-list-choice').filter({ has: page.getByText('Human', { exact: true }) });
      await row.locator('[data-list-action="rename"]').click(); await page.locator('#miniV2ListName').fill('Humans');
      await page.locator('[data-list-action="save"]').click(); await settled();
      assert.equal(await page.locator('#miniV2ListName').inputValue(), 'Humans');
      await page.locator('[data-list-action="save"]').click(); await settled();
      await page.locator('[data-list-action="close"]').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), 'Humans');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my draft');
      await action('discard-edit').click(); assert.match(await page.locator('.mini-v2-detail-grid').innerText(), /Humans/);
    });
    await check('failed Save All keeps every group, even hidden drafts, until one atomic retry', async () => {
      await choose('failure'); await open(soldier); await edit(); await action('close-detail').click();
      await open(fighter); await action('set-all-home').click(); await action('close-detail').click();
      await page.locator('#miniV2SearchInput').fill('Zhent');
      await page.locator('[data-summary-panel="changes"]').click(); await action('save-all-pending').click(); await settled();
      assert.equal((await inspect()).commits, 0); assert.equal(await warning(), true);
      assert.match(await page.locator('.mini-v2-pending-scope').innerText(), /2 groups/);
      await action('save-all-pending').click(); await settled();
      assert.equal((await inspect()).commits, 1); assert.equal(await warning(), false);
      assert.match(await page.locator('.mini-v2-pending-scope').innerText(), /No pending edits/);
    });
    await check('confirmed failure can return to editing; a revised save gets a new request', async () => {
      await choose('failure'); await open(soldier); await edit(); await action('save-edit').click(); await settled();
      const first = await page.evaluate(() => window.__miniSaveTest.job().request.requestId);
      await page.locator('[data-save-notice="detail"] [data-save-action="edit"]').click();
      await page.locator('[data-edit-field="notes"]').fill('Revised draft'); await action('save-edit').click();
      assert.notEqual(await page.evaluate(() => window.__miniSaveTest.job().request.requestId), first);
      await settled(); assert.match(await page.locator('.mini-v2-note-body').innerText(), /Revised draft/);
    });
    await check('another saved edit after the warning requires a fresh confirmation', async () => {
      await choose('conflict'); await open(soldier); await edit(); await action('save-edit').click(); await settled();
      await page.evaluate(() => {
        const target = window.__miniSaveTest.job().request.targets[0];
        window.__miniSaveTest.transport.change(target, { ...target.before, name: 'Third edit' });
      });
      await page.locator('[data-save-notice="detail"] [data-save-action="overwrite"]').click(); await settled();
      assert.equal((await inspect()).commits, 0); assert.equal(await warning(), true);
      assert.equal(await action('save-edit').isDisabled(), true);
      await page.locator('[data-save-notice="detail"] [data-save-action="overwrite"]').click(); await settled();
      assert.equal((await inspect()).commits, 1);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Third edit');
    });
    await check('deletion remains unapplied on failure; Retry and Undo use separate acknowledgments', async () => {
      await choose('failure'); await open(soldier); await edit(); await action('delete-group').click();
      await action('confirm-delete-group').click(); await settled();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 1);
      await action('confirm-delete-group').click(); await settled();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 0);
      await page.locator('[data-summary-panel="changes"]').click(); await action('undo-delete-group').click(); await settled();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my draft');
      assert.equal((await inspect()).commits, 2);
    });
    await check('narrow conflict feedback stays in the sidebar without horizontal page overflow', async () => {
      await page.setViewportSize({ width: 390, height: 850 });
      await choose('conflict'); await open(soldier); await action('edit-mini').click();
      await page.locator('#miniV2EditName').fill('My name'); await action('save-edit').click(); await settled();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      fs.mkdirSync(path.join(repo, '.local/save-flow'), { recursive: true });
      await page.screenshot({ path: path.join(repo, '.local/save-flow/conflict-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForTimeout(350);
      await page.locator('[data-save-notice="detail"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(repo, '.local/save-flow/conflict-desktop.png'), fullPage: true });
    });
    console.log(`${count} save-flow browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
