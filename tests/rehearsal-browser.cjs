'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { rehearsalFixture } = require('./helpers/rehearsal-fixture.cjs');
const live = process.env.LIVE_BUILD === '1';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let f, loseReply = false, checks = 0, holdReplies = false, heldReplies = [];
    const errors = [];
    const install = async target => {
      target.on('pageerror', error => errors.push(error.message));
      await target.exposeFunction('__rehearsalRpc', req => {
        const result = f.send(req);
        if (loseReply) { loseReply = false; throw new Error('RPC reply lost'); }
        if (holdReplies) return new Promise(resolve => heldReplies.push(() => resolve(result)));
        return result;
      });
    };
    await install(page);
    const load = async (target = page, html = f.html()) => {
      await target.goto('about:blank'); await target.setContent(html);
      await target.evaluate(() => {
        const runner = {
          withSuccessHandler(success) { return { ...this, success }; },
          withFailureHandler(failure) { return { ...this, failure }; },
          saveRehearsalChanges(request) { window.__rehearsalRpc(request).then(this.success, this.failure); },
          saveCollectionChanges(request) { window.__rehearsalRpc(request).then(this.success, this.failure); }
        };
        window.google = { script: { run: runner } };
      });
    };
    const action = name => page.locator(`[data-action="${name}"]`);
    const settle = async (target = page) => target.waitForFunction(() => document.getElementById('miniV2Root').dataset.saveState !== 'saving');
    const open = async (id = 'one') => page.locator(`tr[data-group-id="${id}"] .mini-v2-name`).click();
    const edit = async notes => { await action('edit-mini').click(); await page.locator('[data-edit-field="notes"]').fill(notes); };
    const fakeSaveTimers = () => page.evaluate(() => {
      const originalSet = window.setTimeout, originalClear = window.clearTimeout;
      const timers = new Map(); let id = -1;
      window.setTimeout = (fn, ms, ...args) => {
        if (ms !== 15000 && ms !== 90000) return originalSet(fn, ms, ...args);
        const key = id--; timers.set(key, { ms, fn: () => fn(...args) }); return key;
      };
      window.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
      window.__expireSaveTimer = ms => {
        const entry = [...timers].find(([, value]) => value.ms === ms);
        if (!entry) throw new Error('Missing timer: ' + ms);
        timers.delete(entry[0]); entry[1].fn();
      };
      window.__saveTimerCount = () => timers.size;
    });
    const waitForHeldReply = async () => {
      for (let i = 0; !heldReplies.length && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(heldReplies.length, 1);
    };
    const check = async (name, fn) => {
      f = rehearsalFixture(undefined, { live }); loseReply = false; holdReplies = false; heldReplies = []; await load(); await fn();
      assert.deepEqual(errors, []); checks++; console.log('PASS ' + name);
    };
    await check('deployed bundle has explicit real-test-save copy and no simulator/debug controls', async () => {
      if (live) {
        assert.equal(await page.locator('.mini-v2-demo-note, #miniV2DemoNotice, [data-save-outcome]').count(), 0);
        assert.equal(await page.evaluate(() => typeof window.__miniSaveTest), 'undefined');
      } else {
      assert.match(await page.locator('.mini-v2-demo-note').innerText(), /saves to test copy/);
      await page.locator('[data-summary-panel="demo"]').click();
      assert.match(await page.locator('#miniV2DemoNotice').innerText(), /persist in the disposable test copy/);
      assert.equal(await page.locator('[data-save-outcome]').count(), 0);
      assert.equal(await page.evaluate(() => typeof window.__miniSaveTest), 'undefined');
      await page.locator('[data-summary-panel="demo"]').click();
      }
      await open(); await edit('Saved through RPC'); await action('save-edit').click(); await settle();
      assert.equal(f.base.commits, 1); await load(); await open();
      assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Saved through RPC');
    });
    await check('discard remains local and does not create a receipt', async () => {
      await open(); await edit('Never saved'); await action('discard-edit').click();
      assert.equal(f.sent.length, 0); assert.equal(f.base.stored().receipts.length, 0);
      await load(); await open(); assert.notEqual(await page.locator('.mini-v2-note-body').innerText(), 'Never saved');
    });
    await check('startup timings are private, copyable and fall back cleanly when clipboard access is blocked', async () => {
      if (live) {
        assert.equal(await page.evaluate(() => typeof MiniCollectionStartup), 'undefined');
        assert.equal(await page.locator('[data-collection-copy-timing], [data-rehearsal-copy-timing]').count(), 0);
        return;
      }
      await page.waitForFunction(() => MiniRehearsalStartup.report().browser.firstFramesMs !== null);
      const report = await page.evaluate(() => MiniRehearsalStartup.report());
      assert.equal(report.server.operation, 'load');
      assert.equal(report.server.outcome, 'ok');
      assert(report.server.templateMs >= 0 && report.browser.appReadyMs >= 0);
      assert(!JSON.stringify(report).includes('First Soldier'));
      await page.locator('[data-summary-panel="demo"]').click();
      const button = page.locator('[data-rehearsal-copy-timing]');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async text => { window.__copiedTiming = text; }
      } }));
      await button.click();
      assert.equal(await button.innerText(), 'Timing copied');
      assert.equal(JSON.parse(await page.evaluate(() => window.__copiedTiming)).server.operation, 'load');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async () => { throw new Error('Blocked in iframe'); }
      } }));
      await button.click();
      const fallback = page.locator('[data-rehearsal-timing-text]');
      assert.equal(await fallback.isVisible(), true);
      assert.equal(JSON.parse(await fallback.innerText()).server.outcome, 'ok');
      assert.equal(f.sent.length, 0);
    });
    await check('group notes wrap without marquee and retain blank lines after save/reload', async () => {
      const long = '<img src=x onerror="window.__injected=1"> ' + 'A long authored note. '.repeat(30);
      const note = `First line\n\n${long}\nLast line\n`;
      await open(); await edit(note); await action('save-edit').click(); await settle();
      assert.equal(f.base.stored().groups[0].notes, note);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await load(); await open(); await page.waitForTimeout(550);
        const body = page.locator('.mini-v2-note-body');
        assert.equal(await body.textContent(), note);
        assert.equal(await body.locator('.mini-v2-marquee-text').count(), 0);
        const layout = await body.evaluate(node => ({
          height: node.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(node).lineHeight),
          whiteSpace: getComputedStyle(node).whiteSpace, fits: node.scrollWidth <= node.clientWidth,
          animated: node.getAnimations({ subtree: true }).length > 0
        }));
        assert.equal(layout.whiteSpace, 'pre-wrap');
        assert(layout.height > layout.lineHeight * 5 && layout.fits && !layout.animated);
        assert.equal(await body.locator('img').count(), 0);
        assert.equal(await page.evaluate(() => window.__injected), undefined);
        assert(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
        await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
        assert.equal(await body.evaluate(n => n.getAnimations({ subtree: true }).length), 0);
        await action('edit-mini').click();
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), note);
        await action('discard-edit').click();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check('templated page reload preserves script-like notes and literal snapshot markers', async () => {
      const note = '</script><script>window.__injected=1;</script> & <?!= fake ?>\n/*REHEARSAL_SNAPSHOT*/null $& $\' $` \u2028\u2029';
      await open(); await edit(note); await action('save-edit').click(); await settle();
      await load(); await open();
      assert.equal(await page.locator('.mini-v2-note-body').textContent(), note);
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      assert.equal(await page.locator('.mini-v2-note-body script').count(), 0);
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), note);
    });
    await check('callback failure after commit retries the identical wire request once', async () => {
      await open(); await edit('Do not duplicate'); loseReply = true;
      await action('save-edit').click(); await settle();
      assert.equal(f.base.commits, 1); assert.equal(await action('save-edit').innerText(), 'Retry');
      assert.equal(await action('discard-edit').isDisabled(), true);
      await action('save-edit').click(); await settle();
      assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.base.commits, 1);
      await load(); await open(); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Do not duplicate');
    });
    await check('a reply after 15 seconds confirms without Retry while browsing and other drafts stay usable', async () => {
      await fakeSaveTimers(); holdReplies = true;
      await open(); await edit('Slow but confirmed'); await action('save-edit').click(); await waitForHeldReply();
      await page.evaluate(() => window.__expireSaveTimer(15000));
      assert.equal(await page.locator('#miniV2Root').getAttribute('data-save-state'), 'saving');
      assert.equal(await action('save-edit').innerText(), 'Still saving...');
      assert.equal(await action('save-edit').isDisabled(), true);
      await open('two'); await edit('Keep unrelated draft');
      assert.equal(await page.locator('[data-edit-field="notes"]').isDisabled(), false);
      assert.equal(await action('save-edit').isDisabled(), true);
      heldReplies.shift()(); await settle();
      assert.equal(f.base.commits, 1); assert.equal(f.sent.length, 1);
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Second Soldier');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep unrelated draft');
      assert.equal(await action('save-edit').isDisabled(), false);
      assert.equal(await page.evaluate(() => window.__saveTimerCount()), 0);
    });
    await check('90-second watchdog retains the request; retry and an obsolete late reply cannot undo a newer save', async () => {
      await fakeSaveTimers(); holdReplies = true;
      await open(); await edit('First confirmed note'); await action('save-edit').click(); await waitForHeldReply();
      await page.evaluate(() => window.__expireSaveTimer(90000)); await settle();
      assert.equal(await action('save-edit').innerText(), 'Retry');
      assert.equal(await action('discard-edit').isDisabled(), true);
      assert.equal(await page.evaluate(() => window.__saveTimerCount()), 0);
      holdReplies = false; await action('save-edit').click(); await settle();
      assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.base.commits, 1);
      await edit('Second confirmed note'); await action('save-edit').click(); await settle();
      heldReplies.shift()(); await page.waitForTimeout(50);
      assert.equal(f.base.commits, 2);
      assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Second confirmed note');
      assert.equal(await page.locator('#miniV2Root').getAttribute('data-save-state'), 'idle');
    });
    await check('Save All persists parked location and editor work as one batch', async () => {
      await open(); await action('set-all-home').click(); await action('close-detail').click();
      await open('two'); await edit('Batch note'); await action('close-detail').click();
      await page.locator('[data-summary-panel="changes"]').click(); await action('save-all-pending').click(); await settle();
      assert.equal(f.sent[0].kind, 'saveBatch'); assert.equal(f.base.commits, 1);
      await load(); await open(); assert.equal(await page.locator('select[data-copy-id="one-01"]').inputValue(), 'Drawer');
      await open('two'); assert.equal(await page.locator('.mini-v2-note-body').innerText(), 'Batch note');
    });
    await check('new group creation and sticker allocation survive a fresh load', async () => {
      await action('new-group').click(); await page.locator('#miniV2EditName').fill('New rehearsal miniature');
      for (const [key, value] of Object.entries({ size: 'Medium', creatureType: 'Humanoid', race: 'Human', sex: 'Male', role: 'Melee', set: 'n/a', paint: 'Painted', home: 'Drawer' })) {
        await page.locator(`[data-edit-field="${key}"]`).selectOption(value);
      }
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A02'); await action('apply-next-sticker').click();
      await action('save-edit').click(); await settle();
      const group = f.base.stored().groups.find(g => g.name === 'New rehearsal miniature'); assert.match(group.rootId, /^[a-f\d-]{36}$/);
      await load(); await open(group.rootId); await action('edit-mini').click(); await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A03');
    });
    await check('unnumbered named sets accept n/a while no-set blanks stay complete after save/reload', async () => {
      await open(); await action('edit-mini').click();
      const number = page.locator('[data-edit-field="setNumber"]');
      const status = action('toggle-detail-status');
      const summary = page.locator('.mini-v2-set-field .mini-v2-read-value');
      await number.fill(''); await action('save-edit').click(); await settle();
      await load(); await open();
      assert.equal(await status.getAttribute('aria-label'), 'Group record incomplete');
      assert.match(await summary.textContent(), /# not entered/);
      await action('edit-mini').click();
      assert.match(await number.getAttribute('title'), /n\/a for an unnumbered set/);
      await number.fill('n/a'); await action('save-edit').click(); await settle();
      await load(); await open();
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await summary.textContent(), 'Owned Set (n/a)');
      assert.equal(f.base.stored().groups[0].setNumber, 'n/a');
      await action('edit-mini').click();
      await number.fill('abc'); await action('save-edit').click();
      assert.equal(await number.getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#miniV2EditorError').innerText(), /n\/a for an unnumbered set/);
      await number.fill('');
      await page.locator('[data-edit-field="set"]').selectOption('n/a');
      assert.equal(await number.isDisabled(), true);
      await action('save-edit').click(); await settle(); await load(); await open();
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await summary.textContent(), 'n/a');
      assert.equal(f.base.stored().groups[0].setNumber, '');

      // New records require an explicit number decision only when a named set is chosen.
      await action('new-group').click(); await page.locator('#miniV2EditName').fill('Unnumbered set miniature');
      for (const [key, value] of Object.entries({ size: 'Medium', creatureType: 'Humanoid', race: 'Human', sex: 'Male', role: 'Melee', set: 'Owned Set', paint: 'Painted', home: 'Drawer' })) {
        await page.locator(`[data-edit-field="${key}"]`).selectOption(value);
      }
      await action('apply-next-sticker').click();
      assert.equal(await action('save-edit').isDisabled(), true);
      await number.fill('N/A');
      assert.equal(await action('save-edit').isDisabled(), false);
      await action('save-edit').click(); await settle();
      const added = f.base.stored().groups.find(g => g.name === 'Unnumbered set miniature');
      assert.equal(added.setNumber, 'N/A');
      await load(); await open(added.rootId);
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await summary.textContent(), 'Owned Set (N/A)');
    });
    await check('deleted groups restore after reload through the real RPC boundary', async () => {
      await open(); await edit('Unsaved draft'); await action('delete-group').click(); await action('confirm-delete-group').click(); await settle();
      await load(); assert.equal(await page.locator('tr[data-group-id="one"]').count(), 0);
      await page.locator('[data-summary-panel="changes"]').click(); await action('open-recovery').click();
      await page.locator('[data-recovery-id="one"]').click(); await settle();
      assert.equal(f.sent.at(-1).kind, 'restoreGroup'); await load(); await open();
      assert.equal(f.base.stored().groups[0].deletedAt, ''); assert.equal(f.base.stored().groups[0].notes, '');
    });
    await check('list changes commit independently and survive reload', async () => {
      await page.locator('[data-action="open-lists"]:visible').click(); await page.locator('[data-list-key="race"]').click();
      const row = page.locator('.mini-v2-list-choice').filter({ has: page.getByText('Human', { exact: true }) });
      await row.locator('[data-list-action="rename"]').click(); await page.locator('#miniV2ListName').fill('Humans');
      await page.locator('[data-list-action="save"]').click(); await settle();
      await load(); await open(); assert.match(await page.locator('.mini-v2-detail-grid').innerText(), /Humans/);
    });
    await check('two tabs offer explicit overwrite after a conflicting save', async () => {
      const other = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); await install(other); await load(other);
      try {
        await open(); await edit('My pending note'); await page.locator('#miniV2EditName').fill('My name');
        await other.locator('tr[data-group-id="one"] .mini-v2-name').click(); await other.locator('[data-action="edit-mini"]').click();
        await other.locator('#miniV2EditName').fill('Other name'); await other.locator('[data-action="save-edit"]').click(); await settle(other);
        await action('save-edit').click(); await settle(); assert.equal(f.base.commits, 1);
        await page.locator('[data-save-notice="detail"] [data-save-action="overwrite"]').click(); await settle();
        assert.equal(f.base.commits, 2); await load(); await open(); assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'My name');
      } finally { await other.close(); }
    });
    await check('missing Google bridge cannot silently turn a save into a browser-only success', async () => {
      await page.evaluate(() => { delete window.google; });
      await open(); await edit('Keep this draft'); await action('save-edit').click(); await settle();
      assert.equal(f.base.commits, 0); assert.equal(await action('save-edit').innerText(), 'Retry');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep this draft');
    });
    await check('missing transport cannot fall back to the simulator during load', async () => {
      await load(page, f.html().replace(f.files[(live ? 'Collection' : 'Rehearsal') + 'Transport.html'], ''));
      assert.equal(await page.locator('#miniV2Root').count(), 0);
      assert.match(await page.locator('#app').innerText(), live ? /Collection unavailable/ : /Test collection unavailable/);
      assert.equal(f.sent.length, 0);
    });
    await check('consent and save UI preserve the existing visual style', async () => {
      await open(); await edit('Visual check'); await page.waitForTimeout(400);
      const directory = '.local/' + (live ? 'live' : 'rehearsal');
      fs.mkdirSync(directory, { recursive: true });
      await page.screenshot({ path: directory + '/save-editor.png', fullPage: true });
      f.consent = false; await page.setContent(f.server.doGet().html);
      assert.equal(await page.getByRole('link', { name: live ? 'Allow saving' : 'Allow test saves' }).count(), 1);
      await page.screenshot({ path: directory + '/save-consent.png', fullPage: true });
    });
    console.log((live ? 'Live' : 'Rehearsal') + ' browser checks passed: ' + checks + '. Google RPC and workbook were simulated; no live Google writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
