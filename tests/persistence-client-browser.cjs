'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { fixture, read, preview, client, groupTarget, request, repo } = require('./helpers/persistence-fixture.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let f, count = 0;
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__miniPersistenceSend', req => f.send(req));
    const load = async (targetPage = page, testMode = true) => {
      const data = { saveTestMode: testMode, previewMode: true, persistenceSnapshot: f.load().snapshot };
      const html = read('Index.html').replace('<?!= initialStateJson ?>', JSON.stringify(data).replace(/</g, '\\u003c'))
        .replace(/<\?!= include\("(\w+)"\); \?>/g, (_, file) => (file === 'Scripts' ? read('PersistenceClient.html') : '') + read(file + '.html'));
      await targetPage.goto('about:blank'); await targetPage.setContent(html); await targetPage.waitForTimeout(120);
    };
    const action = name => page.locator(`[data-action="${name}"]`);
    const settled = () => page.waitForFunction(() => document.getElementById('miniV2Root').dataset.saveState !== 'saving');
    const open = async (id = 'one') => { await page.locator(`tr[data-group-id="${id}"] .mini-v2-name`).click(); };
    const edit = async (notes = 'Stored notes') => { await action('edit-mini').click(); await page.locator('[data-edit-field="notes"]').fill(notes); };
    const recovery = async () => { await page.locator('[data-summary-panel="changes"]').click(); await action('open-recovery').click(); };
    const check = async (name, fn) => {
      f = fixture(); await load(); await fn(); assert.deepEqual(errors, []); count++; console.log('PASS ' + name);
    };
    await check('existing save button writes through the actual offline contract and reloads saved data', async () => {
      await open(); await edit(); await action('save-edit').click(); await settled();
      assert.equal(f.stored().groups[0].notes, 'Stored notes'); assert.equal(f.sent[0].kind, 'saveGroup');
      await load(); await open(); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Stored notes');
    });
    await check('new group receives stable IDs without losing the selected sidebar or its copies', async () => {
      await action('new-group').click(); await page.locator('#miniV2EditName').fill('New Soldier');
      for (const [key, value] of Object.entries({ size: 'Medium', creatureType: 'Humanoid', race: 'Human', sex: 'Male', role: 'Melee', set: 'n/a', paint: 'Painted', home: 'Drawer' })) {
        await page.locator(`[data-edit-field="${key}"]`).selectOption(value);
      }
      await action('add-copy').click();
      f.mode = 'lost'; await action('save-edit').click(); await settled();
      assert.equal(f.stored().groups.length, 3); assert.equal(await action('discard-edit').isDisabled(), true);
      await action('save-edit').click(); await settled();
      assert.equal(f.commits, 1); assert.deepEqual(f.sent[0], f.sent[1]);
      const created = f.stored().groups.find(group => group.name === 'New Soldier');
      assert.match(created.rootId, /^[a-f\d-]{36}$/);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'New Soldier');
      assert.equal(await page.locator(`tr[data-group-id="${created.rootId}"]`).count(), 1);
      assert.equal(await page.locator('[data-detail-copy-id]').count(), 2);
      await edit('Second save with permanent IDs'); await action('save-edit').click(); await settled();
      assert.equal(f.sent[2].payload.rootId, created.rootId); assert.ok(f.sent[2].payload.copies.every(copy => copy.id));
      await load(); await open(created.rootId); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Second save with permanent IDs');
    });
    await check('saved copy additions and removals retain server numbering and deletion history', async () => {
      await open(); await edit(); await action('add-copy').click(); await action('save-edit').click(); await settled();
      let copies = f.stored().copies.filter(copy => copy.rootId === 'one');
      const added = copies.find(copy => copy.id !== 'one-01'); assert.match(added.id, /^[a-f\d-]{36}$/); assert.equal(added.miniNumber, '02');
      await action('edit-mini').click(); await page.locator(`[data-remove-copy="${added.id}"]`).click();
      await action('save-edit').click(); await settled();
      assert.ok(f.stored().copies.find(copy => copy.id === added.id).deletedAt);
      await edit(); await action('add-copy').click(); await action('save-edit').click(); await settled();
      copies = f.stored().copies.filter(copy => copy.rootId === 'one' && !copy.deletedAt);
      assert.equal(copies.find(copy => copy.id !== 'one-01').miniNumber, '03');
    });
    await check('list rename relabels a parked draft while preserving stable references and the draft', async () => {
      await open(); await edit('Keep my notes'); await page.locator('[data-action="open-lists"]:visible').click();
      await page.locator('[data-list-key="race"]').click();
      const row = page.locator('.mini-v2-list-choice').filter({ has: page.getByText('Human', { exact: true }) });
      const raceId = f.stored().groups[0].raceId;
      await row.locator('[data-list-action="rename"]').click(); await page.locator('#miniV2ListName').fill('Humans');
      await page.locator('[data-list-action="save"]').click(); await settled();
      await page.locator('[data-list-action="close"]').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), 'Humans');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep my notes');
      await action('save-edit').click(); await settled();
      assert.equal(f.stored().groups[0].raceId, raceId); assert.equal(f.stored().groups[0].notes, 'Keep my notes');
      await load(); await open(); assert.match(await page.locator('.mini-v2-detail-grid').innerText(), /Humans/);
    });
    await check('two tabs use the approved overwrite and discard controls with actual record tokens', async () => {
      const other = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      other.on('pageerror', error => errors.push(error.message));
      await other.exposeFunction('__miniPersistenceSend', req => f.send(req)); await load(other);
      try {
        await open(); await edit('My notes');
        await other.locator('tr[data-group-id="one"] .mini-v2-name').click(); await other.locator('[data-action="edit-mini"]').click();
        await other.locator('#miniV2EditName').fill('Saved in other tab');
        await other.locator('[data-action="save-edit"]').click();
        await other.waitForFunction(() => document.getElementById('miniV2Root').dataset.saveState !== 'saving');
        await page.locator('#miniV2EditName').fill('My name'); await action('save-edit').click(); await settled();
        assert.equal(f.commits, 1);
        await page.locator('[data-save-notice="detail"] [data-save-action="overwrite"]').click(); await settled();
        assert.equal(f.commits, 2); assert.equal(f.stored().groups[0].name, 'My name'); assert.equal(f.stored().groups[0].notes, 'My notes');
        await other.locator('[data-action="edit-mini"]').click(); await other.locator('#miniV2EditName').fill('Rejected edit');
        await other.locator('[data-action="save-edit"]').click();
        await other.waitForFunction(() => document.getElementById('miniV2Root').dataset.saveState !== 'saving');
        await other.locator('[data-save-notice="detail"] [data-save-action="discard"]').click();
        assert.equal(f.commits, 2); assert.equal(await other.locator('#miniV2DetailHeaderTitle').innerText(), 'My name');
      } finally { await other.close(); }
    });
    await check('Save All commits parked group and location drafts together and reload confirms both', async () => {
      await open('one'); await action('set-all-home').click(); await action('close-detail').click();
      await open('two'); await edit('Batched'); await action('close-detail').click();
      await page.locator('[data-summary-panel="changes"]').click(); await action('save-all-pending').click(); await settled();
      assert.equal(f.commits, 1); assert.equal(f.sent[0].kind, 'saveBatch');
      assert.deepEqual(f.sent[0].payload.changes.map(item => item.kind), ['saveLocations', 'saveGroup']);
      await load(); await open('one'); assert.equal(await page.locator('select[data-copy-id="one-01"]').inputValue(), 'Drawer');
      await open('two'); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Batched');
    });
    await check('delete and Undo use durable identities, not accidental group recreation', async () => {
      await open(); await edit(); await action('delete-group').click(); await action('confirm-delete-group').click(); await settled();
      assert.ok(f.stored().groups[0].deletedAt); assert.equal(await page.locator('tr[data-group-id="one"]').count(), 0);
      await page.locator('[data-summary-panel="changes"]').click(); await action('undo-delete-group').click(); await settled();
      assert.equal(f.sent.at(-1).kind, 'restoreGroup'); assert.equal(f.stored().groups[0].deletedAt, '');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Stored notes');
      assert.equal(f.stored().groups[0].notes, '', 'restoring does not secretly save a parked draft');
    });
    await check('removed groups can be found after reload and restored without losing an unrelated draft', async () => {
      await open(); await edit('Never saved'); await action('delete-group').click(); await action('confirm-delete-group').click(); await settled();
      await load(); await open('two'); await edit('Keep this draft'); await recovery();
      assert.match(await page.locator('#miniV2RecoveryRows').innerText(), /First Soldier/);
      await page.locator('[data-recovery-id="one"]').click(); await settled();
      assert.equal(f.sent.at(-1).kind, 'restoreGroup'); assert.equal(f.stored().groups[0].notes, '');
      assert.equal(await page.locator('#miniV2RecoveryNotice').innerText(), 'Restored.');
      await page.locator('[data-recovery-action="close"]').click();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep this draft');
      await action('discard-edit').click(); await open('one');
      assert.equal(await page.locator('[data-edit-field="notes"]').count(), 0, 'discarded reload drafts are not restored');
      assert.equal(f.stored().copies.filter(copy => copy.rootId === 'one').length, 1);
    });
    await check('removed copies recover after reload and a lost response retries the same request', async () => {
      await open(); await edit(); await action('add-copy').click(); await action('save-edit').click(); await settled();
      const added = f.stored().copies.find(copy => copy.rootId === 'one' && copy.id !== 'one-01');
      await action('edit-mini').click(); await page.locator(`[data-remove-copy="${added.id}"]`).click();
      await action('save-edit').click(); await settled(); await load(); await recovery();
      await page.locator('[data-recovery-kind="copies"]').click(); f.mode = 'lost';
      await page.locator(`[data-recovery-id="${added.id}"]`).click(); await settled();
      assert.equal(await page.locator('[data-save-notice="recovery"] [data-save-action="edit"]').count(), 0);
      await page.locator('[data-recovery-kind="groups"]').click();
      await page.locator('[data-save-notice="recovery"] [data-save-action="retry"]').click(); await settled();
      assert.deepEqual(f.sent.at(-1), f.sent.at(-2)); assert.equal(f.commits, 3);
      await page.locator('[data-recovery-kind="copies"]').click();
      assert.equal(await page.locator(`[data-recovery-id="${added.id}"]`).count(), 0);
      await page.locator('[data-recovery-action="close"]').click(); await open();
      assert.equal(await page.locator('[data-detail-copy-id]').count(), 2);
    });
    await check('removed choices are discoverable after reload and restoration errors are visible', async () => {
      const human = f.stored().choices.find(choice => choice.field === 'race' && choice.value === 'Human');
      f.external('removeChoice', { id: human.id }); await load();
      await page.locator('[data-action="open-lists"]:visible').click(); await page.locator('[data-list-key="race"]').click();
      assert.equal(await page.locator(`[data-list-action="restore"][data-choice-id="${human.id}"]`).count(), 0);
      await page.locator('#miniV2ListsRemoved').check(); f.mode = 'failure';
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const dialog = page.locator('#miniV2ListsDialog');
        assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
        await page.screenshot({ path: path.join(repo, `.local/save-flow/removed-choices-${width}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const restore = page.locator(`[data-list-action="restore"][data-choice-id="${human.id}"]`);
      await restore.click(); await settled(); assert.equal(await page.locator('[data-save-notice="list"]').isVisible(), true);
      await page.locator('#miniV2ListsSearch').fill('Human'); assert.equal(await restore.innerText(), 'Retry');
      await restore.click(); await settled();
      assert.equal(f.stored().choices.find(choice => choice.id === human.id).removedAt, '',
        JSON.stringify({ sent: f.sent, feedback: await page.locator('#miniV2ListsForm').innerText(), errors }));
      await page.locator('[data-list-action="close"]').click(); await open();
      assert.match(await page.locator('.mini-v2-detail-grid').innerText(), /Human/);
    });
    await check('restore conflicts do not steal reassigned stickers and fit the modal on desktop and phone', async () => {
      f.external('deleteGroup', { rootId: 'one' });
      const c = client(f), target = groupTarget(c, 'two'); target.value.copies['two-01'].sticker = 'A00';
      assert.equal((await c.send(request(target))).ok, true); await load(); await recovery();
      const commits = f.commits;
      await page.locator('[data-recovery-id="one"]').click(); await settled();
      assert.match(await page.locator('[data-save-notice="recovery"]').innerText(), /sticker/i);
      assert.equal(f.commits, commits); assert.ok(f.stored().groups[0].deletedAt);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const dialog = page.locator('#miniV2RecoveryDialog');
        const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
        await page.screenshot({ path: path.join(repo, `.local/save-flow/recovery-${width}.png`), fullPage: true });
      }
      await page.locator('[data-save-notice="recovery"] [data-save-action="edit"]').click();
      assert.equal(await page.locator('[data-recovery-id="one"]').isEnabled(), true);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#miniV2RecoveryDialog').isVisible(), false);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check('restore and save explicitly revives a remotely deleted group without dropping edited fields', async () => {
      await open(); await edit('My recovered edits'); f.external('deleteGroup', { rootId: 'one' });
      await action('save-edit').click(); await settled();
      const restore = page.locator('[data-save-notice="detail"] [data-save-action="overwrite"]');
      assert.equal(await restore.innerText(), 'Restore and Save'); await restore.click(); await settled();
      assert.equal(f.sent.at(-1).kind, 'restoreGroupAndSave'); assert.equal(f.stored().groups[0].deletedAt, '');
      assert.equal(f.stored().groups[0].notes, 'My recovered edits');
      await load(); await open(); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'My recovered edits');
    });
    await check('cancelling a stale restore adopts the active group without leaving a destructive stale Undo', async () => {
      await open(); await edit('Unsubmitted before deletion'); await action('delete-group').click();
      await action('confirm-delete-group').click(); await settled(); await recovery();
      f.external('restoreGroup', { rootId: 'one' });
      await page.locator('[data-recovery-id="one"]').click(); await settled();
      const cancel = page.locator('[data-save-notice="recovery"] [data-save-action="discard"]');
      assert.equal(await cancel.innerText(), 'Cancel Restore'); await cancel.click();
      await page.locator('[data-recovery-action="close"]').click();
      await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await action('undo-delete-group').count(), 0); assert.equal(f.commits, 2);
      assert.equal(f.stored().groups[0].notes, ''); assert.equal(await page.locator('tr[data-group-id="one"]').count(), 1);
    });
    await check('next ID fills catalog gaps after reload and discarded assignments release their reservations', async () => {
      await open(); await edit(); await page.locator('[data-edit-copy-sticker="one-01"]').fill('A41');
      await action('save-edit').click(); await settled();
      await load(); await open(); await action('edit-mini').click(); await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A00');
      await action('apply-next-sticker').click(); await action('discard-edit').click();
      assert.equal(f.stored().copies.length, 2);
      await load(); await open(); await action('edit-mini').click(); await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A00'); await action('apply-next-sticker').click();
      await action('save-edit').click(); await settled();
      await load(); await open(); await action('edit-mini').click(); await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A02');
    });
    await check('manual later IDs in parked drafts do not override the earliest unused catalog ID', async () => {
      await open(); await edit('Parked'); await page.locator('[data-edit-copy-sticker="one-01"]').fill('A51');
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A02');
      await action('close-detail').click(); await open('two'); await edit('Only these notes');
      await action('save-edit').click(); await settled();
      assert.equal(f.sent[0].stickerPreference, undefined); assert.equal('stickerStart' in f.stored(), false);
      await load(); await open(); await action('edit-mini').click(); await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A02');
    });
    await check('D11 stays the suggestion with A through F otherwise assigned, even after manually using G55', async () => {
      const data = preview();
      data.stickerCatalog = Array.from({ length: 700 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 100)) + String(i % 100).padStart(2, '0'));
      data.groups[0].copies[0].sticker = 'G41';
      data.groups[1].copies = data.stickerCatalog.slice(0, 600).filter(code => code !== 'D11').map((sticker, index) => ({
        id: `two-${sticker}`, miniNumber: String(index + 1), sticker, note: '', currentLocation: 'Drawer'
      }));
      f = fixture(data); await load(); await open(); await action('edit-mini').click();
      await page.locator('[data-edit-copy-sticker="one-01"]').fill('G55');
      await action('add-copy').click(); assert.equal(await action('apply-next-sticker').innerText(), 'Apply D11');
      await action('save-edit').click(); await settled(); await load(); await open(); await action('edit-mini').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply D11');
      await action('apply-next-sticker').click(); assert.equal(await action('apply-next-sticker').innerText(), 'Apply G00');
      await action('discard-edit').click(); await action('edit-mini').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply D11');
      await action('apply-next-sticker').click(); await action('save-edit').click(); await settled();
      await load(); await open(); await action('edit-mini').click(); assert.equal(await action('apply-next-sticker').innerText(), 'Apply G00');
    });
    await check('ordinary preview supports session recovery without enabling the persistent adapter', async () => {
      const data = { ...client(f).initialState(), previewMode: true, saveTestMode: true };
      const html = read('Index.html').replace('<?!= initialStateJson ?>', JSON.stringify(data))
        .replace(/<\?!= include\("(\w+)"\); \?>/g, (_, file) => read(file + '.html'));
      await page.goto('about:blank'); await page.setContent(html); await open(); await edit();
      await action('delete-group').click(); await action('confirm-delete-group').click(); await settled();
      await recovery(); await page.locator('[data-recovery-id="one"]').click(); await settled();
      await page.locator('[data-recovery-action="close"]').click();
      assert.equal(await page.locator('tr[data-group-id="one"]').count(), 1); assert.equal(f.sent.length, 0);
    });
    await check('candidate storage mode fails closed outside the local test harness', async () => {
      await load(page, false);
      assert.match(await page.locator('#app').innerText(), /Collection preview unavailable/);
      assert.equal(f.sent.length, 0); assert.equal(f.commits, 0);
    });
    console.log(`${count} persistence-bridge browser checks passed.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
