// Run with Node and Playwright installed locally or supplied via PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const server = vm.createContext({});
vm.runInContext(read('Code.js'), server);

function makeHtml(data = server.buildMockAppState_()) {
  let template;
  server.buildSpreadsheetPreviewState_ = () => data;
  server.HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createTemplateFromFile() {
      template = { evaluate() { return this; }, setTitle() { return this; }, setXFrameOptionsMode() { return this; } };
      return template;
    }
  };
  server.doGet();
  return read('Index.html')
    .replace('<?!= include("Styles"); ?>', () => read('Styles.html'))
    .replace('<?!= initialStateJson ?>', () => template.initialStateJson)
    .replace('<?!= include("SaveFlow"); ?>', () => read('SaveFlow.html'))
    .replace('<?!= include("Scripts"); ?>', () => read('Scripts.html'));
}

const data = server.buildMockAppState_();
const html = makeHtml(data);
const soldier = '013-ZHESOL';
const fighter = '048-SPIFOLFIG';
const firstCopy = '013-ZHESOL-01';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' })
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const settle = () => page.waitForTimeout(550);
    const fresh = async (content = html) => {
      await page.goto('about:blank');
      await page.setContent(content);
      await settle();
    };
    const open = async id => {
      await page.locator(`tr[data-group-id="${id}"]`).click();
      await settle();
    };
    const select = id => page.locator(`select[data-copy-id="${id}"]`);
    const settledAction = (targetPage, locator) => {
      const click = locator.click.bind(locator);
      locator.click = async (...args) => {
        await click(...args);
        await targetPage.waitForFunction(() => document.getElementById('miniV2Root')?.dataset.saveState !== 'saving');
      };
      return locator;
    };
    const action = name => settledAction(page, page.locator(`[data-action="${name}"]`));
    const review = async name => {
      if (!await action(name).isVisible()) await page.locator('[data-summary-panel="changes"]').click();
      await action(name).click();
    };
    const tableWidth = () => page.locator('.mini-v2-browse-table').evaluate(node => node.getBoundingClientRect().width);
    const testFilter = process.env.TEST_FILTER ? new RegExp(process.env.TEST_FILTER) : null;
    let checksRun = 0;
    let reachedStart = !process.env.TEST_FROM;
    const check = async (name, test) => {
      if (process.env.TEST_FROM && name.includes(process.env.TEST_FROM)) reachedStart = true;
      if (!reachedStart) return;
      if (testFilter && !testFilter.test(name)) return;
      await test();
      checksRun++;
      console.log(`PASS ${name}`);
    };
    const mode = value => page.locator(`[data-browse-mode="${value}"]`).click();
    const browseCopies = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(rows => rows.map(row => row.dataset.copyId));
    const location = async value => {
      await action('toggle-location-menu').click();
      await page.locator(`[data-location-value="${value}"]`).click();
    };
    const fillNewDetails = async (values = {}, targetPage = page) => {
      for (const [key, value] of Object.entries({ size: 'Medium', creatureType: 'Humanoid', race: 'Human',
        sex: 'Male', role: 'Melee', set: 'n/a', paint: 'Painted', ...values })) {
        await targetPage.locator(`[data-edit-field="${key}"]`).selectOption(value);
      }
    };

    const recordFixture = () => {
      const sample = JSON.parse(JSON.stringify(data));
      sample.groups = Array.from({ length: 8 }, (_, index) => {
        const group = JSON.parse(JSON.stringify(data.groups[0]));
        Object.assign(group, { rootId: `record-${index}`, name: `Record ${index}`, notes: '', set: 'n/a', setNumber: '' });
        const stickers = index === 2 ? ['B20', ' \t ', 'n/a'] : index === 3 ? ['', 'B31'] : [`B${index}0`];
        group.copies = stickers.map((sticker, i) => ({ ...group.copies[0], id: `record-${index}-${i}`, miniNumber: i + 1, sticker, note: '' }));
        if ([1, 3].includes(index)) group.race = '';
        if (index === 0) group.race = 'Not specified';
        if (index === 4) {
          group.paint = false;
          group.copies[0].sticker = ' N/A ';
          group.copies[0].currentLocation = 'Quest Minis';
        }
        if (index === 5) group.paint = 'Work in Progress';
        if ([6, 7].includes(index)) { group.set = 'Lords of Madness'; group.setNumber = index === 6 ? '' : '0'; }
        return group;
      });
      return sample;
    };

    const listAction = name => settledAction(page, page.locator(`[data-list-action="${name}"]`));
    const lists = async () => {
      const trigger = page.locator('[data-action="open-lists"]:visible');
      if (!await trigger.count()) await page.locator('[data-summary-panel="collection"]').click();
      await page.locator('[data-action="open-lists"]:visible').click();
      await page.waitForTimeout(180);
    };
    const listCategory = async key => {
      const nav = page.locator(`[data-list-key="${key}"]`);
      if (await nav.isVisible()) await nav.click();
      else await page.locator('#miniV2ListsPicker').selectOption(key);
    };
    const listRow = name => page.locator('.mini-v2-list-choice').filter({
      has: page.getByText(name, { exact: true })
    });
    const addChoice = async (key, name, home = false) => {
      await listCategory(key); await listAction('add').click();
      await page.locator('#miniV2ListName').fill(name);
      if (key === 'locations') await page.locator('#miniV2ListHome').setChecked(home);
      await listAction('save').click();
    };

    await check('list manager fits desktop and mobile without moving the page, losing drafts or leaking focus', async () => {
      for (const width of [1440, 980, 820, 819, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await fresh(); await open(soldier); await action('edit-mini').click();
        await page.locator('[data-edit-field="notes"]').fill('Keep this miniature draft');
        await page.locator(width >= 820 ? '[data-action="open-lists"]:visible' : '[data-summary-panel="collection"]').scrollIntoViewIfNeeded();
        const geometry = () => page.evaluate(() => ['.mini-v2-top-card', '.mini-v2-list-header', '.mini-v2-detail-header'].map(selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { width: box.width, height: box.height, left: box.left, top: box.top };
        }));
        const before = await geometry();
        await lists();
        const dialog = page.locator('#miniV2ListsDialog');
        assert.deepEqual(await geometry(), before, `opening lists must not move the app at ${width}`);
        const box = await dialog.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 900);
        assert.ok(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth));
        const initialHeight = box.height;
        for (const key of ['size', 'paint', 'locations', 'set']) {
          await listCategory(key);
          assert.equal((await dialog.boundingBox()).height, initialHeight);
        }
        for (let i = 0; i < 18; i++) {
          await page.keyboard.press('Tab');
          assert.ok(await dialog.evaluate(n => n.contains(document.activeElement)), 'modal focus must stay inside');
        }
        await page.mouse.click(1, 1);
        assert.equal(await dialog.isVisible(), true, 'backdrop clicks must not discard work or reach the page');
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep this miniature draft');
        if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width)) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-lists-${width}.png`)
        });
        await page.keyboard.press('Escape');
        await settle();
        assert.equal(await dialog.isVisible(), false);
        assert.deepEqual(await geometry(), before);
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Keep this miniature draft');
        assert.ok(await page.evaluate(() => document.activeElement.matches('[data-action="open-lists"], [data-summary-panel="collection"]')));
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('list usage shares a compact desktop row without squeezing long names or mobile actions', async () => {
      const many = JSON.parse(JSON.stringify(data));
      const longName = 'Mordenkainen Presents Monsters of the Multiverse - Extended Collector Edition';
      many.catalogs = { set: [...new Set(many.groups.map(group => group.set)),
        ...Array.from({ length: 60 }, (_, i) => `Collection ${String(i).padStart(2, '0')}`), longName] };
      for (const width of [1440, 820, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await fresh(makeHtml(many)); await lists(); await listCategory('set');
        const row = listRow('Collection 00');
        await row.scrollIntoViewIfNeeded();
        const size = await row.evaluate(node => {
          const box = node.getBoundingClientRect();
          const name = node.querySelector('.mini-v2-list-choice-name').getBoundingClientRect();
          const meta = node.querySelector('.mini-v2-list-choice-meta').getBoundingClientRect();
          return { height: box.height, sameLine: Math.abs((name.top + name.bottom - meta.top - meta.bottom) / 2) < 1,
            ordered: meta.left >= name.right };
        });
        if (width >= 820) {
          assert.ok(size.sameLine && size.ordered);
          assert.ok(size.height <= 46, 'ordinary rows should be substantially shorter than the old 64px layout');
        }
        await page.locator('#miniV2ListsSearch').fill(longName);
        assert.equal(await listRow(longName).locator('.mini-v2-list-choice-name').textContent(), longName);
        assert.equal(await listRow(longName).evaluate(node => {
          const box = node.getBoundingClientRect();
          return [...node.querySelectorAll('span, button')].every(child => {
            const bounds = child.getBoundingClientRect();
            return bounds.left >= box.left - 1 && bounds.right <= box.right + 1 && child.scrollWidth <= child.clientWidth + 1;
          });
        }), true);
        await listCategory('locations');
        assert.equal(await page.locator('.mini-v2-list-choice-context').first().innerText(), 'Home + current location');
        assert.ok(await page.locator('#miniV2ListsDialog').evaluate(n => n.scrollWidth <= n.clientWidth));
        await listCategory('set');
        if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width)) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-compact-lists-${width}.png`)
        });
        await listAction('close').click();
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('list additions cover all property catalogs and do not select values or disappear on miniature Discard', async () => {
      await fresh(); await open(soldier); await action('edit-mini').click(); await lists();
      await listCategory('set'); await listAction('add').click();
      assert.equal(await listAction('save').isDisabled(), true);
      await page.locator('#miniV2ListName').fill(' lords of madness ');
      assert.equal(await listAction('save').isDisabled(), true);
      assert.match(await page.locator('#miniV2ListFormError').innerText(), /already exists/);
      await listAction('cancel').click();
      for (const key of ['size', 'creatureType', 'race', 'sex', 'role', 'set', 'paint']) {
        const field = page.locator(`[data-edit-field="${key}"]`), before = await field.inputValue();
        await addChoice(key, `Custom ${key}`);
        assert.equal(await field.inputValue(), before);
        assert.equal(await field.locator('option').evaluateAll((nodes, value) => nodes.some(n => n.value === value), `Custom ${key}`), true);
      }
      await listAction('close').click(); await action('discard-edit').click(); await action('edit-mini').click();
      await page.locator('[data-edit-field="paint"]').selectOption('Custom paint');
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true);
      await page.locator('button[data-facet-key="more"]').click();
      assert.equal(await page.locator('[data-facet-kind="paints"][data-facet-value="Custom paint"]').count(), 1);
      await page.keyboard.press('Escape'); await lists();
      await listCategory('set'); await listAction('add').click();
      await page.locator('#miniV2ListName').fill('Unfinished list name');
      await listAction('close').click(); await lists();
      assert.equal(await page.locator('#miniV2ListName').inputValue(), 'Unfinished list name');
      await listAction('cancel').click();
      assert.equal(await listRow('Unfinished list name').count(), 0);
    });

    await check('list renames update saved data, draft baselines, filters and deletion Undo without losing IDs', async () => {
      await fresh(); await open(soldier); await action('edit-mini').click();
      await page.locator('[data-edit-field="notes"]').fill('Parked notes');
      await action('close-detail').click();
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('#miniV2SetFilter').selectOption('Lords of Madness');
      await page.keyboard.press('Escape'); await lists(); await listCategory('set');
      await listRow('Lords of Madness').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Madness collection'); await listAction('save').click();
      await listAction('close').click();
      await page.locator('button[data-facet-key="more"]').click();
      assert.equal(await page.locator('#miniV2SetFilter').inputValue(), 'Madness collection');
      await page.keyboard.press('Escape'); await open(soldier);
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), 'Madness collection');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Parked notes');
      await action('delete-group').click(); await action('confirm-delete-group').click();
      await lists(); await listCategory('set');
      await listRow('Madness collection').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Restorable set'); await listAction('save').click();
      await listAction('close').click(); await review('undo-delete-group');
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), soldier);
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), 'Restorable set');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Parked notes');
      await action('discard-edit').click(); await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), 'Restorable set');
      assert.equal(await action('save-edit').isDisabled(), true, 'renaming a list must not leave a dirty miniature');
    });

    await check('list removals preserve existing assignments, exclude future choices and support Undo and restore', async () => {
      await fresh(); await open(soldier); await action('edit-mini').click(); await lists(); await listCategory('set');
      assert.equal(await listRow('Not specified').locator('[data-list-action="remove"]').count(), 0);
      await listRow('Lords of Madness').locator('[data-list-action="remove"]').click();
      assert.equal(await listAction('save').innerText(), 'Remove choice');
      assert.match(await page.locator('#miniV2ListsForm').innerText(), /remains filterable while used/);
      await listAction('save').click();
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), 'Lords of Madness');
      await listAction('close').click(); await action('new-group').click();
      assert.equal(await page.locator('[data-edit-field="set"] option').evaluateAll(nodes => nodes.some(n => n.value === 'Lords of Madness')), false);
      await lists(); await listAction('undo').click();
      assert.equal(await page.locator('[data-edit-field="set"] option').evaluateAll(nodes => nodes.some(n => n.value === 'Lords of Madness')), true);
      await addChoice('set', 'Unused set');
      await listRow('Unused set').locator('[data-list-action="remove"]').click();
      assert.equal(await listAction('save').innerText(), 'Remove choice');
      await listAction('save').click();
      await listAction('add').click(); await page.locator('#miniV2ListName').fill('unused set');
      assert.equal(await listAction('save').innerText(), 'Restore choice'); await listAction('save').click();
      assert.equal(await listRow('Unused set').count(), 1);
      assert.equal(await listAction('undo').isVisible(), false, 'restoring by name clears obsolete removal history');
      await listRow('Unused set').locator('[data-list-action="remove"]').click(); await listAction('save').click();
      await listRow('Lords of Madness').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Unfinished rename');
      await listAction('undo').click();
      assert.equal(await page.locator('#miniV2ListName').inputValue(), 'Unfinished rename');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'miniV2ListName');
      assert.equal(await listRow('Unused set').count(), 1);
      await listAction('cancel').click();
    });

    await check('removed field choices leave filters after their last assignment changes and Restore never reverts edits', async () => {
      await fresh(); await lists(); await listCategory('sex');
      await listRow('Female').locator('[data-list-action="remove"]').click();
      assert.equal(await listAction('save').innerText(), 'Remove choice');
      await listAction('save').click(); await listAction('close').click();
      const female = () => page.locator('[data-facet-kind="sexes"][data-facet-value="Female"]');
      await page.locator('button[data-facet-key="sexes"]').click();
      assert.equal(await female().count(), 1, 'removed values remain discoverable while assigned');
      await female().click(); await page.keyboard.press('Escape');
      const affected = data.groups.filter(group => group.sex === 'Female');
      assert.ok(affected.length > 1);
      for (const group of affected) {
        await open(group.rootId); await action('edit-mini').click();
        assert.equal(await page.locator('[data-edit-field="sex"]').inputValue(), 'Female');
        await page.locator('[data-edit-field="sex"]').selectOption('Male');
        await action('save-edit').click();
      }
      await page.locator('button[data-facet-key="sexes"]').click();
      assert.equal(await female().getAttribute('aria-pressed'), 'true', 'do not silently clear an active filter');
      await female().click();
      assert.equal(await female().count(), 0, 'unused removed values disappear once the active filter is cleared');
      await page.keyboard.press('Escape');
      await action('close-detail').click();
      await lists(); await listAction('undo').click(); await listAction('close').click();
      for (const group of affected) {
        await open(group.rootId); await action('edit-mini').click();
        assert.equal(await page.locator('[data-edit-field="sex"]').inputValue(), 'Male');
        assert.equal(await action('save-edit').isDisabled(), true);
        await action('discard-edit').click(); await action('close-detail').click();
      }
      await page.locator('button[data-facet-key="sexes"]').click();
      assert.equal(await female().count(), 1, 'restoration offers the choice again without reassigning miniatures');
    });

    await check('removed locations leave filters when unused and restoration preserves newer Home and copy locations', async () => {
      await fresh(); await open(soldier); await action('edit-mini').click(); await lists();
      await addChoice('locations', 'Temporary drawer', true);
      await listAction('close').click();
      await page.locator('[data-edit-field="home"]').selectOption('Temporary drawer');
      await action('edit-all-home').click(); await action('save-edit').click();
      await lists(); await listCategory('locations');
      await listRow('Temporary drawer').locator('[data-list-action="remove"]').click();
      await listAction('save').click(); await listAction('close').click();
      await location('Temporary drawer');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await action('save-edit').click();
      await location('all');
      await action('toggle-location-menu').click();
      assert.equal(await page.locator('[data-location-value="Temporary drawer"]').count(), 1, 'saved current locations still use it');
      await page.keyboard.press('Escape');
      await action('set-all-home').click(); await action('save-changes').click();
      await action('toggle-location-menu').click();
      assert.equal(await page.locator('[data-location-value="Temporary drawer"]').count(), 0);
      await page.keyboard.press('Escape');
      await lists(); await listAction('add').click();
      await page.locator('#miniV2ListName').fill('Temporary drawer');
      assert.equal(await listAction('save').innerText(), 'Restore choice');
      await listAction('save').click(); await listAction('close').click();
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="home"]').inputValue(), 'Spare People');
      for (const copy of data.groups.find(group => group.rootId === soldier).copies) {
        assert.equal(await select(copy.id).inputValue(), 'Spare People');
      }
      assert.equal(await action('save-edit').isDisabled(), true);
      await action('toggle-location-menu').click();
      assert.equal(await page.locator('[data-location-value="Temporary drawer"]').count(), 1);
    });

    await check('location lists distinguish Home eligibility and rename saved and staged locations together', async () => {
      await fresh(); await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await action('edit-mini').click(); await lists();
      await addChoice('locations', 'New encounter box');
      assert.equal(await page.locator('[data-edit-field="home"] option').evaluateAll(nodes => nodes.some(n => n.value === 'New encounter box')), false);
      assert.equal(await select(firstCopy).locator('option').evaluateAll(nodes => nodes.some(n => n.value === 'New encounter box')), true);
      await listRow('New encounter box').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListHome').check(); await listAction('save').click();
      assert.equal(await page.locator('[data-edit-field="home"] option').evaluateAll(nodes => nodes.some(n => n.value === 'New encounter box')), true);
      await listRow('Spare People').locator('[data-list-action="rename"]').click();
      assert.equal(await page.locator('#miniV2ListHome').isDisabled(), true);
      await page.locator('#miniV2ListName').fill('People drawer'); await listAction('save').click();
      assert.equal(await page.locator('[data-edit-field="home"]').inputValue(), 'People drawer');
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      await listRow('Quest Minis').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Quest box'); await listAction('save').click();
      await listAction('close').click(); await action('discard-edit').click();
      assert.equal(await select(firstCopy).inputValue(), 'Quest box');
      assert.equal(await select('013-ZHESOL-02').inputValue(), 'People drawer');
      assert.equal(await action('save-changes').isDisabled(), false);
      await action('reset-changes').click();
      assert.equal(await select(firstCopy).inputValue(), 'People drawer');
    });

    await check('list paint renames preserve legacy assignments and list names render as text at short viewport heights', async () => {
      await fresh(); await open(soldier); await action('edit-mini').click(); await lists(); await listCategory('paint');
      await listRow('Painted').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Finished'); await listAction('save').click();
      assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), 'Finished');
      assert.equal(await action('save-edit').isDisabled(), true);
      await listAction('close').click(); await action('discard-edit').click(); await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), 'Finished');
      await lists();
      const literal = '<img src=x onerror=alert(1)> & "Set"';
      await addChoice('set', literal);
      assert.equal(await listRow(literal).count(), 1);
      assert.equal(await page.locator('#miniV2ListsRows img').count(), 0);
      assert.equal(await page.locator('[data-edit-field="set"] option').evaluateAll((nodes, value) => nodes.some(n => n.value === value), literal), true);
      for (const width of [844, 390]) {
        await page.setViewportSize({ width, height: 400 });
        await listCategory('locations'); await listAction('add').click();
        await page.locator('#miniV2ListName').fill(`Short viewport ${width}`);
        await page.locator('#miniV2ListHome').check();
        await listAction('save').click();
        assert.equal(await listRow(`Short viewport ${width}`).count(), 1);
        const box = await page.locator('#miniV2ListsDialog').boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height <= 400);
      }
      await listAction('close').click();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' }); await lists();
      assert.equal(await page.locator('#miniV2ListsDialog').evaluate(n => n.getAnimations().length), 0);
      await listAction('close').click(); await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    await check('collection banner stays one row with stable height, accessible recovery and a future dashboard', async () => {
      const assertToolButtons = async () => {
        const buttons = await page.locator('.mini-v2-summary-tools:visible > button').evaluateAll(nodes => nodes.map(node => {
          const style = getComputedStyle(node), box = node.getBoundingClientRect();
          return { disabled: node.disabled, border: style.borderColor, background: style.backgroundColor,
            color: style.color, cursor: style.cursor, height: box.height, top: box.top, left: box.left, right: box.right };
        }));
        assert.equal(buttons.length, 2);
        for (const button of buttons) {
          assert.notEqual(button.border, 'rgba(0, 0, 0, 0)');
          assert.notEqual(button.background, 'rgba(0, 0, 0, 0)');
          assert.equal(button.height, 32);
        }
        assert.equal(buttons[0].disabled, true);
        assert.equal(buttons[1].disabled, false);
        assert.equal(buttons[1].cursor, 'pointer');
        assert.notEqual(buttons[0].color, buttons[1].color);
        assert.equal(buttons[0].top, buttons[1].top);
        assert.ok(buttons[1].left - buttons[0].right >= 8);
      };
      for (const width of [1440, 1100, 980, 820, 819, 600, 390, 360, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        const banner = page.locator('.mini-v2-top-card');
        const geometry = () => banner.evaluate(node => ({ height: node.getBoundingClientRect().height,
          workspaceOffset: document.querySelector('.mini-v2-workspace').getBoundingClientRect().top - node.getBoundingClientRect().top }));
        const initial = await geometry();
        assert.match(await page.locator('.mini-v2-collection-total').textContent(), /28.*9/s);
        assert.equal(await page.locator('.mini-v2-dashboard:not(:disabled)').count(), 0);
        assert.equal(await page.locator('.mini-v2-top-card-body').evaluate(node => node.getBoundingClientRect().height), 56);
        if (width >= 820) await assertToolButtons();
        assert.ok(await banner.evaluate(node => {
          const bounds = node.getBoundingClientRect();
          return [...node.querySelectorAll('button')].filter(button => button.getClientRects().length).every(button => {
            const box = button.getBoundingClientRect();
            return box.left >= bounds.left && box.right <= bounds.right && button.scrollWidth <= button.clientWidth;
          });
        }), `banner controls fit at ${width}`);
        if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width)) {
          await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-banner-${width}.png`) });
        }
        await page.locator('[data-summary-panel="changes"]').click();
        assert.equal(await page.locator('#miniV2ChangesMenu').isVisible(), true);
        assert.match(await page.locator('#miniV2ChangesMenu').innerText(), /No pending edits/);
        assert.deepEqual(await geometry(), initial);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#miniV2ChangesMenu').isVisible(), false);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.summaryPanel), 'changes');
        if (width < 820) {
          await page.locator('[data-summary-panel="collection"]').click();
          assert.equal(await page.locator('#miniV2CollectionMenu .mini-v2-dashboard').isVisible(), true);
          const box = await page.locator('#miniV2CollectionMenu').boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width);
          await assertToolButtons();
          if (process.env.SCREENSHOT_PATH && width === 390) await page.screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-banner-tools-390.png')
          });
          await page.keyboard.press('Escape');
        }
        await open(soldier);
        await action('edit-mini').click();
        await page.locator('[data-edit-field="notes"]').fill('Retained banner draft');
        assert.deepEqual(await geometry(), initial, `pending work must not resize the header at ${width}`);
        await action('close-detail').click();
        await review('review-editor-drafts');
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Retained banner draft');
        await page.locator('[data-summary-panel="changes"]').click();
        await page.locator('.mini-v2-app-header > span').click();
        assert.equal(await page.locator('#miniV2ChangesMenu').isVisible(), false);
        assert.equal(await page.locator('[data-edit-field="notes"]').isVisible(), true);
        await page.locator('[data-summary-panel="changes"]').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-edit-field="notes"]').isVisible(), true);
        assert.deepEqual(await geometry(), initial);
      }
      const large = JSON.parse(JSON.stringify(data));
      const base = large.groups[0];
      large.groups = Array.from({ length: 120 }, (_, i) => ({ ...base, rootId: `large-${i}`, name: `Miniature ${i}`,
        copies: Array.from({ length: 5 }, (_, j) => ({ ...base.copies[0], id: `large-${i}-${j}`, sticker: '', currentLocation: 'Quest Minis' })) }));
      for (const width of [1440, 980, 960, 959, 820, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh(makeHtml(large));
        assert.ok(await page.locator('.mini-v2-collection-total').evaluate(n => n.scrollWidth <= n.clientWidth), `large collection total at ${width}`);
        assert.match(await page.locator('.mini-v2-collection-total').textContent(), /600.*120/s);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('collection shortcuts are copy-level, independent of filters, and Back restores browsing and drafts', async () => {
      await fresh();
      await page.locator('#miniV2SearchInput').fill('Zhent');
      await location('Spare People');
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="notes"]').fill('Work before the shortcut');
      const shortcut = value => page.locator(`.mini-v2-summary-desktop [data-collection-view="${value}"]`);
      await shortcut('away').click();
      assert.equal(await page.locator('[data-browse-mode="individuals"]').getAttribute('aria-pressed'), 'true', JSON.stringify(errors));
      assert.deepEqual(await browseCopies(), ['086-BREJAG-01', '048-SPIFOLFIG-07', '048-SPIFOLFIG-09', '093-CROCAP-02']);
      assert.equal(await action('clear-filters').innerText(), 'Back');
      assert.match(await page.locator('#miniV2BrowseCount').textContent(), /Away from home: 4/);
      await shortcut('missing').click();
      assert.deepEqual(await browseCopies(), ['121-DRORAN-01', '121-DRORAN-02']);
      await mode('groups');
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Drow Ranger Captain');
      await action('clear-filters').click();
      assert.equal(await page.locator('[data-browse-mode="groups"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'Zhent');
      assert.equal(await page.locator('#miniV2LocationLabel').innerText(), 'Spare People');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Work before the shortcut');
      await shortcut('away').click();
      await shortcut('away').click();
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'Zhent');
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.locator('[data-summary-panel="collection"]').click();
      await page.locator('#miniV2CollectionMenu [data-collection-view="missing"]').click();
      assert.equal((await browseCopies()).length, 2);
      await action('clear-filters').click();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Work before the shortcut');
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('collection counts use applied copies, exclude drafts and n/a, and recovery can reveal work outside a shortcut', async () => {
      const extra = JSON.parse(JSON.stringify(data));
      extra.groups[6].copies[0].sticker = 'n/a';
      await fresh(makeHtml(extra));
      const shortcut = value => page.locator(`.mini-v2-summary-desktop [data-collection-view="${value}"]`);
      assert.match(await shortcut('missing').innerText(), /1\s+missing sticker/);
      await open(fighter);
      await action('set-all-home').click();
      assert.match(await shortcut('away').innerText(), /4\s+away/);
      await action('save-changes').click();
      assert.match(await shortcut('away').innerText(), /2\s+away/);
      await select('048-SPIFOLFIG-01').selectOption('Quest Minis');
      await shortcut('missing').click();
      assert.deepEqual(await browseCopies(), ['121-DRORAN-02']);
      await review('review-changes');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-01');
      assert.ok((await browseCopies()).includes('048-SPIFOLFIG-01'));
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('Unpublished');
      await action('add-copy').click();
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /28.*9/s);
      await page.locator('[data-summary-panel="changes"]').click();
      assert.match(await page.locator('#miniV2ChangesMenu').innerText(), /Pending locations.*1 copy.*Resume drafts.*1 group/s);
      if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-banner-recovery.png') });
    });

    await check('view selector changes rows but preserves header geometry and inspector', async () => {
      for (const width of [1440, 1100, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        for (const detailOpen of [false, true]) {
          if (detailOpen) await open(soldier);
          const measurements = await page.evaluate(() => {
            const header = document.querySelector('.mini-v2-list-header');
            const control = header.querySelector('.mini-v2-view-switch');
            const note = document.getElementById('miniV2ListHeaderNote');
            const height = header.getBoundingClientRect().height;
            const controlRect = control.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();
            const titleRect = header.querySelector('span').getBoundingClientRect();
            const titleGap = controlRect.left - titleRect.right;
            const title = header.querySelector('span');
            const newButton = header.querySelector('[data-action="new-group"]');
            const newRect = newButton.getBoundingClientRect();
            const labelsFit = [...control.querySelectorAll('button')].every(n => n.scrollWidth <= n.clientWidth);
            control.style.display = 'none';
            note.hidden = false;
            const originalHeight = header.getBoundingClientRect().height;
            control.style.display = '';
            note.hidden = true;
            return { height, originalHeight, labelsFit, titleGap,
              titleFits: title.scrollWidth <= title.clientWidth,
              titleWidth: title.clientWidth, titleScroll: title.scrollWidth,
              headerWidth: headerRect.width,
              newInside: newRect.left >= controlRect.right && newRect.right <= headerRect.right,
              inside: controlRect.right <= headerRect.right && controlRect.left >= headerRect.left };
          });
          assert.equal(measurements.height, measurements.originalHeight, `header height at ${width}, open=${detailOpen}`);
          assert.ok(measurements.inside && measurements.labelsFit);
          assert.ok(measurements.titleFits && measurements.newInside, `creation action and browse title at ${width}, open=${detailOpen}: ${JSON.stringify(measurements)}`);
          assert.ok(Math.abs(measurements.titleGap - 16) < 1, `title gap at ${width}, open=${detailOpen}`);
          const tableGeometry = () => page.locator('.mini-v2-browse-table').evaluate(table => ({
            rowHeight: table.tBodies[0].rows[0].getBoundingClientRect().height,
            columns: [...table.tHead.rows[0].cells].map(cell => cell.getBoundingClientRect().left)
          }));
          const originalGeometry = await tableGeometry();
          await page.locator('.mini-v2-copy-select').evaluateAll(nodes => nodes.forEach(n => { n.__retained = true; }));
          const toggle = page.locator('[data-browse-mode="individuals"]');
          const before = await page.locator('.mini-v2-view-switch').boundingBox();
          if (width < 980) before.y += await page.evaluate(() => document.body.scrollTop);
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 28);
          assert.equal(await page.locator('.mini-v2-browse-table th').first().innerText(), 'ID');
          assert.equal(await page.locator('.mini-v2-browse-table th').nth(2).innerText(), 'CURRENT LOCATION');
          assert.match(await page.locator('#miniV2BrowseCount').textContent(), /28 individuals/i);
          assert.deepEqual(await tableGeometry(), originalGeometry);
          if (width >= 1280 && detailOpen) {
            assert.ok(await page.locator('.mini-v2-list-wrap').evaluate(wrap =>
              [...wrap.querySelectorAll('.mini-v2-copy-status')].every(badge => badge.getBoundingClientRect().right < wrap.getBoundingClientRect().right)
            ));
          }
          assert.ok(await page.locator('.mini-v2-copy-select').evaluateAll(nodes => nodes.every(n => n.__retained)));
          const after = await page.locator('.mini-v2-view-switch').boundingBox();
          if (width < 980) after.y += await page.evaluate(() => document.body.scrollTop);
          if (JSON.stringify(after) !== JSON.stringify(before) && process.env.SCREENSHOT_PATH) {
            await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-selector-failure.png') });
          }
          assert.deepEqual(after, before, `selector bounds at ${width}, open=${detailOpen}`);
          assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), detailOpen);
          await page.locator('[data-browse-mode="groups"]').focus();
          await page.keyboard.press('Space');
          assert.equal(await page.locator('[data-browse-mode="groups"]').getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 9);
        }
        if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-selector-${width}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('individual search and location filters match the same copy, not its siblings', async () => {
      await fresh();
      await mode('individuals');
      await page.locator('#miniV2SearchInput').fill(' a12 ');
      assert.deepEqual(await browseCopies(), [firstCopy]);
      await page.locator('#miniV2SearchInput').fill('C16');
      await location('Quest Minis');
      assert.equal(await page.locator('.mini-v2-empty').innerText(), 'No individuals match those filters.');
      await mode('groups');
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Spirit Folk Fighter');
      await mode('individuals');
      await action('clear-filters').click();
      for (const [place, expected] of [
        ['Encounter Box G', ['048-SPIFOLFIG-07']],
        ['Quest Minis', ['086-BREJAG-01', '048-SPIFOLFIG-09']],
        ['Dwarves', []],
        ['Drow', ['121-DRORAN-01', '121-DRORAN-02']]
      ]) {
        await location(place);
        assert.deepEqual(await browseCopies(), expected);
      }
      await location('Spare People');
      assert.equal((await browseCopies()).length, 18);
      await page.locator('#miniV2SearchInput').fill('Zhent Soldier');
      assert.equal((await browseCopies()).length, 3);
      await action('clear-filters').click();
      assert.equal(await page.locator('[data-browse-mode="individuals"]').getAttribute('aria-pressed'), 'true');
    });

    await check('copy identity drives selection; siblings stay open and no-ID copies remain distinct', async () => {
      await fresh();
      await mode('individuals');
      const clickCopy = async id => { await page.locator(`tr[data-copy-id="${id}"]`).click(); await settle(); };
      await clickCopy(firstCopy);
      await clickCopy('013-ZHESOL-02');
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), '013-ZHESOL-02');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '013-ZHESOL-02');
      await mode('groups');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-group-id'), soldier);
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').count(), 0);
      assert.equal(await page.locator('.mini-v2-copy-row[aria-current]').count(), 0);
      await mode('individuals');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), '013-ZHESOL-02');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '013-ZHESOL-02');
      await page.locator('tr[data-copy-id="013-ZHESOL-02"]').focus();
      await page.keyboard.press('Enter');
      await settle();
      assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), false);
      await clickCopy('121-DRORAN-01');
      await clickCopy('121-DRORAN-02');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '121-DRORAN-02');
      await action('close-detail').click();
      await page.locator('#miniV2SearchInput').fill('C16');
      await clickCopy('048-SPIFOLFIG-07');
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 10);
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-07');
    });

    await check('copy highlight hides in Groups and follows final-row corners without changing table layout', async () => {
      await fresh();
      await mode('individuals');
      for (const [copyId, rounded, label] of [
        ['086-BREJAG-01', true, 'single'],
        ['013-ZHESOL-01', false, 'first'],
        ['048-SPIFOLFIG-07', false, 'middle'],
        ['048-SPIFOLFIG-10', true, 'last']
      ]) {
        await page.locator(`tr[data-copy-id="${copyId}"]`).click();
        await settle();
        const geometry = () => page.locator('.mini-v2-copy-table').evaluate(table => ({
          width: table.getBoundingClientRect().width,
          height: table.getBoundingClientRect().height,
          rows: [...table.rows].map(row => ({
            height: row.getBoundingClientRect().height,
            cells: [...row.cells].map(cell => cell.getBoundingClientRect().width)
          }))
        }));
        const selectedGeometry = await geometry();
        const border = await page.locator('.mini-v2-copy-row.is-target').evaluate(row => {
          const style = getComputedStyle(row.lastElementChild, '::after');
          return { radius: style.borderBottomRightRadius, top: style.borderTopRightRadius, pointer: style.pointerEvents };
        });
        assert.equal(border.radius, rounded ? '9px' : '0px');
        assert.equal(border.top, '0px');
        assert.equal(border.pointer, 'none');
        await select(copyId).evaluate(node => { node.__retainedAcrossModes = true; });
        if (process.env.SCREENSHOT_PATH) {
          await page.locator('.mini-v2-copy-table-shell').screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-highlight-${label}.png`) });
        }
        await mode('groups');
        assert.equal(await page.locator('.mini-v2-copy-row.is-target, .mini-v2-copy-row[aria-current]').count(), 0);
        assert.equal(await select(copyId).evaluate(node => node.__retainedAcrossModes), true);
        assert.deepEqual(await geometry(), selectedGeometry);
        await mode('individuals');
        assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), copyId);
        assert.equal(await select(copyId).evaluate(node => node.__retainedAcrossModes), true);
        assert.deepEqual(await geometry(), selectedGeometry);
      }
    });

    await check('pending moves preserve saved browse locations, group action scope, and filtered-out inspector', async () => {
      await fresh();
      await mode('individuals');
      await location('Encounter Box G');
      await page.locator('tr[data-copy-id="048-SPIFOLFIG-07"]').click();
      await settle();
      await select('048-SPIFOLFIG-07').focus();
      await select('048-SPIFOLFIG-07').selectOption('Spare People');
      assert.deepEqual(await browseCopies(), ['048-SPIFOLFIG-07']);
      assert.equal(await page.locator('.mini-v2-individual-location-label').innerText(), 'Encounter Box G');
      assert.equal(await page.locator('.mini-v2-individual-location .mini-v2-copy-status').innerText(), 'AWAY');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.copyId), '048-SPIFOLFIG-07');
      await mode('groups');
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Spirit Folk Fighter');
      await mode('individuals');
      await action('reset-changes').click();
      assert.equal(await select('048-SPIFOLFIG-07').inputValue(), 'Encounter Box G');
      await action('set-all-home').click();
      assert.equal(await select('048-SPIFOLFIG-09').inputValue(), 'Spare People');
      assert.match(await action('review-changes').innerText(), /2/);
      await action('save-changes').click();
      assert.equal((await browseCopies()).length, 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Spirit Folk Fighter');
      assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), true);
      await select('048-SPIFOLFIG-01').selectOption('Quest Minis');
      await review('review-changes');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-01');
      assert.equal(await page.locator('#miniV2LocationLabel').innerText(), 'All locations');
      await action('reset-changes').click();
    });

    await check('individual sorts are natural and shared filters do not leak assigned siblings', async () => {
      const extra = JSON.parse(JSON.stringify(data));
      extra.groups[0].copies[0].sticker = 'A12';
      extra.groups[0].copies[1].sticker = 'A2';
      extra.groups[0].copies[2].sticker = '';
      await fresh(makeHtml(extra));
      await page.locator('[data-sort-key="avail"]').click();
      await mode('individuals');
      assert.equal(await page.locator('th[aria-sort="descending"]').count(), 0);
      await page.locator('#miniV2SearchInput').fill('Zhent Soldier');
      const stickers = () => page.locator('.mini-v2-individual-id').allTextContents();
      await page.locator('[data-sort-key="sticker"]').click();
      assert.deepEqual(await stickers(), ['A2', 'A12', 'No ID']);
      await page.locator('[data-sort-key="sticker"]').click();
      assert.deepEqual(await stickers(), ['A12', 'A2', 'No ID']);
      await page.locator('[data-sort-key="sticker"]').click();
      assert.deepEqual(await browseCopies(), ['013-ZHESOL-01', '013-ZHESOL-02', '013-ZHESOL-03']);
      await page.locator('[data-facet-key="more"]').click();
      await page.locator('[data-facet-kind="stickers"][data-facet-value="Missing"]').click();
      assert.deepEqual(await browseCopies(), ['013-ZHESOL-03']);
      await mode('groups');
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Zhent Soldier');
      await mode('individuals');
      await action('clear-filters').click();
      await page.locator('[data-sort-key="size"]').click();
      assert.equal(await page.locator('.mini-v2-name').last().innerText(), 'Warhorse');
      await page.locator('[data-sort-key="size"]').click();
      assert.equal(await page.locator('.mini-v2-name').first().innerText(), 'Warhorse');
      await mode('groups');
      assert.equal(await page.locator('[data-sort-key="size"]').getAttribute('aria-label'), 'Sort by Size, currently descending');
    });

    await check('copy reveal is local and mode switches preserve independent scroll and pending work', async () => {
      await page.setViewportSize({ width: 1440, height: 650 });
      await fresh();
      await mode('individuals');
      await page.locator('tr[data-copy-id="048-SPIFOLFIG-10"]').click();
      await settle();
      assert.ok(await page.locator('.mini-v2-copy-row.is-target').evaluate(row => {
        const target = row.getBoundingClientRect();
        const host = document.getElementById('miniV2DetailScroll').getBoundingClientRect();
        return target.top >= host.top && target.bottom <= host.bottom;
      }));
      await select('048-SPIFOLFIG-10').selectOption('Quest Minis');
      await settle();
      await page.locator('#miniV2TableScroll').evaluate(n => { n.scrollTop = 120; });
      const before = await page.evaluate(() => ({
        browse: document.getElementById('miniV2TableScroll').scrollTop,
        detail: document.getElementById('miniV2DetailScroll').scrollTop,
        page: document.scrollingElement.scrollTop
      }));
      await mode('groups');
      await mode('individuals');
      await settle();
      const after = await page.evaluate(() => ({
        browse: document.getElementById('miniV2TableScroll').scrollTop,
        detail: document.getElementById('miniV2DetailScroll').scrollTop,
        page: document.scrollingElement.scrollTop
      }));
      assert.equal(after.detail, before.detail);
      assert.equal(after.page, before.page);
      assert.ok(await page.locator('.mini-v2-browse-table tr.is-selected').evaluate(row => {
        const bounds = row.getBoundingClientRect();
        const host = document.getElementById('miniV2TableScroll').getBoundingClientRect();
        return bounds.top >= host.top && bounds.bottom <= host.bottom;
      }));
      assert.equal(await select('048-SPIFOLFIG-10').inputValue(), 'Quest Minis');
      await action('reset-changes').click();
      await page.setViewportSize({ width: 390, height: 844 });
      await fresh();
      await mode('individuals');
      await page.locator('tr[data-copy-id="013-ZHESOL-01"]').click();
      await settle();
      await page.locator('.mini-v2-list-wrap').evaluate(n => { n.scrollLeft = 180; });
      await page.locator('.mini-v2-copy-table-shell').evaluate(n => { n.scrollLeft = 90; });
      await select(firstCopy).selectOption('Quest Minis');
      await settle();
      assert.equal(await page.locator('.mini-v2-list-wrap').evaluate(n => n.scrollLeft), 180);
      assert.equal(await page.locator('.mini-v2-copy-table-shell').evaluate(n => n.scrollLeft), 90);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('popover dismissal preserves inspection and pending changes inside and outside the app', async () => {
      await fresh();
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      for (const popover of ['facet', 'location']) {
        for (const outsideApp of [false, true]) {
          if (popover === 'facet') await page.locator('[data-facet-key="sizes"]').click();
          else await action('toggle-location-menu').click();
          await settle();
          if (outsideApp) await page.mouse.click(1, 1);
          else await page.locator('.mini-v2-list-header > span').first().click();
          await settle();
          assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
          assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
          assert.equal(await page.locator('#miniV2FacetPopover').isVisible(), false);
          assert.equal(await action('toggle-location-menu').getAttribute('aria-expanded'), 'false');
        }
      }
      // Without an open popover, the existing outside-click dismissal still works.
      await page.mouse.click(1, 1);
      await settle();
      assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), false);
    });

    await check('Groups to Individuals selects a matching copy with four rows of context when possible', async () => {
      await page.setViewportSize({ width: 1440, height: 650 });
      await fresh();
      await open(fighter);
      await mode('individuals');
      await settle();
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), '048-SPIFOLFIG-01');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-01');
      const placement = await page.locator('.mini-v2-browse-table tr.is-selected').evaluate(row => ({
        offset: row.getBoundingClientRect().top - document.getElementById('miniV2TableScroll').getBoundingClientRect().top,
        height: row.getBoundingClientRect().height
      }));
      assert.ok(Math.abs(placement.offset - placement.height * 4) < 2);
      await fresh();
      await location('Quest Minis');
      await open(fighter);
      await mode('individuals');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-09');
      await fresh();
      await location('Dwarves');
      await open('086-BREJAG');
      await mode('individuals');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').count(), 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Bregol Jagstone');
      assert.equal(await page.locator('.mini-v2-empty').count(), 1);
      await fresh();
      await page.locator('[data-sort-key="name"]').click();
      await open(soldier);
      await mode('individuals');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), firstCopy);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('detail rows select copies both ways without hijacking dropdowns or clearing filters', async () => {
      await page.setViewportSize({ width: 1440, height: 650 });
      await fresh();
      await open(fighter);
      const row = id => page.locator(`[data-detail-copy-id="${id}"]`);
      await row('048-SPIFOLFIG-02').locator('td').first().click();
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').count(), 0);
      await mode('individuals');
      await row('048-SPIFOLFIG-10').locator('td').first().click();
      await settle();
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), '048-SPIFOLFIG-10');
      assert.ok(await page.locator('.mini-v2-browse-table tr.is-selected').evaluate(row => {
        const bounds = row.getBoundingClientRect();
        const host = document.getElementById('miniV2TableScroll').getBoundingClientRect();
        return bounds.top >= host.top && bounds.bottom <= host.bottom;
      }));
      await row('048-SPIFOLFIG-10').locator('td').first().click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Spirit Folk Fighter');
      const scrollBefore = await page.locator('#miniV2TableScroll').evaluate(n => n.scrollTop);
      await select('048-SPIFOLFIG-09').click();
      await page.keyboard.press('Escape');
      await select('048-SPIFOLFIG-09').selectOption('Spare People');
      await settle();
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-10');
      assert.equal(await page.locator('#miniV2TableScroll').evaluate(n => n.scrollTop), scrollBefore);
      await row('048-SPIFOLFIG-08').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').getAttribute('data-copy-id'), '048-SPIFOLFIG-08');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.detailCopyId), '048-SPIFOLFIG-08');
      await location('Encounter Box G');
      await page.locator('tr[data-copy-id="048-SPIFOLFIG-07"]').click();
      await row('048-SPIFOLFIG-02').locator('td').first().click();
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-02');
      assert.equal(await page.locator('.mini-v2-browse-table tr.is-selected').count(), 0);
      assert.deepEqual(await browseCopies(), ['048-SPIFOLFIG-07']);
      assert.equal(await select('048-SPIFOLFIG-09').inputValue(), 'Spare People');
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('three-digit availability never changes browse column positions or row heights', async () => {
      const large = JSON.parse(JSON.stringify(data));
      const group = large.groups[0];
      group.copies = Array.from({ length: 100 }, (_, i) => ({
        ...group.copies[0], id: `stress-${i}`, miniNumber: i + 1, sticker: `Z${i}`, currentLocation: i === 99 ? 'Quest Minis' : group.home
      }));
      const geometry = () => page.locator('.mini-v2-browse-table').evaluate(table => ({
        columns: [...table.tHead.rows[0].cells].map(cell => cell.getBoundingClientRect().width),
        height: table.tBodies[0].rows[0].getBoundingClientRect().height
      }));
      for (const width of [1440, 1100, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        const baseline = await geometry();
        await fresh(makeHtml(large));
        assert.deepEqual(await geometry(), baseline);
        assert.equal(await page.locator('.mini-v2-count--browse').first().innerText(), '99/100');
        await open(soldier);
        const opened = await geometry();
        await action('set-all-home').click();
        await action('save-changes').click();
        await settle();
        assert.deepEqual(await geometry(), opened);
        const pill = page.locator('.mini-v2-count--browse').first();
        assert.equal(await pill.innerText(), '100/100');
        const sizing = await pill.evaluate(node => ({
          pill: node.getBoundingClientRect().width,
          cell: node.parentElement.getBoundingClientRect().width,
          fits: node.getBoundingClientRect().left >= node.parentElement.getBoundingClientRect().left
            && node.getBoundingClientRect().right <= node.parentElement.getBoundingClientRect().right
        }));
        assert.ok(sizing.fits, `100/100 fits at ${width}: ${JSON.stringify(sizing)}`);
        if (process.env.SCREENSHOT_PATH) {
          await page.locator('.mini-v2-browse-table tbody tr').first().screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-count-${width}.png`)
          });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('larger synthetic results retain distinct IDs and safe rendering', async () => {
      const large = JSON.parse(JSON.stringify(data));
      large.groups = Array.from({ length: 600 }, (_, index) => {
        const source = data.groups[index % data.groups.length];
        return { ...source, rootId: `synthetic-${index}`, copies: [{ ...source.copies[0], id: `synthetic-${index}-01` }] };
      });
      large.groups[0].copies[0].sticker = '<img src=x onerror="window.__injected=true">';
      large.groups[0].copies[0].currentLocation = '<script>window.__injected=true</script>';
      await fresh(makeHtml(large));
      await mode('individuals');
      assert.equal((await browseCopies()).length, 600);
      assert.equal(new Set(await browseCopies()).size, 600);
      assert.equal(await page.locator('.mini-v2-individual-id').first().textContent(), large.groups[0].copies[0].sticker);
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      assert.equal(await page.locator('.mini-v2-browse-table img, .mini-v2-browse-table script').count(), 0);
      await page.locator('#miniV2SearchInput').fill('synthetic-598-01');
      assert.deepEqual(await browseCopies(), ['synthetic-598-01']);
    });

    await check('safe initial data embedding and exact text round trip', async () => {
      const hostile = JSON.parse(JSON.stringify(data));
      const note = '</script><script>window.__injected=true;</script> & <test>\u2028\u2029';
      hostile.groups[0].notes = note;
      await fresh(makeHtml(hostile));
      assert.equal(await page.evaluate(() => window.__injected), undefined);
      await open(soldier);
      assert.equal(await page.locator('.mini-v2-note-body').textContent(), note);
    });

    await check('Set All Home clears staged-away moves and stages saved-away copies', async () => {
      await fresh();
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await action('set-all-home').click();
      assert.equal(await select(firstCopy).inputValue(), 'Spare People');
      assert.equal(await action('save-changes').isDisabled(), true);
      assert.equal(await action('review-changes').count(), 0);
      await open(fighter);
      await select('048-SPIFOLFIG-01').selectOption('Quest Minis');
      await action('set-all-home').click();
      assert.deepEqual(await page.locator('.mini-v2-copy-select').evaluateAll(nodes => nodes.map(n => n.value)), Array(10).fill('Spare People'));
      assert.match(await action('review-changes').innerText(), /2/);
      await action('save-changes').click();
      assert.equal(await action('review-changes').count(), 0);
    });

    await check('desktop width stays frozen through opening, resize, closing, and breakpoint changes', async () => {
      await fresh();
      const baseline = await tableWidth();
      await open(fighter);
      assert.ok(Math.abs(await tableWidth() - baseline) < 2);
      await page.setViewportSize({ width: 1400, height: 1000 });
      await settle();
      assert.ok(Math.abs(await tableWidth() - baseline) < 2);
      await page.setViewportSize({ width: 1100, height: 800 });
      await settle();
      const resized = await tableWidth();
      assert.ok(resized > 900);
      assert.ok(await page.locator('#miniV2SearchInput').evaluate(n => n.clientWidth) > 200);
      await action('close-detail').click();
      await settle();
      assert.ok(Math.abs(await tableWidth() - resized) < 2);
      await open(fighter);
      await page.setViewportSize({ width: 900, height: 800 });
      await settle();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await settle();
      assert.ok(Math.abs(await tableWidth() - baseline) < 2);
    });

    await check('filter count bubbles have a clear label gap and balanced padding without changing button height', async () => {
      for (const width of [1440, 390, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        const typeButton = page.locator('button[data-facet-key="creatureTypes"]');
        const baseWidth = (await typeButton.boundingBox()).width;
        await typeButton.click();
        const choose = value => page.locator(`[data-facet-kind="creatureTypes"][data-facet-value="${value}"]`).click();
        const values = await page.locator('[data-facet-kind="creatureTypes"]').evaluateAll(nodes => nodes.map(n => n.dataset.facetValue));
        await choose(values[0]);
        assert.equal(await typeButton.locator('.mini-v2-facet-count').count(), 0);
        assert.equal((await typeButton.boundingBox()).width, baseWidth);
        for (let count = 2; count <= 12; count++) {
          await choose(values[count - 1]);
          if (![2, 5, 12].includes(count)) continue;
          const measured = await typeButton.evaluate(node => {
            const button = node.getBoundingClientRect();
            const label = node.querySelector('.mini-v2-facet-label').getBoundingClientRect();
            const badgeNode = node.querySelector('.mini-v2-facet-count');
            const badge = badgeNode.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(badgeNode);
            const number = range.getBoundingClientRect();
            return { width: button.width, height: button.height, badgeWidth: badge.width, badgeHeight: badge.height,
              gap: badge.left - label.right, leftPadding: label.left - button.left, rightPadding: button.right - badge.right,
              centered: Math.abs((number.left + number.right) / 2 - (badge.left + badge.right) / 2),
              vertical: Math.abs((badge.top + badge.bottom) / 2 - (button.top + button.bottom) / 2),
              text: badgeNode.textContent };
          });
          assert.equal(measured.gap, 6);
          assert.equal(measured.leftPadding, measured.rightPadding);
          assert.equal(measured.height, 30);
          assert.equal(measured.badgeHeight, 18);
          assert.equal(measured.width, baseWidth + measured.badgeWidth + 6);
          assert.ok(measured.centered < 1 && measured.vertical < 1);
          assert.equal(measured.text, String(count));
        }
        await action('clear-open-facet').click();
        for (const value of ['Aberration', 'Beast', 'Dragon', 'Fey', 'Humanoid']) await choose(value);
        await page.locator('button[data-facet-key="sexes"]').click();
        for (const value of ['Female', 'Male']) {
          await page.locator(`[data-facet-kind="sexes"][data-facet-value="${value}"]`).click();
        }
        await page.locator('button[data-facet-key="sexes"]').click();
        await settle();
        const wrap = await page.locator('#miniV2FacetBar').evaluate(node => {
          const height = node.getBoundingClientRect().height;
          const buttons = [...node.querySelectorAll('button')];
          buttons.forEach(n => { n.style.gap = '0px'; });
          const originalHeight = node.getBoundingClientRect().height;
          buttons.forEach(n => { n.style.removeProperty('gap'); });
          return { height, originalHeight };
        });
        assert.equal(wrap.height, wrap.originalHeight, `Type 5 / Sex 2 row does not acquire a new line at ${width}`);
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
        if (process.env.SCREENSHOT_PATH) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-filter-counts-${width}.png`)
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('keyboard focus survives copy edits, sort, and facet selection', async () => {
      await fresh();
      await open(soldier);
      await select(firstCopy).focus();
      await select(firstCopy).selectOption('Quest Minis');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.copyId), firstCopy);
      await page.locator('[data-sort-key="name"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.dataset.sortKey), 'name');
      await page.locator('[data-facet-key="sizes"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.dataset.facetKey), 'sizes');
      await page.locator('[data-facet-value="Medium"]').click();
      assert.equal(await page.evaluate(() => document.activeElement.dataset.facetValue), 'Medium');
    });

    await check('pending edits remain discoverable across groups and filters; unload warns only while dirty', async () => {
      await fresh();
      const warned = () => page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(await warned(), false);
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await open(fighter);
      assert.match(await action('review-changes').innerText(), /1/);
      assert.equal(await warned(), true);
      await page.locator('#miniV2SearchInput').fill('Warhorse');
      await review('review-changes');
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      await action('reset-changes').click();
      assert.equal(await warned(), false);
      assert.equal(await action('review-changes').count(), 0);
      const ids = data.groups.slice(0, 3).map(group => group.rootId);
      for (const id of ids) {
        if (await page.locator('#miniV2DetailHeaderTitle').innerText() !== data.groups.find(group => group.rootId === id).name) {
          await open(id);
        }
        await page.locator('.mini-v2-copy-select').first().selectOption('Encounter Box G');
      }
      for (const id of ids) {
        await review('review-changes');
        assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), data.groups.find(group => group.rootId === id).name);
      }
    });

    await check('availability is numeric, text alphabetical, and facets still combine', async () => {
      await fresh();
      await page.locator('[data-sort-key="avail"]').click();
      const values = await page.locator('.mini-v2-browse-table tbody td:first-child').allTextContents();
      const counts = values.map(value => Number(value.trim().split('/')[0]));
      assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
      await page.locator('[data-sort-key="name"]').click();
      assert.equal(await page.locator('.mini-v2-name').first().innerText(), 'Archmage');
      await page.locator('[data-facet-key="sizes"]').click();
      await page.locator('[data-facet-value="Medium"]').click();
      await page.locator('[data-facet-value="Large"]').click();
      assert.equal(await page.locator('.mini-v2-name').count(), 9);
      await page.locator('[data-facet-key="creatureTypes"]').click();
      await page.locator('[data-facet-value="Beast"]').click();
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Warhorse');
    });

    await check('mobile tables scroll without squeezing controls or overflowing the page', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await fresh();
      await open(fighter);
      assert.ok(await select('048-SPIFOLFIG-01').evaluate(n => n.clientWidth) > 200);
      assert.ok(await page.locator('.mini-v2-list-wrap').evaluate(n => n.scrollWidth > n.clientWidth));
      assert.ok(await page.locator('.mini-v2-copy-table-shell').evaluate(n => n.scrollWidth > n.clientWidth));
      assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      const homeAlignment = () => page.locator('.mini-v2-copy-table-shell').evaluate(shell => {
        const label = shell.querySelector('.mini-v2-inventory-home .mini-v2-field-label');
        const column = shell.querySelector('th:nth-child(3)');
        return label.getBoundingClientRect().left - column.getBoundingClientRect().left - parseFloat(getComputedStyle(column).paddingLeft);
      });
      assert.ok(Math.abs(await homeAlignment()) < 1);
      await page.locator('.mini-v2-copy-table-shell').evaluate(shell => { shell.scrollLeft = 100; });
      assert.ok(await page.locator('.mini-v2-copy-table-shell').evaluate(shell => shell.scrollLeft > 0));
      assert.ok(Math.abs(await homeAlignment()) < 1);
    });

    await check('editor preserves panel geometry and field order across desktop and mobile', async () => {
      for (const width of [1440, 1100, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        await open(soldier);
        const geometry = () => page.locator('#miniV2DetailPanel').evaluate(panel => {
          const column = panel.querySelector('.mini-v2-copy-table th:nth-child(3)');
          const label = panel.querySelector('.mini-v2-inventory-home .mini-v2-field-label');
          const homeValue = panel.querySelector('.mini-v2-inventory-home .mini-v2-inventory-summary-value > *');
          const copySelect = panel.querySelector('.mini-v2-copy-select');
          const idColumn = panel.querySelector('.mini-v2-copy-table th:first-child');
          const idInset = idColumn.getBoundingClientRect().left + parseFloat(getComputedStyle(idColumn).paddingLeft);
          const availableLabel = panel.querySelector('.mini-v2-inventory-available .mini-v2-field-label');
          const availablePill = panel.querySelector('.mini-v2-inventory-availability');
          return {
            width: panel.getBoundingClientRect().width,
            header: panel.querySelector('.mini-v2-detail-header').getBoundingClientRect().height,
            columns: [...document.querySelectorAll('.mini-v2-browse-table th')].map(n => n.getBoundingClientRect().width),
            summaryHeight: panel.querySelector('.mini-v2-inventory-summary').getBoundingClientRect().height,
            availableAligned: [availableLabel, availablePill].every(node => Math.abs(node.getBoundingClientRect().left - idInset) < 1)
              && getComputedStyle(availableLabel).textAlign === 'left',
            homeAligned: Math.abs(label.getBoundingClientRect().left - column.getBoundingClientRect().left - parseFloat(getComputedStyle(column).paddingLeft)) < 1,
            homeWidthMatches: Math.abs(homeValue.getBoundingClientRect().width - copySelect.getBoundingClientRect().width) < 1
          };
        });
        const before = await geometry();
        assert.equal(before.availableAligned, true);
        assert.equal(before.homeAligned, true);
        assert.equal(before.homeWidthMatches, true);
        if (process.env.SCREENSHOT_PATH) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-inspector-${width}.png`)
        });
        await action('edit-mini').click();
        await settle();
        assert.deepEqual(await geometry(), before);
        assert.equal(await page.locator('[data-edit-field="home"]').evaluate(home => {
          const copy = document.querySelector('.mini-v2-copy-select');
          const homeStyle = getComputedStyle(home);
          const copyStyle = getComputedStyle(copy);
          return ['height', 'padding', 'borderRadius', 'fontSize'].every(key => homeStyle[key] === copyStyle[key]);
        }), true);
        assert.deepEqual(await page.locator('.mini-v2-detail-grid [data-edit-field]').evaluateAll(nodes => nodes.map(n => n.dataset.editField)),
          ['size', 'creatureType', 'race', 'sex', 'role']);
        assert.deepEqual(await page.locator('.mini-v2-product-grid [data-edit-field]').evaluateAll(nodes => nodes.map(n => n.dataset.editField)),
          ['set', 'setNumber', 'paint']);
        assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '3 / 3');
        assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 3);
        assert.equal(await page.locator('.mini-v2-editor-copy-note').count(), 3);
        assert.equal(await action('save-changes').count(), 0);
        assert.equal(await action('save-edit').isDisabled(), true);
        assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), 'Painted');
        assert.equal(await page.locator('.mini-v2-editor .mini-v2-read-card, .mini-v2-editor .mini-v2-note-card').count(), 0);
        assert.equal(await page.locator('[data-edit-field="set"]').evaluate(n => n.tagName), 'SELECT');
        assert.deepEqual(await page.locator('[data-edit-field="set"] option').evaluateAll(nodes => nodes.map(n => n.value)),
          ['', 'Aberrations', 'Angelfire', 'Lords of Madness', 'n/a', 'Night Below', 'Underdark (2005)', 'Not specified']);
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
        assert.ok(await page.locator('#miniV2EditName').evaluate(n => n.clientWidth > 60));
        if (process.env.SCREENSHOT_PATH) {
          await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-editor-${width}.png`) });
          if (width === 390) await page.locator('#miniV2DetailPanel').screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-editor-mobile-panel.png')
          });
        }
        await action('discard-edit').click();
        await settle();
        assert.deepEqual(await geometry(), before);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('editor outward focus rings have gutter clearance without moving any controls', async () => {
      for (const width of [1440, 1100, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        for (const flow of ['existing', 'new']) {
          if (flow === 'existing') {
            await open(soldier);
            await action('edit-mini').click();
          } else await action('new-group').click();
          await settle();
          const geometry = () => page.locator('#miniV2DetailPanel').evaluate(panel => ({
            header: panel.querySelector('.mini-v2-detail-header').getBoundingClientRect().height,
            columns: [...panel.querySelectorAll('.mini-v2-copy-table th')].map(n => n.getBoundingClientRect().width),
            controls: [...panel.querySelectorAll('[data-edit-field], [data-edit-copy-note], [data-edit-copy-sticker]')].map(n => {
              const rect = n.getBoundingClientRect();
              return { field: n.dataset.editField || n.dataset.editCopyNote || n.dataset.editCopySticker,
                left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            })
          }));
          const before = await geometry();
          assert.deepEqual(await page.locator('#miniV2DetailScroll').evaluate(n => {
            const style = getComputedStyle(n);
            return [style.paddingLeft, style.marginLeft];
          }), ['3px', '-3px']);
          await page.locator('#miniV2DetailScroll').evaluate(n => {
            n.style.paddingLeft = '0';
            n.style.marginLeft = '0';
          });
          assert.deepEqual(await geometry(), before, `focus gutter preserves original layout at ${width}px in ${flow}`);
          await page.locator('#miniV2DetailScroll').evaluate(n => {
            n.style.removeProperty('padding-left');
            n.style.removeProperty('margin-left');
          });
          const fields = page.locator('.mini-v2-editor input:enabled, .mini-v2-editor select:enabled, .mini-v2-editor textarea:enabled');
          for (const field of await fields.all()) {
            const focus = await field.evaluate(n => {
              n.focus({ preventScroll: true });
              const style = getComputedStyle(n);
              const rect = n.getBoundingClientRect();
              const clip = document.getElementById('miniV2DetailScroll').getBoundingClientRect();
              const cell = n.closest('.mini-v2-copy-note-cell')?.getBoundingClientRect();
              const extent = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
              return { visible: n.matches(':focus-visible'), outline: parseFloat(style.outlineWidth),
                offset: parseFloat(style.outlineOffset), fieldLeft: rect.left, clipLeft: clip.left,
                leftFits: rect.left - extent >= clip.left - 0.1,
                rightFits: rect.right > clip.right || rect.right + extent <= clip.right - 12 + 0.1,
                noteRingFits: !cell || (rect.left - extent >= cell.left && rect.right + extent <= cell.right
                  && rect.top - extent >= cell.top && rect.bottom + extent <= cell.bottom) };
            });
            assert.equal(focus.visible, true);
            assert.equal(focus.outline, 2);
            assert.equal(focus.offset, 1);
            assert.ok(focus.leftFits && focus.rightFits && focus.noteRingFits,
              `focus ring is clipped at ${width}px in ${flow}: ${JSON.stringify(focus)}`);
            assert.deepEqual(await geometry(), before);
          }
          await page.locator('[data-edit-field="size"]').evaluate(n => n.focus({ preventScroll: true }));
          if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-focus-ring-${flow}-${width}.png`)
          });
          await action('discard-edit').click();
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('editor saves shared and copy values together without live browse changes or caret loss', async () => {
      await fresh();
      await open(fighter);
      await action('edit-mini').click();
      const role = page.locator('[data-edit-field="role"]');
      await role.selectOption('Spellcaster');
      assert.equal(await page.locator(`tr[data-group-id="${fighter}"] .mini-v2-cell-role`).innerText(), 'Melee');
      await page.locator('#miniV2EditName').fill('Spirit Folk Mage');
      await page.locator('[data-edit-field="set"]').selectOption('Lords of Madness');
      await page.locator('[data-edit-field="setNumber"]').fill('007');
      const note = page.locator('[data-edit-copy-note="048-SPIFOLFIG-01"]');
      await note.evaluate(n => { n.__sameNode = true; });
      await note.fill('Blue robes');
      await note.press('ArrowLeft');
      const caret = await note.evaluate(n => n.selectionStart);
      await note.pressSequentially('!');
      assert.equal(await note.evaluate(n => n.__sameNode), true);
      assert.equal(await note.evaluate(n => n.selectionStart), caret + 1);
      await select('048-SPIFOLFIG-07').selectOption('Spare People');
      await page.locator('[data-edit-field="notes"]').fill('First line\nSecond line');
      await page.locator('[data-edit-field="notes"]').press('Enter');
      assert.equal(await page.locator('.mini-v2-editor').count(), 1);
      await page.locator('[data-edit-field="paint"]').selectOption('Unpainted');
      await mode('individuals');
      assert.equal(await note.evaluate(n => n.__sameNode), true);
      await page.locator('[data-detail-copy-id="048-SPIFOLFIG-02"] td').first().click();
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-01');
      await page.locator('[data-detail-copy-id="048-SPIFOLFIG-02"] td').nth(1).click();
      assert.equal(await role.inputValue(), 'Spellcaster');
      await action('save-edit').click();
      await settle();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Spirit Folk Mage');
      assert.equal(await page.locator('.mini-v2-product-grid .mini-v2-read-card').last().locator('.mini-v2-read-value').innerText(), 'Unpainted');
      assert.doesNotMatch(await page.locator('#miniV2DetailHeaderTags').innerText(), /Unpainted/i);
      assert.equal(await select('048-SPIFOLFIG-07').inputValue(), 'Spare People');
      assert.match(await page.locator('.mini-v2-read-card').nth(5).innerText(), /Lords of Madness \(007\)/);
      assert.match(await page.locator('.mini-v2-note-body').textContent(), /First line\nSecond line/);
      assert.equal(await page.locator('tr[data-copy-id="048-SPIFOLFIG-02"] .mini-v2-cell-role').innerText(), 'Spellcaster');
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), '048-SPIFOLFIG-02');
      await fresh();
      assert.equal(await page.locator(`tr[data-group-id="${fighter}"] .mini-v2-name`).innerText(), 'Spirit Folk Fighter');
    });

    await check('editor Discard preserves earlier location drafts and other groups', async () => {
      await fresh();
      await open(fighter);
      await select('048-SPIFOLFIG-01').selectOption('Quest Minis');
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await action('edit-mini').click();
      assert.equal(await action('save-edit').isDisabled(), false);
      await page.locator('[data-edit-field="role"]').selectOption('Support');
      await select(firstCopy).selectOption('Encounter Box G');
      await action('discard-edit').click();
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Tank');
      await page.locator('[data-edit-copy-note="013-ZHESOL-02"]').fill('Temporary');
      await action('discard-edit').click();
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      assert.equal(await page.locator('.mini-v2-copy-note-cell').nth(1).innerText(), '—');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Support');
      await action('save-edit').click();
      assert.match(await action('review-changes').innerText(), /1/);
      await open(fighter);
      assert.equal(await select('048-SPIFOLFIG-01').inputValue(), 'Quest Minis');
      assert.equal(await action('save-changes').isDisabled(), false);
    });

    await check('editor keeps unapplied drafts on close and navigation without confirmation', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Ranged');
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }), true);
      await page.mouse.click(1, 1);
      assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), false);
      assert.match(await action('review-editor-drafts').innerText(), /1/);
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-cell-role`).innerText(), 'Tank');
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }), true);
      await page.locator(`tr[data-group-id="${fighter}"]`).click();
      assert.equal(await page.locator('.mini-v2-editor').count(), 0);
      await page.locator(`tr[data-group-id="${soldier}"]`).click();
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Ranged');
      await mode('individuals');
      await page.locator('tr[data-copy-id="013-ZHESOL-03"]').click();
      await page.locator('#miniV2SearchInput').fill('nothing-matches');
      assert.equal(await page.locator('.mini-v2-empty').count(), 1);
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Ranged');
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }), false);
      assert.equal(await page.locator('.mini-v2-empty').count(), 1);
      await action('clear-filters').click();
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Support');
      await page.locator('tr[data-copy-id="048-SPIFOLFIG-01"]').click();
      assert.equal(await page.locator('.mini-v2-editor').count(), 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Spirit Folk Fighter');
      assert.equal(await page.locator('tr[data-copy-id="013-ZHESOL-01"] .mini-v2-cell-role').innerText(), 'Ranged');
      await review('review-editor-drafts');
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Support');
      await action('discard-edit').click();
      assert.equal(await action('review-editor-drafts').count(), 0);
    });

    await check('multiple editor drafts remain discoverable through filters and do not leak between groups', async () => {
      await fresh();
      const dialogs = [];
      const onDialog = async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); };
      page.on('dialog', onDialog);
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Boss');
      await page.locator('[data-edit-copy-note="013-ZHESOL-02"]').fill('Soldier draft');
      await action('close-detail').click();
      await open(fighter);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="notes"]').fill('Fighter draft');
      await page.locator('#miniV2EditName').fill('Fighter renamed');
      await page.locator('[data-edit-field="notes"]').press('Escape');
      assert.match(await action('review-editor-drafts').innerText(), /2/);
      await page.locator('#miniV2SearchInput').fill('no-such-mini');
      await review('review-editor-drafts');
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Zhent Soldier');
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Boss');
      assert.equal(await page.locator('[data-edit-copy-note="013-ZHESOL-02"]').inputValue(), 'Soldier draft');
      await review('review-editor-drafts');
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Fighter renamed');
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Melee');
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Fighter draft');
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'no-such-mini');
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Fighter renamed');
      assert.match(await action('review-editor-drafts').innerText(), /1/);
      await review('review-editor-drafts');
      await action('discard-edit').click();
      assert.equal(await action('review-editor-drafts').count(), 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      await action('clear-filters').click();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-cell-role`).innerText(), 'Tank');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Boss');
      await action('close-detail').click();
      assert.deepEqual(dialogs, []);
      page.off('dialog', onDialog);
      await fresh();
      assert.equal(await action('review-editor-drafts').count(), 0);
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-cell-role`).innerText(), 'Tank');
    });

    await check('Home edits reclassify without moving copies, and explicit Set All Home moves them', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="home"]').selectOption('Dwarves');
      assert.equal(await select(firstCopy).inputValue(), 'Spare People');
      assert.equal(await page.locator('.mini-v2-editor-home-note').isVisible(), true);
      assert.ok((await page.locator('.mini-v2-copy-status').allTextContents()).every(text => text === 'Away'));
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '0 / 3');
      assert.equal(await select(firstCopy).inputValue(), 'Spare People');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="home"]').selectOption('Mounts & Misc. Creatures');
      await action('edit-all-home').click();
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '3 / 3');
      assert.equal(await select(firstCopy).inputValue(), 'Mounts & Misc. Creatures');
    });

    await check('availability follows shown locations in both modes while browse counts wait for Save', async () => {
      await fresh();
      await open(fighter);
      const count = page.locator('.mini-v2-availability-count');
      const pending = page.locator('.mini-v2-availability-pending');
      const pillGeometry = () => page.locator('.mini-v2-inventory-availability').evaluate(pill => {
        const count = pill.querySelector('.mini-v2-availability-count');
        const center = node => { const rect = node.getBoundingClientRect(); return rect.left + rect.width / 2; };
        return {
          width: pill.getBoundingClientRect().width,
          centered: Math.abs(center(pill) - center(count)) < 1
        };
      });
      const originalPill = await pillGeometry();
      assert.equal(originalPill.centered, true);
      assert.equal(await count.innerText(), '8 / 10');
      assert.equal(await pending.isVisible(), false);
      await select('048-SPIFOLFIG-07').selectOption('Spare People');
      assert.equal(await count.innerText(), '9 / 10');
      assert.equal(await pending.isVisible(), true);
      await action('edit-mini').click();
      assert.equal(await count.innerText(), '9 / 10');
      await page.locator('[data-edit-field="home"]').selectOption('Dwarves');
      assert.equal(await count.innerText(), '0 / 10');
      await action('edit-all-home').click();
      assert.equal(await count.innerText(), '10 / 10');
      assert.deepEqual(await pillGeometry(), originalPill);
      assert.equal(await page.locator(`tr[data-group-id="${fighter}"] .mini-v2-count`).innerText(), '8/10');
      await action('close-detail').click();
      await open(fighter);
      assert.equal(await count.innerText(), '10 / 10');
      assert.equal(await pending.isVisible(), true);
      await action('discard-edit').click();
      assert.equal(await count.innerText(), '9 / 10');
      await action('reset-changes').click();
      assert.equal(await count.innerText(), '8 / 10');
      assert.equal(await pending.isVisible(), false);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="notes"]').fill('Metadata-only change');
      assert.equal(await pending.isVisible(), false);
      await select('048-SPIFOLFIG-07').selectOption('Spare People');
      await action('save-edit').click();
      assert.equal(await count.innerText(), '9 / 10');
      assert.equal(await pending.isVisible(), false);
      assert.equal(await page.locator(`tr[data-group-id="${fighter}"] .mini-v2-count`).innerText(), '9/10');
    });

    await check('editor preserves unknown choices and missing paint; unrelated omissions do not block edits', async () => {
      const incomplete = JSON.parse(JSON.stringify(data));
      incomplete.groups[0].paint = null;
      incomplete.groups[0].notes = '';
      incomplete.groups[0].race = 'Custom folk';
      incomplete.groups[0].set = '<script>not executable</script>';
      await fresh(makeHtml(incomplete));
      await open(soldier);
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), 'Custom folk');
      assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), '');
      await page.locator('#miniV2EditName').fill('   ');
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2EditName').getAttribute('aria-invalid'), 'true');
      await page.locator('#miniV2EditName').fill('Zhent Soldier');
      await page.locator('[data-edit-field="role"]').selectOption('Spellcaster');
      await action('save-edit').click();
      assert.doesNotMatch(await page.locator('#miniV2DetailHeaderTags').innerText(), /Unpainted/i);
      assert.equal(await page.locator('.mini-v2-product-grid .mini-v2-read-card').last().locator('.mini-v2-read-value').innerText(), 'Not entered');
      assert.match(await page.locator('.mini-v2-read-card').nth(5).innerText(), /<script>not executable<\/script>/);
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), '');
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), 'Custom folk');
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Spellcaster');
      const paint = page.locator('[data-edit-field="paint"]');
      assert.equal(await paint.inputValue(), '');
      await page.setViewportSize({ width: 390, height: 1000 });
      if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
        path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-editor-unspecified-paint.png')
      });
      await paint.selectOption('Painted');
      assert.equal(await paint.inputValue(), 'Painted');
      await action('save-edit').click();
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), 'Painted');
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('blank metadata is visibly Not entered without changing data, optional notes or layout', async () => {
      const fields = ['size', 'creatureType', 'race', 'sex', 'role', 'set', 'setNumber', 'paint', 'home'];
      const geometry = () => page.locator('#miniV2DetailPanel').evaluate(panel => ({
        header: panel.querySelector('.mini-v2-detail-header').getBoundingClientRect().height,
        cards: [...panel.querySelectorAll('.mini-v2-read-card')].map(n => n.getBoundingClientRect().height),
        summary: panel.querySelector('.mini-v2-inventory-summary').getBoundingClientRect().height
      }));
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh(); await open(soldier);
        const before = await geometry();
        for (const value of ['', null, ' \t ']) {
          const blank = JSON.parse(JSON.stringify(data));
          for (const key of fields) blank.groups[0][key] = value;
          blank.groups[0].notes = '';
          blank.groups[0].copies[0].note = '';
          await fresh(makeHtml(blank)); await open(soldier);
          const displayed = page.locator('#miniV2DetailContent .mini-v2-read-value');
          assert.deepEqual(await displayed.allTextContents(), Array(8).fill('Not entered'));
          assert.equal(await displayed.evaluateAll(nodes => nodes.every(n => n.classList.contains('mini-v2-missing-value'))), true);
          const row = page.locator(`tr[data-group-id="${soldier}"]`);
          for (const column of ['home', 'size', 'type', 'race', 'sex', 'role']) {
            assert.equal(await row.locator(`.mini-v2-cell-${column}`).textContent(), 'Not entered');
            assert.equal(await row.locator(`.mini-v2-cell-${column}`).getAttribute('title'), 'Not entered');
          }
          assert.equal(await page.locator('.mini-v2-note-body').textContent(), 'No notes yet.');
          assert.equal(await page.locator('.mini-v2-copy-note-value.mini-v2-missing-value').count(), 0);
          assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
          assert.deepEqual(await geometry(), before, `missing labels must not change layout at ${width}px`);
          await action('edit-mini').click();
          for (const key of fields) {
            const input = page.locator(`[data-edit-field="${key}"]`);
            assert.equal(await input.inputValue(), ['paint', 'setNumber'].includes(key) ? '' : value ?? '', key);
            assert.equal(await input.locator('option[value="Not entered"]').count(), 0, 'a display placeholder is not a catalog choice');
          }
          await action('discard-edit').click(); await settle();
          assert.deepEqual(await displayed.allTextContents(), Array(8).fill('Not entered'));
          assert.deepEqual(await geometry(), before);
        }
        const missingRace = JSON.parse(JSON.stringify(data));
        missingRace.groups[0].race = '';
        await fresh(makeHtml(missingRace)); await open(soldier);
        const race = page.locator('.mini-v2-detail-grid .mini-v2-read-card').nth(2).locator('.mini-v2-read-value');
        if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-blank-race-${width}.png`)
        });
        for (const choice of ['n/a', 'Not specified', '']) {
          await action('edit-mini').click();
          await page.locator('[data-edit-field="race"]').selectOption(choice);
          await action('save-edit').click();
          assert.equal(await race.textContent(), choice || 'Not entered');
          assert.equal(await race.evaluate(n => n.classList.contains('mini-v2-missing-value')), !choice);
          assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), choice ? 'Group record complete' : 'Group record incomplete');
          await action('edit-mini').click();
          assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), choice);
          await action('discard-edit').click();
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('Set number is only missing for a named set and follows edits to set membership', async () => {
      await fresh();
      await open(data.groups.find(group => group.set === 'n/a').rootId);
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="setNumber"]').fill('');
      await action('save-edit').click();
      const status = action('toggle-detail-status');
      const tip = page.locator('#miniV2DetailStatusTip');
      assert.equal(await status.getAttribute('aria-label'), 'Group record incomplete');
      assert.equal(await tip.textContent(), 'Missing: Set #');
      const setValue = page.locator('.mini-v2-set-field .mini-v2-read-value');
      assert.equal(await setValue.textContent(), 'Lords of Madness (# not entered)');
      assert.equal(await setValue.evaluate(n => n.classList.contains('mini-v2-missing-value')), true);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="set"]').selectOption('n/a');
      await action('save-edit').click();
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await setValue.textContent(), 'n/a');
      assert.equal(await setValue.evaluate(n => n.classList.contains('mini-v2-missing-value')), false);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="set"]').selectOption('');
      await action('save-edit').click();
      assert.equal(await tip.textContent(), 'Missing: Set');
      assert.equal(await setValue.textContent(), 'Not entered');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="set"]').selectOption('Lords of Madness');
      await action('save-edit').click();
      assert.equal(await tip.textContent(), 'Missing: Set #');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="setNumber"]').fill('0');
      await action('save-edit').click();
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await setValue.textContent(), 'Lords of Madness (0)');

      const unspecified = JSON.parse(JSON.stringify(data));
      unspecified.groups[0].set = ' N/A ';
      unspecified.groups[0].setNumber = '  ';
      unspecified.groups[0].notes = '';
      await fresh(makeHtml(unspecified));
      await open(soldier);
      assert.equal(await status.getAttribute('aria-label'), 'Group record complete');
      assert.equal(await setValue.textContent(), 'n/a');

      unspecified.groups[0].set = '';
      unspecified.groups[0].setNumber = '4a';
      await fresh(makeHtml(unspecified)); await open(soldier);
      assert.equal(await setValue.textContent(), 'Not entered (#4a)');
      assert.equal(await tip.textContent(), 'Missing: Set');
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="set"]').inputValue(), '');
      assert.equal(await page.locator('[data-edit-field="setNumber"]').isDisabled(), true);
      await page.locator('[data-edit-field="set"]').selectOption('Lords of Madness');
      assert.equal(await page.locator('[data-edit-field="setNumber"]').inputValue(), '4a');
      await action('discard-edit').click();
      assert.equal(await setValue.textContent(), 'Not entered (#4a)');
    });

    await check('paint dropdown keeps its explicit order and preserves legacy values, drafts and saves', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      const paint = page.locator('[data-edit-field="paint"]');
      assert.equal(await paint.inputValue(), 'Painted');
      assert.equal(await paint.evaluate(n => n.tagName), 'SELECT');
      assert.deepEqual(await paint.locator('option').evaluateAll(nodes => nodes.map(n => n.value)),
        ['', 'Painted', 'Unpainted', 'Work in Progress']);
      assert.equal(await paint.evaluate(n => {
        const set = document.querySelector('[data-edit-field="set"]');
        return n.getBoundingClientRect().top === set.getBoundingClientRect().top
          && n.getBoundingClientRect().height === set.getBoundingClientRect().height;
      }), true);
      await paint.evaluate(n => {
        n.add(new Option('Not specified', 'Not specified'));
        n.value = 'Not specified';
        n.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await action('save-edit').click();
      assert.equal(await paint.getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#miniV2EditorError').innerText(), /Painted, Unpainted, or Work in Progress/);
      await action('discard-edit').click();
      await open('086-BREJAG');
      const readPaint = page.locator('.mini-v2-product-grid .mini-v2-read-card').last().locator('.mini-v2-read-value');
      assert.equal(await readPaint.innerText(), 'Unpainted');
      const height = await readPaint.evaluate(n => n.closest('.mini-v2-read-card').clientHeight);
      await action('edit-mini').click();
      assert.equal(await paint.inputValue(), 'Unpainted');
      await paint.selectOption('Work in Progress');
      await action('close-detail').click();
      await open('086-BREJAG');
      assert.equal(await paint.inputValue(), 'Work in Progress');
      await action('save-edit').click();
      assert.equal(await readPaint.innerText(), 'Work in Progress');
      assert.equal(await readPaint.evaluate(n => n.closest('.mini-v2-read-card').clientHeight), height);
      assert.doesNotMatch(await page.locator('#miniV2DetailHeaderTags').innerText(), /missing|unpainted|work in progress/i);
      await action('edit-mini').click();
      await paint.selectOption('Painted');
      await action('discard-edit').click();
      assert.equal(await readPaint.innerText(), 'Work in Progress');
      await action('edit-mini').click();
      assert.equal(await paint.inputValue(), 'Work in Progress');
      if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
        path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-paint-dropdown.png')
      });
      await paint.selectOption('Unpainted');
      await action('save-edit').click();
      assert.equal(await readPaint.innerText(), 'Unpainted');
      await action('new-group').click();
      assert.equal(await paint.inputValue(), '');
      await page.locator('#miniV2EditName').fill('Painting Project');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await fillNewDetails({ paint: 'Work in Progress' });
      assert.equal(await action('save-edit').isDisabled(), false);
      await action('save-edit').click();
      assert.equal(await readPaint.innerText(), 'Work in Progress');
      await action('edit-mini').click();
      assert.equal(await paint.inputValue(), 'Work in Progress');
    });

    await check('Painted filter includes only Painted, not Unpainted, Work in Progress or unknown paint in either view', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      const states = [true, false, 'Painted', 'Unpainted', 'Work in Progress', null, 'Not specified', '', 'Custom paint'];
      mixed.groups.forEach((group, index) => { group.paint = states[index]; });
      await fresh(makeHtml(mixed));
      await page.locator('[data-facet-key="more"]').click();
      await page.locator('[data-facet-kind="paints"][data-facet-value="Painted"]').click();
      const rootIds = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.groupId));
      assert.deepEqual(await rootIds(), [soldier, fighter]);
      await mode('individuals');
      assert.deepEqual(await browseCopies(), [mixed.groups[0], mixed.groups[2]].flatMap(group => group.copies.map(copy => copy.id)));
      await mode('groups');
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="paint"]').selectOption('Work in Progress');
      assert.deepEqual(await rootIds(), [soldier, fighter]);
      await action('save-edit').click();
      assert.deepEqual(await rootIds(), [fighter]);
      assert.match(await page.locator('#miniV2DetailContent').innerText(), /outside your current browse filters/);
      await mode('individuals');
      assert.deepEqual(await browseCopies(), mixed.groups[2].copies.map(copy => copy.id));
    });

    await check('More paint statuses combine with OR and retain their explicit order in both browse views', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      const states = [true, false, 'Painted', 'Unpainted', 'Work in Progress', null, 'Not specified', '', 'Custom paint'];
      mixed.groups.forEach((group, index) => { group.paint = states[index]; });
      await fresh(makeHtml(mixed));
      await page.locator('[data-facet-key="more"]').click();
      assert.deepEqual(await page.locator('[data-facet-kind="paints"] .mini-v2-facet-tile-label').allTextContents(),
        ['Painted', 'Unpainted', 'In Progress']);
      assert.deepEqual(await page.locator('[data-facet-kind="paints"]').evaluateAll(nodes => nodes.map(n => n.dataset.facetValue)),
        ['Painted', 'Unpainted', 'Work in Progress']);
      assert.equal(await page.locator('[data-facet-kind="paints"]').last().getAttribute('title'), 'Work in Progress');
      const roots = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.groupId));
      const paint = value => page.locator(`[data-facet-kind="paints"][data-facet-value="${value}"]`).click();
      await paint('Work in Progress');
      assert.deepEqual(await roots(), [mixed.groups[4].rootId]);
      await paint('Unpainted');
      assert.deepEqual(await roots(), [1, 3, 4].map(index => mixed.groups[index].rootId));
      await paint('Painted');
      assert.deepEqual(await roots(), mixed.groups.slice(0, 5).map(group => group.rootId));
      assert.equal(await page.locator('[data-facet-key="more"] .mini-v2-facet-count').innerText(), '3');
      await paint('Work in Progress');
      assert.deepEqual(await roots(), mixed.groups.slice(0, 4).map(group => group.rootId));
      await mode('individuals');
      assert.deepEqual(await browseCopies(), mixed.groups.slice(0, 4).flatMap(group => group.copies.map(copy => copy.id)));
      await page.locator('button[data-facet-key="more"]').click();
      await action('clear-open-facet').click();
      assert.equal(await page.locator('button[data-facet-key="more"]').getAttribute('aria-pressed'), 'false');
      assert.equal((await browseCopies()).length, 28);
      assert.equal(await page.locator('[data-facet-flag="paintedOnly"]').count(), 0);
      await mode('groups');
    });

    await check('More combines Set, paint, Role and missing stickers with AND and clears only its own filters', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      const setName = 'Collector set with a long name & alternate <edition>';
      mixed.groups.slice(0, 3).forEach(group => { group.set = setName; });
      Object.assign(mixed.groups[0], { role: 'Melee', paint: 'Work in Progress' });
      mixed.groups[0].copies[0].sticker = 'n/a';
      mixed.groups[0].copies[1].sticker = '';
      Object.assign(mixed.groups[1], { role: 'Melee', paint: 'Unpainted' });
      Object.assign(mixed.groups[2], { role: 'Ranged', paint: 'Work in Progress' });
      await fresh(makeHtml(mixed));
      await page.locator('[data-facet-key="more"]').click();
      const roots = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.groupId));
      await page.locator('#miniV2SetFilter').selectOption(setName);
      assert.deepEqual(await roots(), mixed.groups.slice(0, 3).map(group => group.rootId));
      assert.equal(await page.locator('#miniV2SetFilter').getAttribute('title'), setName);
      await page.locator('[data-facet-kind="paints"][data-facet-value="Work in Progress"]').click();
      assert.deepEqual(await roots(), [soldier, fighter]);
      await page.locator('[data-facet-kind="roles"][data-facet-value="Melee"]').click();
      await page.locator('[data-facet-kind="stickers"][data-facet-value="Missing"]').click();
      assert.deepEqual(await roots(), [soldier]);
      assert.equal(await page.locator('[data-facet-key="more"] .mini-v2-facet-count').innerText(), '4');
      await mode('individuals');
      assert.deepEqual(await browseCopies(), [mixed.groups[0].copies[1].id]);
      await page.locator('[data-facet-key="sizes"]').click();
      await page.locator('[data-facet-kind="sizes"][data-facet-value="Large"]').click();
      assert.equal(await page.locator('.mini-v2-empty').count(), 1);
      await page.locator('button[data-facet-key="more"]').click();
      await action('clear-open-facet').click();
      assert.equal(await page.locator('#miniV2SetFilter').inputValue(), '');
      assert.deepEqual(await browseCopies(), [mixed.groups[8].copies[0].id]);
      assert.equal(await page.locator('button[data-facet-key="sizes"]').getAttribute('aria-pressed'), 'true');
      await action('clear-filters').click();
      assert.equal((await browseCopies()).length, 28);
      await mode('groups');
    });

    await check('More follows card order with matching Set typography and a single aligned paint row at full width', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const detailOpen of [false, true]) {
        await fresh();
        if (detailOpen) await open(soldier);
        await page.locator('button[data-facet-key="more"]').click();
        await page.locator('#miniV2SetFilter').selectOption('Lords of Madness');
        await settle();
        const layout = await page.locator('.mini-v2-facet-more').evaluate(node => {
          const paint = [...node.querySelectorAll('[data-facet-kind="paints"]')].map(n => {
            const box = n.getBoundingClientRect();
            return { left: box.left, top: box.top, width: box.width, height: box.height };
          });
          const roles = [...node.querySelectorAll('[data-facet-kind="roles"]')].slice(0, 3)
            .map(n => ({ left: n.getBoundingClientRect().left, width: n.getBoundingClientRect().width }));
          const stickers = [...node.querySelectorAll('[data-facet-kind="stickers"]')]
            .map(n => ({ left: n.getBoundingClientRect().left, top: n.getBoundingClientRect().top, width: n.getBoundingClientRect().width }));
          const records = [...node.querySelectorAll('[data-facet-kind="recordStatuses"]')]
            .map(n => ({ left: n.getBoundingClientRect().left, top: n.getBoundingClientRect().top, width: n.getBoundingClientRect().width }));
          const style = n => {
            const css = getComputedStyle(n);
            return { font: css.fontFamily, size: css.fontSize, weight: css.fontWeight };
          };
          return { headings: [...node.querySelectorAll('.mini-v2-facet-group-label')].map(n => n.textContent),
            paint, roles, stickers, records, setStyle: style(node.querySelector('select')),
            tileStyle: style(node.querySelector('.mini-v2-facet-tile-label')) };
        });
        assert.deepEqual(layout.headings, ['Role', 'Set', 'Paint status', 'Stickers', 'Record status']);
        assert.deepEqual(layout.setStyle, layout.tileStyle);
        assert.equal(layout.setStyle.weight, '600');
        assert.ok(layout.paint.every(n => n.top === layout.paint[0].top && n.height === layout.paint[0].height));
        layout.paint.forEach((n, index) => {
          assert.equal(n.left, layout.roles[index].left);
          assert.equal(n.width, layout.roles[index].width);
        });
        assert.equal(layout.stickers.length, 2);
        assert.equal(layout.stickers[0].top, layout.stickers[1].top);
        layout.stickers.forEach((n, index) => {
          assert.equal(n.left, layout.roles[index].left);
          assert.equal(n.width, layout.roles[index].width);
        });
        assert.equal(layout.records.length, 2);
        assert.equal(layout.records[0].top, layout.records[1].top);
        layout.records.forEach((n, index) => {
          assert.equal(n.left, layout.roles[index].left);
          assert.equal(n.width, layout.roles[index].width);
        });
        assert.deepEqual(await page.locator('[data-facet-kind="stickers"] .mini-v2-facet-tile-label').allTextContents(),
          ['Assigned', 'Missing']);
        assert.equal(await page.locator('[data-facet-flag]').count(), 0);
        if (process.env.SCREENSHOT_PATH) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-more-refined${detailOpen ? '-detail' : ''}.png`)
        });
      }
    });

    await check('Assigned and Missing sticker filters use copy-level OR and match mixed groups without hiding n/a', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      mixed.groups[0].copies[0].sticker = 'n/a';
      mixed.groups[0].copies[1].sticker = '  ';
      mixed.groups[2].copies.forEach(copy => { copy.sticker = ''; });
      await fresh(makeHtml(mixed));
      const assigned = copy => !!String(copy.sticker || '').trim();
      const roots = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.groupId));
      const toggle = value => page.locator(`[data-facet-kind="stickers"][data-facet-value="${value}"]`).click();
      await page.locator('button[data-facet-key="more"]').click();
      await toggle('Assigned');
      assert.deepEqual(await roots(), mixed.groups.filter(group => group.copies.some(assigned)).map(group => group.rootId));
      await toggle('Missing');
      assert.deepEqual(await roots(), mixed.groups.map(group => group.rootId));
      assert.equal(await page.locator('button[data-facet-key="more"] .mini-v2-facet-count').innerText(), '2');
      await toggle('Assigned');
      assert.deepEqual(await roots(), mixed.groups.filter(group => group.copies.some(copy => !assigned(copy))).map(group => group.rootId));
      await mode('individuals');
      assert.deepEqual(await browseCopies(), mixed.groups.flatMap(group => group.copies.filter(copy => !assigned(copy)).map(copy => copy.id)));
      await page.locator('button[data-facet-key="more"]').click();
      await toggle('Missing');
      const button = page.locator('[data-facet-kind="stickers"][data-facet-value="Assigned"]');
      await button.focus();
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.facetValue), 'Assigned');
      const assignedIds = mixed.groups.flatMap(group => group.copies.filter(assigned).map(copy => copy.id));
      assert.deepEqual(await browseCopies(), assignedIds);
      assert.ok(assignedIds.includes(firstCopy), 'explicit n/a remains a resolved rather than missing sticker');
      await toggle('Missing');
      assert.equal((await browseCopies()).length, 28);
      await action('clear-open-facet').click();
      assert.equal(await page.locator('button[data-facet-key="more"]').getAttribute('aria-pressed'), 'false');
      assert.ok(await page.locator('[data-facet-kind="stickers"]').evaluateAll(nodes => nodes.every(n => n.getAttribute('aria-pressed') === 'false')));
      await mode('groups');
    });

    await check('Record status separates shared omissions and copy stickers while combining with the existing filters', async () => {
      const sample = recordFixture();
      const toggle = (kind, value) => page.locator(`[data-facet-kind="${kind}"][data-facet-value="${value}"]`).click();
      const rows = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.copyId || n.dataset.groupId));
      for (const individuals of [false, true]) {
        await fresh(makeHtml(sample));
        if (individuals) await mode('individuals');
        await page.locator('button[data-facet-key="more"]').click();
        await toggle('recordStatuses', 'Incomplete');
        assert.deepEqual(await rows(), individuals
          ? ['record-1-0', 'record-2-1', 'record-3-0', 'record-3-1', 'record-6-0']
          : ['record-1', 'record-2', 'record-3', 'record-6']);
        await toggle('stickers', 'Missing');
        assert.deepEqual(await rows(), individuals ? ['record-2-1', 'record-3-0'] : ['record-2', 'record-3']);
        assert.equal(await page.locator('button[data-facet-key="more"] .mini-v2-facet-count').innerText(), '2');
        await toggle('stickers', 'Missing'); await toggle('stickers', 'Assigned');
        assert.deepEqual(await rows(), individuals ? ['record-1-0', 'record-3-1', 'record-6-0'] : ['record-1', 'record-2', 'record-3', 'record-6']);
        await action('clear-open-facet').click();
        assert.equal((await rows()).length, individuals ? 11 : 8);
        assert.equal(await page.locator('button[data-facet-key="more"]').getAttribute('aria-pressed'), 'false');
        await toggle('recordStatuses', 'Complete');
        assert.deepEqual(await rows(), individuals
          ? ['record-0-0', 'record-2-0', 'record-2-2', 'record-4-0', 'record-5-0', 'record-7-0']
          : ['record-0', 'record-4', 'record-5', 'record-7']);
        await toggle('stickers', 'Missing');
        assert.equal((await rows()).length, 0, 'Complete and Missing stickers must not match different siblings');
        await toggle('recordStatuses', 'Incomplete');
        assert.deepEqual(await rows(), individuals ? ['record-2-1', 'record-3-0'] : ['record-2', 'record-3']);
        assert.equal(await page.locator('button[data-facet-key="more"] .mini-v2-facet-count').innerText(), '3');
        await toggle('stickers', 'Missing');
        assert.equal((await rows()).length, individuals ? 11 : 8, 'both status choices impose no status restriction');
        await action('clear-open-facet').click(); await toggle('recordStatuses', 'Complete');
        await page.locator('#miniV2SetFilter').selectOption('Lords of Madness');
        assert.deepEqual(await rows(), [individuals ? 'record-7-0' : 'record-7']);
        await action('clear-filters').click();
        assert.equal((await rows()).length, individuals ? 11 : 8);
        await page.locator('button[data-facet-key="more"]').click();
        assert.equal(await page.locator('[data-facet-kind="recordStatuses"][aria-pressed="true"]').count(), 0);
        await toggle('recordStatuses', 'Incomplete'); await toggle('stickers', 'Assigned');
        const beforeShortcut = await rows();
        await page.locator('.mini-v2-summary-desktop [data-collection-view="away"]').click();
        assert.deepEqual(await rows(), ['record-4-0'], 'collection shortcuts temporarily clear both filters');
        await action('clear-filters').click();
        assert.deepEqual(await rows(), beforeShortcut, 'Back restores both record and sticker filters');
        await page.locator('button[data-facet-key="more"]').click();
        assert.equal(await page.locator('[data-facet-kind="recordStatuses"][data-facet-value="Incomplete"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-facet-kind="stickers"][data-facet-value="Assigned"]').getAttribute('aria-pressed'), 'true');
      }
    });

    await check('Record status uses applied data and keeps the inspector and drafts when Save resolves the final issue', async () => {
      await fresh(makeHtml(recordFixture()));
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('[data-facet-kind="recordStatuses"][data-facet-value="Incomplete"]').click();
      await page.locator('button[data-facet-key="more"]').click();
      await open('record-2'); await mode('individuals'); await settle();
      assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), 'record-2-1');
      await mode('groups'); await action('edit-mini').click();
      const sticker = page.locator('[data-edit-copy-sticker="record-2-1"]');
      await sticker.fill('n/a');
      assert.equal(await page.locator('tr[data-group-id="record-2"]').count(), 1, 'drafts do not change browse completeness');
      await action('close-detail').click(); await open('record-2');
      assert.equal(await sticker.inputValue(), 'n/a');
      await action('discard-edit').click();
      assert.equal(await page.locator('#miniV2DetailStatusTip').textContent(), 'Stickers needed: 1 copy in this group.');
      await action('edit-mini').click(); await sticker.fill('n/a'); await action('save-edit').click();
      assert.equal(await page.locator('tr[data-group-id="record-2"]').count(), 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').textContent(), 'Record 2');
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
      assert.match(await page.locator('#miniV2DetailContent').innerText(), /outside your current browse filters/);
      await open('record-3'); await action('edit-mini').click();
      await page.locator('[data-edit-field="race"]').selectOption('Human');
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailStatusTip').textContent(), 'Stickers needed: 1 copy in this group.');
      await mode('individuals'); await settle();
      assert.deepEqual(await page.locator('tr[data-group-id="record-3"]').evaluateAll(nodes => nodes.map(n => n.dataset.copyId)), ['record-3-0']);
      await action('edit-mini').click();
      await page.locator('[data-edit-copy-sticker="record-3-0"]').fill('n/a'); await action('save-edit').click();
      assert.equal(await page.locator('tr[data-group-id="record-3"]').count(), 0);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').textContent(), 'Record 3');
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('Incomplete until stickered');
      await fillNewDetails(); await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      assert.equal(await page.locator('.mini-v2-name').filter({ hasText: 'Incomplete until stickered' }).count(), 0);
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-name').filter({ hasText: 'Incomplete until stickered' }).count(), 1);
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
      assert.equal(await page.locator('#miniV2DetailStatusTip').textContent(), 'Stickers needed: 1 copy in this group.');
    });

    await check('Record status header explains group-wide omissions without flagging resolved stickers, paint progress or away copies', async () => {
      const sample = recordFixture();
      sample.groups[3].copies[1].sticker = '';
      await fresh(makeHtml(sample));
      const tip = page.locator('#miniV2DetailStatusTip');
      for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) {
        await open(`record-${index}`);
        const incomplete = [1, 2, 3, 6].includes(index);
        assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), `Group record ${incomplete ? 'incomplete' : 'complete'}`);
        if (!incomplete) assert.equal(await tip.textContent(), 'All group details are filled in; every copy has a sticker or explicit n/a.');
        if (index === 1) assert.equal(await tip.textContent(), 'Missing: Race');
        if (index === 2) assert.equal(await tip.textContent(), 'Stickers needed: 1 copy in this group.');
        if (index === 3) {
          assert.equal(await tip.textContent(), 'Missing: Race\nStickers needed: 2 copies in this group.');
          await action('toggle-detail-status').click();
          assert.equal(await tip.evaluate(n => getComputedStyle(n).whiteSpace), 'pre-line');
          if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-record-explanation.png') });
        }
        if (index === 6) assert.equal(await tip.textContent(), 'Missing: Set #');
      }
      await mode('individuals');
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('[data-facet-kind="recordStatuses"][data-facet-value="Complete"]').click();
      await page.locator('button[data-facet-key="more"]').click();
      await page.locator('tr[data-copy-id="record-2-0"] .mini-v2-name').click();
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
      assert.equal(await tip.textContent(), 'Stickers needed: 1 copy in this group.', 'the header still explains the whole group, including hidden siblings');
    });

    await check('facets include explicit Not specified and unfamiliar saved choices without treating blanks as that choice', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      for (const key of ['size', 'creatureType', 'race', 'sex', 'role', 'set']) mixed.groups[0][key] = 'Not specified';
      mixed.groups[1].role = '';
      mixed.groups[2].role = 'Custom <role> & helper';
      await fresh(makeHtml(mixed));
      const fields = { sizes: 'size', creatureTypes: 'creatureType', races: 'race', sexes: 'sex', more: 'role' };
      for (const [facet, field] of Object.entries(fields)) {
        await page.locator(`button[data-facet-key="${facet}"]`).click();
        const kind = facet === 'more' ? 'roles' : facet;
        await page.locator(`[data-facet-kind="${kind}"][data-facet-value="Not specified"]`).click();
        assert.equal(await page.locator('.mini-v2-name').innerText(), mixed.groups[0].name, field);
        await action('clear-open-facet').click();
      }
      await page.locator('[data-facet-kind="roles"][data-facet-value="Custom <role> & helper"]').click();
      assert.equal(await page.locator('.mini-v2-name').innerText(), mixed.groups[2].name);
      await action('clear-open-facet').click();
      await page.locator('#miniV2SetFilter').selectOption('Not specified');
      assert.equal(await page.locator('.mini-v2-name').innerText(), mixed.groups[0].name);
      await page.locator('#miniV2SetFilter').selectOption('n/a');
      assert.deepEqual(await page.locator('.mini-v2-name').allTextContents(), [mixed.groups[1].name, mixed.groups[8].name]);
    });

    await check('n/a and Not specified filters never include blank metadata in either browse mode or sort', async () => {
      const mixed = JSON.parse(JSON.stringify(data));
      mixed.groups = ['', null, ' \t ', 'n/a', 'Not specified'].map((value, index) => {
        const group = JSON.parse(JSON.stringify(data.groups[0]));
        group.rootId = `value-${index}`;
        group.name = index < 3 ? `Z blank ${index}` : index === 3 ? 'A not applicable' : 'B not specified';
        for (const field of ['size', 'creatureType', 'race', 'sex', 'role', 'set']) group[field] = value;
        group.setNumber = '';
        group.copies = [{ ...group.copies[0], id: `value-${index}-01`, sticker: `A0${index}` }];
        return group;
      });
      const rows = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(nodes => nodes.map(n => n.dataset.groupId));
      for (const browseMode of ['groups', 'individuals']) {
        await fresh(makeHtml(mixed));
        if (browseMode === 'individuals') await mode(browseMode);
        for (const [facet, kind] of [['sizes', 'sizes'], ['creatureTypes', 'creatureTypes'], ['races', 'races'], ['sexes', 'sexes'], ['more', 'roles']]) {
          await page.locator(`button[data-facet-key="${facet}"]`).click();
          const options = page.locator(`[data-facet-kind="${kind}"]`);
          assert.equal(await options.evaluateAll(nodes => nodes.every(n => n.dataset.facetValue.trim() && n.dataset.facetValue !== 'Not entered')), true);
          await page.locator(`[data-facet-kind="${kind}"][data-facet-value="n/a"]`).click();
          assert.deepEqual(await rows(), ['value-3'], `${browseMode}: ${kind} n/a is explicit, not a fallback`);
          await page.locator(`[data-facet-kind="${kind}"][data-facet-value="Not specified"]`).click();
          assert.deepEqual(await rows(), ['value-3', 'value-4']);
          await page.locator(`[data-facet-kind="${kind}"][data-facet-value="n/a"]`).click();
          assert.deepEqual(await rows(), ['value-4']);
          await action('clear-open-facet').click();
          assert.equal((await rows()).length, 5, 'clearing the filter must reveal missing entries again');
        }
        const set = page.locator('#miniV2SetFilter');
        assert.deepEqual(await set.locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['', 'n/a', 'Not specified']);
        for (const [value, expected] of [['n/a', ['value-3']], ['Not specified', ['value-4']]]) {
          await set.selectOption(value);
          assert.deepEqual(await rows(), expected);
        }
        await action('clear-open-facet').click();
        await page.locator('button[data-facet-key="more"]').click();
        for (const key of ['race', 'sex', 'role']) {
          await page.locator(`[data-sort-key="${key}"]`).click();
          assert.deepEqual(new Set((await rows()).slice(0, 3)), new Set(['value-0', 'value-1', 'value-2']),
            `${browseMode}: sorting must use actual values instead of substituting n/a`);
        }
      }
    });

    await check('Set filter keeps focus and catalog choices after editing the final matching group', async () => {
      await fresh();
      const archmage = data.groups.find(group => group.name === 'Archmage');
      await open(archmage.rootId);
      await page.locator('[data-facet-key="more"]').click();
      await page.locator('#miniV2SetFilter').focus();
      await page.locator('#miniV2SetFilter').selectOption('Angelfire');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'miniV2SetFilter');
      assert.equal(await page.locator('.mini-v2-name').innerText(), 'Archmage');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="set"]').selectOption('n/a');
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-empty').count(), 1);
      assert.match(await page.locator('#miniV2DetailContent').innerText(), /outside your current browse filters/);
      await page.locator('button[data-facet-key="more"]').click();
      assert.equal(await page.locator('#miniV2SetFilter').inputValue(), 'Angelfire');
      assert.equal(await page.locator('#miniV2SetFilter option[value="Angelfire"]').count(), 1);
      await page.locator('#miniV2SetFilter').selectOption('');
      assert.equal(await page.locator('.mini-v2-name').count(), 9);
    });

    await check('More stays the same width and alignment as other popovers with dozens of long sets and a thin scrollbar', async () => {
      const stress = JSON.parse(JSON.stringify(data));
      for (let index = 0; index < 65; index++) {
        const group = JSON.parse(JSON.stringify(data.groups[0]));
        group.rootId = `stress-${index}`;
        group.role = `Custom role ${String(index).padStart(2, '0')}`;
        group.set = `Collector series ${String(index).padStart(2, '0')} with a very long edition name & additional details`;
        group.copies = [group.copies[0]];
        group.copies[0].id = `${group.rootId}-01`;
        stress.groups.push(group);
      }
      for (const width of [1440, 1100, 980, 390, 360]) {
        for (const large of [false, true]) {
          await page.setViewportSize({ width, height: large ? 560 : 1000 });
          await fresh(large ? makeHtml(stress) : html);
          if (width >= 980) await open(soldier);
          const geometry = () => page.evaluate(() => ({
            header: document.querySelector('.mini-v2-list-header').getBoundingClientRect().height,
            tableTop: document.getElementById('miniV2TableScroll').getBoundingClientRect().top,
            workspaceTop: document.querySelector('.mini-v2-workspace').getBoundingClientRect().top
          }));
          const before = await geometry();
          await page.locator('button[data-facet-key="sizes"]').click();
          await settle();
          const baseline = await page.locator('#miniV2FacetPopover').evaluate(node => ({
            left: node.getBoundingClientRect().left, width: node.getBoundingClientRect().width,
            gridLeft: node.querySelector('.mini-v2-facet-tile-grid').getBoundingClientRect().left,
            gridRight: node.querySelector('.mini-v2-facet-tile-grid').getBoundingClientRect().right
          }));
          await page.locator('button[data-facet-key="more"]').click();
          await settle();
          if (large) {
            // Exercise both overlay and space-consuming scrollbar platforms.
            await page.locator('#miniV2FacetPopoverBody').evaluate(n => { n.style.scrollbarGutter = 'stable'; });
            await settle();
          }
          const measured = await page.locator('#miniV2FacetPopover').evaluate(node => {
            const rect = node.getBoundingClientRect();
            const body = node.querySelector('.mini-v2-facet-popover-body');
            const controls = [...body.querySelectorAll('.mini-v2-facet-tile-grid, select')].map(n => ({
              left: n.getBoundingClientRect().left, right: n.getBoundingClientRect().right
            }));
            return { left: rect.left, width: rect.width, right: rect.right, bottom: rect.bottom, height: rect.height,
              workspaceBottom: document.querySelector('.mini-v2-workspace').getBoundingClientRect().bottom,
              scrollbarWidth: body.offsetWidth - body.clientWidth,
              scrollbarStyle: getComputedStyle(body).scrollbarWidth,
              overflowing: body.scrollHeight > body.clientHeight, controls,
              choiceLabelsFit: [...body.querySelectorAll('[data-facet-kind="paints"] .mini-v2-facet-tile-label, [data-facet-kind="stickers"] .mini-v2-facet-tile-label, [data-facet-kind="recordStatuses"] .mini-v2-facet-tile-label')]
                .every(n => n.scrollWidth <= n.clientWidth) };
          });
          assert.equal(measured.width, baseline.width, `same width at ${width}, large=${large}`);
          assert.equal(measured.left, baseline.left);
          assert.ok(measured.right <= width && measured.choiceLabelsFit, JSON.stringify(measured));
          assert.ok(measured.height <= Math.min((large ? 560 : 1000) * .72, 460) + 1);
          assert.ok(measured.bottom <= Math.min(large ? 560 : 1000, measured.workspaceBottom) - 7,
            `popover stays inside the visible pane: ${JSON.stringify(measured)}`);
          for (const control of measured.controls) {
            assert.ok(Math.abs(control.left - baseline.gridLeft) < 1, 'left edges align');
            assert.ok(Math.abs(control.right - baseline.gridRight) < 1, `right edges align: ${JSON.stringify(measured)}`);
          }
          assert.deepEqual(await geometry(), before);
          if (large) {
            assert.ok(measured.overflowing && measured.scrollbarStyle === 'thin');
            assert.ok(measured.scrollbarWidth > 0, 'exercise a scrollbar that reserves actual layout space');
            assert.ok((await page.locator('#miniV2SetFilter option').count()) > 60);
            await page.locator('#miniV2SetFilter').focus();
            await page.locator('#miniV2SetFilter').selectOption(stress.groups[10].set);
            await settle();
            assert.equal(await page.evaluate(() => document.activeElement.id), 'miniV2SetFilter');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#miniV2FacetPopover').isVisible(), true);
            const top = await page.locator('#miniV2FacetPopoverBody').evaluate(n => n.scrollTop);
            await page.locator('#miniV2SetFilter').selectOption('');
            await settle();
            assert.equal(await page.locator('#miniV2FacetPopoverBody').evaluate(n => n.scrollTop), top);
          }
          assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
          const incomplete = page.locator('[data-facet-kind="recordStatuses"][data-facet-value="Incomplete"]');
          await incomplete.focus();
          await page.keyboard.press('Space'); await settle();
          assert.equal(await incomplete.getAttribute('aria-pressed'), 'true');
          assert.equal(await incomplete.evaluate(n => n === document.activeElement), true);
          if (process.env.SCREENSHOT_PATH) await page.screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-more-${width}${large ? '-stress' : ''}.png`)
          });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('Set number limits new input without blocking unrelated edits to a legacy value', async () => {
      const legacy = JSON.parse(JSON.stringify(data));
      legacy.groups[0].setNumber = 'n/a';
      await fresh(makeHtml(legacy));
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Spellcaster');
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-read-card').nth(5).innerText(), /Lords of Madness \(n\/a\)/);
      await action('edit-mini').click();
      const number = page.locator('[data-edit-field="setNumber"]');
      await number.fill('abc');
      await action('save-edit').click();
      assert.equal(await number.getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#miniV2EditorError').innerText(), /starting with a digit/);
      await number.fill('1234');
      assert.equal(await number.inputValue(), '123');
      assert.equal(await number.getAttribute('aria-invalid'), null);
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-read-card').nth(5).innerText(), /Lords of Madness \(123\)/);
    });

    await check('new groups use the same editor in both browse modes and publish only on Create', async () => {
      for (const browseMode of ['groups', 'individuals']) {
        await fresh();
        await mode(browseMode);
        const countBefore = await page.locator('.mini-v2-browse-table tbody tr').count();
        const headerHeight = await page.locator('.mini-v2-list-header').evaluate(n => n.clientHeight);
        await action('new-group').click();
        await settle();
        const rootId = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
        assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), countBefore);
        assert.equal(await page.locator('.mini-v2-list-header').evaluate(n => n.clientHeight), headerHeight);
        assert.equal(await page.locator('#miniV2EditName').inputValue(), '');
        assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').count(), 1);
        assert.equal(await action('save-edit').innerText(), 'Create Group');
        assert.equal(await action('save-edit').isDisabled(), true);
        assert.equal(await page.locator('#miniV2EditorError').isVisible(), false);
        await page.locator('#miniV2EditName').fill(`Mock Scout ${browseMode}`);
        assert.equal(await action('save-edit').isDisabled(), true);
        assert.match(await action('save-edit').getAttribute('title'), /Home/);
        await page.locator('[data-edit-field="home"]').selectOption('Spare People');
        assert.equal(await action('save-edit').isDisabled(), true);
        assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '1 / 1');
        await page.locator('[data-edit-field="size"]').selectOption('Small');
        await page.locator('[data-edit-field="creatureType"]').selectOption('Humanoid');
        await page.locator('[data-edit-field="race"]').selectOption('Elf');
        await page.locator('[data-edit-field="sex"]').selectOption('Female');
        await page.locator('[data-edit-field="role"]').selectOption('Ranged');
        await page.locator('[data-edit-field="set"]').selectOption('n/a');
        assert.equal(await action('save-edit').isDisabled(), true);
        await page.locator('[data-edit-field="paint"]').selectOption('Painted');
        assert.equal(await action('save-edit').isDisabled(), false);
        await action('add-copy').click();
        assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '2 / 2');
        assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').count(), 2);
        await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').first().fill('Z901');
        await page.locator('.mini-v2-editor-copy-note').first().fill('Green cloak');
        await page.locator('.mini-v2-copy-select').first().selectOption('Quest Minis');
        assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '1 / 2');
        await page.locator('[data-edit-field="notes"]').fill('A new mock group');
        assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), countBefore);
        if (process.env.SCREENSHOT_PATH && browseMode === 'groups') await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-creation.png')
        });
        await action('save-edit').click();
        assert.equal(await page.locator('[data-editor-root]').count(), 0);
        assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), countBefore + (browseMode === 'groups' ? 1 : 2));
        assert.equal(await page.locator(`tr[data-group-id="${rootId}"]`).count(), browseMode === 'groups' ? 1 : 2);
        assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 2);
        assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
        assert.equal(await page.locator('#miniV2DetailStatusTip').textContent(), 'Stickers needed: 1 copy in this group.');
        assert.equal(await page.locator('.mini-v2-copy-note-cell').first().innerText(), 'Green cloak');
      }
    });

    await check('next sticker is ready immediately from the latest assigned ID, or A00 for an empty collection', async () => {
      const scanned = JSON.parse(JSON.stringify(data));
      scanned.groups[0].copies[0].sticker = ' g99 ';
      scanned.groups[0].copies[1].sticker = 'Z123';
      scanned.groups.at(-1).copies[0].sticker = 'n/a';
      for (const browseMode of ['groups', 'individuals']) {
        await fresh(makeHtml(scanned));
        await mode(browseMode);
        await action('new-group').click();
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply H00');
        assert.equal(await action('apply-next-sticker').isDisabled(), false);
        await action('apply-next-sticker').click();
        assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'H00');
        await action('add-copy').click();
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply H01');
        await action('apply-next-sticker').click();
        assert.deepEqual(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').evaluateAll(nodes => nodes.map(n => n.value)), ['H00', 'H01']);
      }
      const empty = { ...data, groups: [] };
      await fresh(makeHtml(empty));
      await action('new-group').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A00');
      await action('apply-next-sticker').click();
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'A00');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply A01');
    });

    await check('next sticker remembers saved progress across reload without persisting miniature data or consuming drafts', async () => {
      const storagePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      storagePage.on('pageerror', error => errors.push(error.message));
      const key = 'ppq-miniature-tracker:mock:next-sticker:v1';
      const storageAction = name => settledAction(storagePage, storagePage.locator(`[data-action="${name}"]`));
      try {
        await storagePage.route('https://ppq-sticker.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
        await storagePage.goto('https://ppq-sticker.test/');
        await storageAction('new-group').click();
        assert.equal(await storageAction('apply-next-sticker').innerText(), 'Apply M08');
        await storageAction('apply-next-sticker').click();
        await storageAction('add-copy').click();
        await storageAction('apply-next-sticker').click();
        await storagePage.locator('#miniV2EditName').fill('Automatic IDs');
        await storagePage.locator('[data-edit-field="home"]').selectOption('Spare People');
        await fillNewDetails({}, storagePage);
        await storageAction('save-edit').click();
        assert.equal(await storagePage.evaluate(key => localStorage.getItem(key), key), 'M10');
        assert.deepEqual(await storagePage.evaluate(() => Object.keys(localStorage)), [key]);
        await storagePage.reload();
        assert.equal(await storagePage.locator('.mini-v2-browse-table tbody tr').count(), data.groups.length);
        await storageAction('new-group').click();
        assert.equal(await storageAction('apply-next-sticker').innerText(), 'Apply M10');
        await storageAction('apply-next-sticker').click();
        await storageAction('close-detail').click();
        await storagePage.locator(`tr[data-group-id="${soldier}"]`).click();
        await storageAction('edit-mini').click();
        await storagePage.locator('[data-edit-field="role"]').selectOption('Ranged');
        await storageAction('save-edit').click();
        assert.equal(await storagePage.evaluate(key => localStorage.getItem(key), key), 'M10');
        storagePage.once('dialog', dialog => dialog.accept());
        await storagePage.reload();
        await storageAction('new-group').click();
        assert.equal(await storageAction('apply-next-sticker').innerText(), 'Apply M10');
        assert.equal(await storageAction('apply-next-sticker').isDisabled(), false);
      } finally {
        await storagePage.close();
      }
    });

    await check('next sticker validates remembered IDs and skips collisions, with a collection fallback for bad storage', async () => {
      const storagePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      storagePage.on('pageerror', error => errors.push(error.message));
      const key = 'ppq-miniature-tracker:mock:next-sticker:v1';
      const storageAction = name => settledAction(storagePage, storagePage.locator(`[data-action="${name}"]`));
      try {
        await storagePage.route('https://ppq-sticker.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
        await storagePage.goto('https://ppq-sticker.test/');
        for (const [stored, expected] of [['a97', 'A98'], ['M07', 'M08'], ['a99', 'A99'], ['bad value', 'M08'], ['A100', 'M08'], ['', 'M08']]) {
          await storagePage.evaluate(({ key, stored }) => localStorage.setItem(key, stored), { key, stored });
          await storagePage.reload();
          await storageAction('new-group').click();
          assert.equal(await storageAction('apply-next-sticker').innerText(), `Apply ${expected}`);
          assert.equal(await storageAction('apply-next-sticker').isDisabled(), false);
          if (stored === 'a99') {
            await storageAction('apply-next-sticker').click();
            await storageAction('add-copy').click();
            assert.equal(await storageAction('apply-next-sticker').innerText(), 'Apply B00');
          }
          await storageAction('discard-edit').click();
        }
        await storagePage.evaluate(key => localStorage.setItem(key, 'end'), key);
        await storagePage.reload();
        await storageAction('new-group').click();
        assert.equal(await storageAction('apply-next-sticker').isDisabled(), true);
        assert.match(await storageAction('apply-next-sticker').getAttribute('title'), /through Z99/);
      } finally {
        await storagePage.close();
      }
    });

    await check('next sticker works when embedded-browser storage is blocked', async () => {
      const blockedPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      blockedPage.on('pageerror', error => errors.push(error.message));
      try {
        await blockedPage.addInitScript(() => Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('Storage blocked', 'SecurityError'); }
        }));
        await blockedPage.route('https://ppq-sticker.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
        await blockedPage.goto('https://ppq-sticker.test/');
        await blockedPage.locator('[data-action="new-group"]').click();
        const apply = blockedPage.locator('[data-action="apply-next-sticker"]');
        assert.equal(await apply.innerText(), 'Apply M08');
        await apply.click();
        await blockedPage.locator('#miniV2EditName').fill('Storage fallback');
        await blockedPage.locator('[data-edit-field="home"]').selectOption('Spare People');
        await fillNewDetails({}, blockedPage);
        await blockedPage.locator('[data-action="save-edit"]').click();
        await blockedPage.locator('[data-action="edit-mini"]').click();
        await blockedPage.locator('[data-action="add-copy"]').click();
        assert.equal(await apply.innerText(), 'Apply M09');
        assert.equal(await apply.isDisabled(), false);
      } finally {
        await blockedPage.close();
      }
    });

    await check('next sticker fills the first blank row without adding copies or following individual selection', async () => {
      for (const browseMode of ['groups', 'individuals']) {
        await fresh();
        await mode(browseMode);
        const browseCount = await page.locator('.mini-v2-browse-table tbody tr').count();
        await action('new-group').click();
        assert.equal(await action('apply-next-sticker').isDisabled(), false);
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
        await page.locator('#miniV2EditName').fill('Sticker test');
        await page.locator('[data-edit-field="home"]').selectOption('Spare People');
        await fillNewDetails();
        await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('b91');
        await action('add-copy').click();
        await action('add-copy').click();
        const values = () => page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').evaluateAll(nodes => nodes.map(n => n.value));
        const lastId = await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().getAttribute('data-edit-copy-sticker');
        if (browseMode === 'individuals') {
          await page.locator(`[data-detail-copy-id="${lastId}"] td`).nth(1).click();
          assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), lastId);
        }
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply B92');
        await action('apply-next-sticker').click();
        assert.deepEqual(await values(), ['b91', 'B92', '']);
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply B93');
        if (browseMode === 'individuals') {
          assert.equal(await page.locator('.mini-v2-copy-row.is-target').getAttribute('data-detail-copy-id'), lastId);
        }
        await action('apply-next-sticker').click();
        assert.deepEqual(await values(), ['b91', 'B92', 'B93']);
        assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 3);
        assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), browseCount);
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply B94');
        assert.equal(await action('apply-next-sticker').isDisabled(), true);
        await action('apply-next-sticker').evaluate(n => n.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        assert.deepEqual(await values(), ['b91', 'B92', 'B93']);
        await action('save-edit').click();
        await action('edit-mini').click();
        await action('add-copy').click();
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply B94');
        await action('apply-next-sticker').click();
        assert.deepEqual(await values(), ['B94']);
        assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 4);
      }
    });

    await check('next sticker preserves two digits and rolls from 99 to the next letter without passing Z99', async () => {
      await fresh();
      await action('new-group').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('e98');
      for (const code of ['E99', 'F00', 'F01']) {
        await action('add-copy').click();
        assert.equal(await action('apply-next-sticker').innerText(), `Apply ${code}`);
        await action('apply-next-sticker').click();
        assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().inputValue(), code);
      }
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').first().fill('a99');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply B00');
      await action('apply-next-sticker').click();
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().inputValue(), 'B00');
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').first().fill('Z99');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').isDisabled(), true);
      assert.match(await action('apply-next-sticker').getAttribute('title'), /through Z99/);
      await fresh();
      await action('new-group').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('n/a');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').isDisabled(), false);
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
    });

    await check('next sticker skips active and parked IDs but releases deleted IDs, with safe Undo', async () => {
      const reserved = JSON.parse(JSON.stringify(data));
      reserved.groups[1].copies[0].sticker = 'E92';
      reserved.groups[3].copies[0].sticker = 'e94';
      await fresh(makeHtml(reserved));
      await open(reserved.groups[1].rootId);
      await action('edit-mini').click();
      await action('delete-group').click();
      await action('confirm-delete-group').click();
      await open(soldier);
      await action('edit-mini').click();
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('e91');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply E92');
      await action('apply-next-sticker').click();
      await action('close-detail').click();
      await open(fighter);
      await action('edit-mini').click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply E93');
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('e92');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('');
      await action('apply-next-sticker').click();
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'E93');
      await action('close-detail').click();
      await open(soldier);
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply E95');
      await action('apply-next-sticker').click();
      await review('undo-delete-group');
      assert.match(await page.locator('#miniV2ChangesMenu [role="status"]').innerText(), /Cannot undo yet: E92/);
      assert.equal(await page.locator(`tr[data-group-id="${reserved.groups[1].rootId}"]`).count(), 0);
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Zhent Soldier', 'blocked Undo leaves the current editor intact');
      await page.keyboard.press('Escape');
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').nth(1).fill('');
      await review('undo-delete-group');
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply E96');
      assert.equal(await page.locator('.mini-v2-editor-sticker').first().inputValue(), 'E92');
    });

    await check('next sticker suggestions do not consume IDs and removed or discarded draft reservations are released', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('G90');
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G91');
      await page.locator('[data-edit-field="role"]').selectOption('Ranged');
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G91');
      await action('apply-next-sticker').click();
      const filledId = await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().getAttribute('data-edit-copy-sticker');
      await page.locator(`[data-remove-copy="${filledId}"]`).click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G91');
      await action('apply-next-sticker').click();
      await action('close-detail').click();
      await open(fighter);
      await action('edit-mini').click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G92');
      await action('apply-next-sticker').click();
      await action('discard-edit').click();
      await action('edit-mini').click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G92');
      await action('apply-next-sticker').click();
      await action('save-edit').click();
      await action('close-detail').click();
      await open(soldier);
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G93');
      await action('discard-edit').click();
      await action('close-detail').click();
      await open(fighter);
      await action('edit-mini').click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply G91');
    });

    await check('next sticker action keeps headers, columns and button positions stable on desktop and mobile', async () => {
      for (const width of [1440, 1100, 980, 390, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        await action('new-group').click();
        await settle();
        const geometry = () => page.locator('#miniV2DetailPanel').evaluate(panel => {
          const editor = panel.querySelector('.mini-v2-editor').getBoundingClientRect();
          return {
            header: panel.querySelector('.mini-v2-detail-header').getBoundingClientRect().height,
            browseHeader: document.querySelector('.mini-v2-list-header').getBoundingClientRect().height,
            editorWidth: editor.width, editorHeight: editor.height,
            columns: [...panel.querySelectorAll('.mini-v2-copy-table th')].map(n => n.getBoundingClientRect().width),
            buttons: [...panel.querySelectorAll('.mini-v2-copy-edit-actions button')].map(n => {
              const rect = n.getBoundingClientRect();
              return { left: rect.left - editor.left, top: rect.top - editor.top, width: rect.width, height: rect.height };
            })
          };
        });
        const before = await geometry();
        await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('G00');
        assert.equal(await action('apply-next-sticker').innerText(), 'Apply G01');
        assert.deepEqual(await geometry(), before);
        assert.equal(await page.locator('.mini-v2-copy-edit-actions').evaluate(row => {
          const rect = row.getBoundingClientRect();
          return [...row.querySelectorAll('button')].every(n => {
            const button = n.getBoundingClientRect();
            return button.left >= rect.left && button.right <= rect.right + 0.1 && n.scrollWidth <= n.clientWidth;
          });
        }), true, `copy actions fit at ${width}px`);
        if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-next-sticker-${width}.png`)
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('new drafts survive close, navigation and filters without creating phantom browse entries', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Spellcaster');
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('Draft Ranger');
      const draftId = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await page.locator('[data-edit-field="home"]').selectOption('Drow');
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-copy-note').last().fill('Blue cloak');
      await action('close-detail').click();
      await page.locator('#miniV2SearchInput').fill('Archmage');
      await action('new-group').click();
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), draftId);
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Draft Ranger');
      assert.equal(await page.locator('.mini-v2-editor-copy-note').last().inputValue(), 'Blue cloak');
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 1);
      await action('discard-edit').click();
      assert.equal(await page.locator('#miniV2EditName').inputValue(), 'Zhent Soldier');
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Spellcaster');
      await action('close-detail').click();
      await action('new-group').click();
      assert.notEqual(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), draftId);
      await page.locator('#miniV2EditName').fill('Hidden New Group');
      await page.locator('[data-edit-field="home"]').selectOption('Dwarves');
      await fillNewDetails();
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'Archmage');
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Hidden New Group');
      assert.match(await page.locator('#miniV2DetailContent').innerText(), /outside your current browse filters/);
    });

    await check('copy additions and removals stay staged, preserve earlier location work and keep stable identities', async () => {
      await fresh();
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await action('edit-mini').click();
      await action('add-copy').click();
      const addedId = await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').getAttribute('data-edit-copy-sticker');
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('Z902');
      await page.locator('.mini-v2-editor-copy-note').last().fill('Purple armor');
      await page.locator('[data-remove-copy="013-ZHESOL-02"]').click();
      assert.equal(await page.locator('.mini-v2-copy-row.is-removed').count(), 1);
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '2 / 3');
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-count`).innerText(), '3/3');
      await action('close-detail').click();
      await open(soldier);
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'Z902');
      await action('undo-remove-copy').click();
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '3 / 4');
      await page.locator('[data-remove-copy="013-ZHESOL-02"]').click();
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 3);
      assert.equal(await page.locator('[data-detail-copy-id="013-ZHESOL-02"]').count(), 0);
      assert.equal(await page.locator(`[data-detail-copy-id="${addedId}"]`).count(), 1);
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-count`).innerText(), '2/3');
      await action('edit-mini').click();
      await action('add-copy').click();
      const nextAddedId = await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').getAttribute('data-edit-copy-sticker');
      assert.notEqual(nextAddedId, addedId);
      await action('discard-edit').click();
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 3);
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      await mode('individuals');
      assert.equal(await page.locator(`.mini-v2-browse-table tr[data-copy-id="${addedId}"]`).count(), 1);
    });

    await check('new copies inherit Home until explicitly moved and stickers are validated only at Save', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await action('add-copy').click();
      const sticker = page.locator('.mini-v2-editor-sticker[data-new-copy="true"]');
      await sticker.fill('a01');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      assert.equal(await sticker.getAttribute('aria-invalid'), 'true');
      await sticker.fill('Z903');
      await page.locator('[data-edit-field="home"]').selectOption('Dwarves');
      assert.equal(await page.locator('.mini-v2-copy-select').last().inputValue(), 'Dwarves');
      assert.equal(await select(firstCopy).inputValue(), 'Spare People');
      await page.locator('.mini-v2-copy-select').last().selectOption('Quest Minis');
      await page.locator('[data-edit-field="home"]').selectOption('Male Humans');
      assert.equal(await page.locator('.mini-v2-copy-select').last().inputValue(), 'Quest Minis');
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().fill('z903');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().fill('');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      assert.equal(await page.locator('.mini-v2-copy-select').last().inputValue(), 'Spare People');
      assert.equal(await page.locator('.mini-v2-copy-select').nth(3).inputValue(), 'Quest Minis');
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '4 / 5');
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 5);
      assert.equal(await page.locator('.mini-v2-availability-count').innerText(), '4 / 5');
    });

    await check('the last copy cannot delete a group implicitly and an empty new group cannot be created', async () => {
      await fresh();
      await open('086-BREJAG');
      await action('edit-mini').click();
      await action('remove-copy').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /at least one copy.*Delete group/);
      assert.equal(await page.locator('.mini-v2-copy-row.is-removed').count(), 0);
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('No Copies');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await fillNewDetails();
      await action('remove-copy').click();
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 0);
      assert.equal(await action('save-edit').isDisabled(), true);
      assert.match(await action('save-edit').getAttribute('title'), /at least one copy/);
      await action('add-copy').click();
      assert.equal(await action('save-edit').isDisabled(), false);
      await action('save-edit').click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'No Copies');
    });

    await check('Create Group enables only for a valid draft and follows edits, copies, duplicates and draft recovery', async () => {
      await fresh();
      await action('new-group').click();
      const create = action('save-edit');
      assert.equal(await create.isDisabled(), true);
      await page.locator('#miniV2EditName').fill('Valid Draft');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await fillNewDetails();
      assert.equal(await create.isDisabled(), false);
      await page.locator('#miniV2EditName').fill('   ');
      assert.equal(await create.isDisabled(), true);
      await page.locator('#miniV2EditName').fill('Valid Draft');
      assert.equal(await create.isDisabled(), false);
      await page.locator('[data-edit-field="home"]').selectOption('');
      assert.equal(await create.isDisabled(), true);
      await page.locator('.mini-v2-copy-select').selectOption('__RETURN_HOME__');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      assert.equal(await create.isDisabled(), true);
      assert.match(await create.getAttribute('title'), /current location/);
      await page.locator('.mini-v2-copy-select').selectOption('Spare People');
      assert.equal(await create.isDisabled(), false);
      const sticker = page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').first();
      await sticker.fill('a12');
      assert.equal(await create.isDisabled(), true);
      assert.match(await create.getAttribute('title'), /already assigned/);
      await create.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 9);
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      await sticker.fill('Z910');
      assert.equal(await create.isDisabled(), false);
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').last().fill('z910');
      assert.equal(await create.isDisabled(), true);
      await action('close-detail').click();
      await action('new-group').click();
      assert.equal(await create.isDisabled(), true);
      await page.locator('.mini-v2-remove-copy').last().click();
      assert.equal(await create.isDisabled(), false);
      await page.locator('[data-edit-field="set"]').selectOption('Lords of Madness');
      await page.locator('[data-edit-field="setNumber"]').fill('abc');
      assert.equal(await create.isDisabled(), true);
      assert.match(await create.getAttribute('title'), /starting with a digit/);
      await page.locator('[data-edit-field="setNumber"]').fill('');
      await page.locator('[data-edit-field="set"]').selectOption('n/a');
      assert.equal(await create.isDisabled(), false);
      await sticker.fill('');
      assert.equal(await create.isDisabled(), false);
      await page.locator('[data-edit-field="set"]').selectOption('n/a');
      assert.equal(await create.isDisabled(), false);
      await create.click();
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Valid Draft');
    });

    await check('blank choices are distinct from explicit Not specified and block creation until answered', async () => {
      await fresh();
      await action('new-group').click();
      const create = action('save-edit');
      const labels = { size: 'Size', creatureType: 'Creature Type', race: 'Race', sex: 'Sex', role: 'Role', set: 'Set', paint: 'Paint' };
      for (const key of [...Object.keys(labels), 'home']) {
        const field = page.locator(`[data-edit-field="${key}"]`);
        assert.equal(await field.inputValue(), '');
        assert.equal(await field.evaluate(n => n.selectedOptions[0].textContent), '');
        assert.equal(await field.locator('option[value="Not specified"]').count(), ['home', 'paint'].includes(key) ? 0 : 1);
      }
      await page.locator('#miniV2EditName').fill('Unknown Character');
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      assert.equal(await create.isDisabled(), true);
      await fillNewDetails(Object.fromEntries(Object.keys(labels).map(key => [key, key === 'paint' ? 'Painted' : 'Not specified'])));
      assert.equal(await create.isDisabled(), false);
      for (const [key, label] of Object.entries(labels)) {
        const field = page.locator(`[data-edit-field="${key}"]`);
        await field.focus();
        await field.selectOption('');
        assert.equal(await create.isDisabled(), true);
        assert.ok((await create.getAttribute('title')).includes(`Choose ${label}`));
        await create.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        assert.equal(await field.getAttribute('aria-invalid'), 'true', `${label} blank validation`);
        assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 9);
        await field.selectOption(key === 'paint' ? 'Painted' : 'Not specified');
        assert.equal(await field.getAttribute('aria-invalid'), null);
        assert.equal(await create.isDisabled(), false);
      }
      const set = page.locator('[data-edit-field="set"]');
      const number = page.locator('[data-edit-field="setNumber"]');
      await set.selectOption('Lords of Madness');
      assert.equal(await create.isDisabled(), true);
      assert.match(await create.getAttribute('title'), /Enter Set #/);
      await number.fill('40');
      assert.equal(await create.isDisabled(), false);
      await number.fill('');
      assert.equal(await create.isDisabled(), true);
      await set.selectOption('n/a');
      assert.equal(await create.isDisabled(), false);
      await set.selectOption('Not specified');
      assert.equal(await create.isDisabled(), false);
      await action('close-detail').click();
      await action('new-group').click();
      assert.equal(await create.isDisabled(), false);
      for (const key of Object.keys(labels)) {
        assert.equal(await page.locator(`[data-edit-field="${key}"]`).inputValue(), key === 'paint' ? 'Painted' : 'Not specified');
      }
      await page.locator('[data-edit-field="notes"]').fill('The character details are unknown.');
      await page.locator('.mini-v2-editor-sticker').fill('n/a');
      await create.click();
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
      assert.equal(await page.locator('.mini-v2-set-field .mini-v2-read-value').innerText(), 'Not specified');
      await action('edit-mini').click();
      for (const key of Object.keys(labels)) {
        assert.equal(await page.locator(`[data-edit-field="${key}"]`).inputValue(), key === 'paint' ? 'Painted' : 'Not specified');
      }
      await page.locator('[data-edit-field="race"]').selectOption('');
      await action('save-edit').click();
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record incomplete');
      assert.equal(await page.locator('#miniV2DetailStatusTip').textContent(), 'Missing: Race');
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="race"]').inputValue(), '');
      assert.equal(await page.locator('[data-edit-field="race"]').evaluate(n => n.selectedOptions[0].textContent), '');
    });

    await check('group deletion is explicit and Undo restores identity, copies, pending moves and the editor draft', async () => {
      await fresh();
      await open(soldier);
      await select(firstCopy).selectOption('Quest Minis');
      await action('edit-mini').click();
      await page.locator('[data-edit-field="role"]').selectOption('Spellcaster');
      await action('add-copy').click();
      await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('Z904');
      await action('delete-group').click();
      assert.match(await page.locator('.mini-v2-delete-confirm').innerText(), /Zhent Soldier and all 3 copies/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.mini-v2-delete-confirm').isVisible(), false);
      assert.equal(await page.locator('[data-editor-root]').count(), 1);
      await action('delete-group').click();
      await action('cancel-delete-group').click();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 1);
      await action('delete-group').click();
      if (process.env.SCREENSHOT_PATH) await page.screenshot({
        path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-delete-confirmation.png')
      });
      await action('confirm-delete-group').click();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 0);
      await review('undo-delete-group');
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), soldier);
      assert.equal(await page.locator('[data-edit-field="role"]').inputValue(), 'Spellcaster');
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').inputValue(), 'Z904');
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-count`).innerText(), '3/3');
      await action('discard-edit').click();
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 3);
    });

    await check('a new group can reuse a deleted sticker without reviving or counting the deleted group', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await action('delete-group').click();
      await action('confirm-delete-group').click();
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /25.*8/);
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('Zhent Soldier');
      await fillNewDetails({ home: 'Spare People', paint: 'Unpainted' });
      const newRoot = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await page.locator('.mini-v2-editor-sticker').fill('a12');
      assert.equal(await action('save-edit').isDisabled(), false);
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true);
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /26.*9/);
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 0);
      await page.locator('#miniV2SearchInput').fill('a12');
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-group-id]').count(), 1);
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr[data-group-id]').getAttribute('data-group-id'), newRoot);
      await page.locator('#miniV2SearchInput').fill('');
      await review('undo-delete-group');
      assert.match(await page.locator('#miniV2ChangesMenu [role="status"]').innerText(), /Cannot undo yet: A12/);
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /26.*9/);
      await page.keyboard.press('Escape');
      await action('edit-mini').click();
      await page.locator('.mini-v2-editor-sticker').fill('');
      await action('save-edit').click();
      await review('undo-delete-group');
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), soldier);
      assert.equal(await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).inputValue(), 'A12');
      assert.equal(await page.locator(`tr[data-group-id="${newRoot}"]`).count(), 1);
      assert.match(await page.locator('.mini-v2-collection-total').innerText(), /29.*10/);
      assert.equal(await page.locator('#miniV2ChangesMenu [role="status"]').count(), 0);
    });

    await check('copy controls preserve all four columns through editing, additions, removals and narrow scrolling', async () => {
      for (const width of [1440, 1100, 980, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await fresh();
        await open(fighter);
        const columns = () => page.locator('.mini-v2-copy-table th').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
        const before = await columns();
        await action('edit-mini').click();
        assert.deepEqual(await columns(), before);
        await action('add-copy').click();
        await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').fill('Z905');
        assert.deepEqual(await columns(), before);
        assert.equal(await page.locator('.mini-v2-copy-note-editor').evaluateAll(nodes => nodes.every(node => {
          const cell = node.closest('td').getBoundingClientRect();
          const button = node.querySelector('button').getBoundingClientRect();
          const input = node.querySelector('input').getBoundingClientRect();
          return button.right <= cell.right && input.right <= button.left && input.width > 50;
        })), true);
        await page.locator('[data-remove-copy="048-SPIFOLFIG-01"]').click();
        assert.deepEqual(await columns(), before);
        await action('undo-remove-copy').click();
        assert.deepEqual(await columns(), before);
        assert.equal(await page.locator('.mini-v2-editor-sticker').evaluateAll(nodes => nodes.every(n => {
          const style = getComputedStyle(n);
          const text = document.createElement('canvas').getContext('2d');
          text.font = style.font;
          return n.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) >= text.measureText('A12').width;
        })), true);
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
        if (process.env.SCREENSHOT_PATH) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-copy-controls-${width}.png`)
        });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('detail completeness icons keep one footprint for complete, one-missing and many-missing groups', async () => {
      const geometry = () => page.locator('.mini-v2-detail-header').evaluate(header => {
        const bounds = header.getBoundingClientRect();
        return { height: bounds.height, children: [...header.querySelectorAll('#miniV2DetailHeaderTitle, .mini-v2-detail-status, .mini-v2-detail-header-actions')].map(node => {
          const box = node.getBoundingClientRect();
          return { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
        }) };
      });
      for (const width of [1440, 980, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        let baseline;
        for (const fields of [[], ['race'], ['race', 'role', 'set', 'size']]) {
          const sample = JSON.parse(JSON.stringify(data));
          for (const field of fields) sample.groups[0][field] = '';
          await fresh(makeHtml(sample)); await open(soldier);
          const indicator = action('toggle-detail-status');
          assert.equal(await indicator.getAttribute('aria-label'), fields.length ? 'Group record incomplete' : 'Group record complete');
          assert.equal(await page.locator('#miniV2DetailHeaderTags').innerText(), '');
          assert.equal(await indicator.getAttribute('aria-describedby'), 'miniV2DetailStatusTip');
          const current = await geometry();
          if (!baseline) baseline = current;
          assert.deepEqual(current, baseline, `completeness must not change header geometry at ${width}px`);
          assert.equal(current.children[1].width, 24);
          assert.equal(current.children[1].height, 24);
          await indicator.click();
          const tip = page.locator('#miniV2DetailStatusTip');
          assert.equal(await tip.isVisible(), true);
          assert.equal(await tip.textContent(), fields.length > 1 ? 'Missing: Size, Race, Role, Set'
            : fields.length ? 'Missing: Race' : 'All group details are filled in; every copy has a sticker or explicit n/a.');
          assert.deepEqual(await geometry(), baseline, 'the explanation must not shift any header content');
          const box = await tip.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 1000);
          assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
          if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width) && fields.length <= 1) await page.screenshot({
            path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-status-${fields.length ? 'missing' : 'complete'}-${width}.png`)
          });
          await page.keyboard.press('Escape');
          assert.equal(await tip.isVisible(), false);
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('detail status explanations support hover, keyboard and touch without losing selection or pending changes', async () => {
      await fresh(); await open(soldier);
      const indicator = action('toggle-detail-status');
      const tip = page.locator('#miniV2DetailStatusTip');
      await indicator.hover();
      assert.equal(await tip.isVisible(), true);
      await tip.hover(); await page.waitForTimeout(200);
      assert.equal(await tip.isVisible(), true, 'the explanation must remain hoverable');
      await page.mouse.move(1, 1); await page.waitForTimeout(200);
      assert.equal(await tip.isVisible(), false);
      await indicator.focus();
      assert.equal(await tip.isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await tip.isVisible(), false);
      assert.equal(await indicator.evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await tip.isVisible(), true);
      await page.keyboard.press(' ');
      assert.equal(await tip.isVisible(), false);
      await page.keyboard.press('Tab');
      await indicator.focus();
      assert.equal(await tip.isVisible(), true);
      await page.keyboard.press('Tab'); await page.waitForTimeout(200);
      assert.equal(await tip.isVisible(), false, 'an unpinned explanation closes when focus leaves');

      await select(firstCopy).selectOption('Quest Minis');
      assert.match(await page.locator('#miniV2DetailHeaderTags .mini-v2-detail-tag').innerText(), /^Unsaved 1$/i);
      assert.equal(await indicator.getAttribute('aria-label'), 'Group record complete', 'completeness is independent of pending location changes');
      await indicator.click();
      await page.mouse.click(1, 1);
      assert.equal(await tip.isVisible(), false);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').textContent(), 'Zhent Soldier');
      assert.equal(await action('edit-mini').isVisible(), true, 'outside dismissal must not close the inspector');
      assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      await indicator.click(); await action('edit-mini').click();
      assert.equal(await tip.isVisible(), false);
      assert.equal(await indicator.count(), 0);
      await action('discard-edit').click();
      await indicator.click(); await lists();
      assert.equal(await tip.isVisible(), false);
      await listAction('close').click();
      await indicator.click(); await open(fighter);
      assert.equal(await tip.isVisible(), false, 'changing groups clears the prior explanation');
      await indicator.click();
      await page.locator('#miniV2DetailScroll').evaluate(node => node.dispatchEvent(new Event('scroll')));
      assert.equal(await tip.isVisible(), false);
      await indicator.click(); await page.setViewportSize({ width: 1400, height: 1000 }); await settle();
      assert.equal(await tip.isVisible(), false);
      await page.setViewportSize({ width: 1440, height: 1000 });

      const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      touch.on('pageerror', error => errors.push(error.message));
      try {
        await touch.setContent(html); await touch.waitForTimeout(550);
        await touch.locator(`tr[data-group-id="${soldier}"]`).tap(); await touch.waitForTimeout(550);
        const touchIndicator = touch.locator('[data-action="toggle-detail-status"]');
        const touchTip = touch.locator('#miniV2DetailStatusTip');
        await touchIndicator.tap();
        assert.equal(await touchTip.isVisible(), true, 'the first tap must open, not immediately dismiss');
        await touchIndicator.tap();
        assert.equal(await touchTip.isVisible(), false);
        await touchIndicator.tap(); await touch.waitForTimeout(250);
        assert.equal(await touchTip.isVisible(), true);
        await touch.locator('[data-action="close-detail"]').tap();
        assert.equal(await touchTip.isVisible(), false);
      } finally { await touch.close(); }
    });

    await check('long detail titles marquee within fixed header bounds without moving actions or widening the sidebar', async () => {
      const title = 'Human Paladin of the Oath of Vengeance (Invisible) <Silver & Gold>';
      const longTitle = JSON.parse(JSON.stringify(data));
      longTitle.groups[0].name = title;
      const geometry = () => page.locator('#miniV2DetailPanel').evaluate(panel => {
        const bounds = panel.getBoundingClientRect();
        const header = panel.querySelector('.mini-v2-detail-header').getBoundingClientRect();
        return { headerHeight: header.height, panelWidth: bounds.width, headerWidth: header.width,
          fontSize: getComputedStyle(panel.querySelector('#miniV2DetailHeaderTitle')).fontSize,
          actions: [...panel.querySelectorAll('.mini-v2-detail-header-actions button')].map(node => {
            const box = node.getBoundingClientRect();
            return { left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
          }) };
      });
      for (const width of [1440, 1100, 980, 820, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await fresh(); await open(soldier);
        if (width >= 820) assert.equal(await page.locator('#miniV2DetailHeaderTitle').evaluate(n => !!n._miniV2MarqueeAnimation), false);
        const before = await geometry();
        await fresh(makeHtml(longTitle)); await open(soldier);
        assert.deepEqual(await geometry(), before, `long title must preserve layout at ${width}`);
        const name = page.locator('#miniV2DetailHeaderTitle');
        assert.equal(await name.textContent(), title);
        assert.equal(await name.getAttribute('title'), title);
        assert.equal(await name.evaluate(n => getComputedStyle(n).textOverflow), 'clip');
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation && n.clientWidth > 0), true);
        assert.equal(await page.locator('.mini-v2-detail-header').evaluate(node => {
          const bounds = node.getBoundingClientRect();
          const title = node.querySelector('#miniV2DetailHeaderTitle').getBoundingClientRect();
          const actions = node.querySelector('.mini-v2-detail-header-actions').getBoundingClientRect();
          const tags = [...node.querySelectorAll('.mini-v2-detail-tag, .mini-v2-detail-status')].map(tag => tag.getBoundingClientRect());
          return tags.every(tag => tag.left >= title.right && tag.right <= actions.left)
            && title.right <= actions.left && actions.right <= bounds.right && node.scrollWidth <= node.clientWidth;
        }), true);
        assert.equal(await page.locator('.mini-v2-detail-stage').evaluate(n => n.scrollWidth <= n.clientWidth), true);
        const cycle = await name.evaluate(node => {
          const animation = node._miniV2MarqueeAnimation;
          const timing = animation.effect.getTiming(), frames = animation.effect.getKeyframes();
          animation.pause();
          const sample = time => {
            animation.currentTime = time;
            return new DOMMatrixReadOnly(getComputedStyle(node.querySelector('.mini-v2-marquee-text')).transform).m41;
          };
          return { startPause: frames[1].offset * timing.duration, endPause: (1 - frames[2].offset) * timing.duration,
            direction: timing.direction, atStart: sample(1000), atEnd: sample(timing.duration - 1000),
            atReset: sample(timing.duration + 1000) };
        });
        assert.ok(Math.abs(cycle.startPause - 2000) < 1 && Math.abs(cycle.endPause - 2000) < 1);
        assert.equal(cycle.direction, 'normal');
        assert.ok(Math.abs(cycle.atStart) < 1 && cycle.atEnd < 0 && Math.abs(cycle.atReset) < 1);
        assert.deepEqual(await geometry(), before);
        if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width)) await page.locator('#miniV2DetailPanel').screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-title-marquee-${width}.png`)
        });
        await action('edit-mini').click();
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation), false);
        assert.equal(await page.locator('#miniV2EditName').inputValue(), title);
        await action('discard-edit').click(); await settle();
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation), true);
        await page.emulateMedia({ reducedMotion: 'reduce' }); await settle();
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation), false);
        assert.deepEqual(await geometry(), before);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await action('close-detail').click();
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation), false);
        await open(soldier); await settle();
        assert.equal(await name.evaluate(n => !!n._miniV2MarqueeAnimation), true);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await settle();
      const resized = await page.locator('#miniV2DetailHeaderTitle').evaluate(node => ({
        overflow: Math.ceil(node.querySelector('.mini-v2-marquee-text').scrollWidth - node.clientWidth),
        end: node._miniV2MarqueeAnimation.effect.getKeyframes().at(-1).transform
      }));
      assert.equal(resized.end, `translateX(${-resized.overflow}px)`);
    });

    await check('long individual and group notes use slow pause-scroll-pause-reset without altering layout', async () => {
      const longNotes = JSON.parse(JSON.stringify(data));
      const note = 'Purple and green variant <not markup>; blue cloak and silver trim. '.repeat(15);
      const notes = 'Painting and collection notes <keep as text>.\n'.repeat(24);
      longNotes.groups[0].copies[0].note = note;
      longNotes.groups[0].copies[1].note = 'Blue cloak';
      longNotes.groups[0].notes = notes;
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await fresh();
        await open(soldier);
        const geometry = () => page.locator('#miniV2DetailContent').evaluate(panel => ({
          rows: [...panel.querySelectorAll('.mini-v2-copy-row')].map(n => n.getBoundingClientRect().height),
          noteHeight: panel.querySelector('.mini-v2-note-body').getBoundingClientRect().height,
          noteMargin: getComputedStyle(panel.querySelector('.mini-v2-note-body')).marginTop
        }));
        const before = await geometry();
        await fresh(makeHtml(longNotes));
        await page.locator(`tr[data-group-id="${soldier}"]`).click();
        assert.deepEqual(await geometry(), before);
        await settle();
        assert.deepEqual(await geometry(), before);
        const values = page.locator('.mini-v2-copy-note-value');
        assert.equal(await values.first().locator('.mini-v2-marquee-text').textContent(), note);
        assert.equal(await page.locator('.mini-v2-note-body .mini-v2-marquee-text').textContent(), notes);
        assert.equal(await page.locator('.mini-v2-note-body').getAttribute('title'), notes);
        assert.equal(await page.locator('.mini-v2-copy-note-cell').first().getAttribute('title'), note);
        assert.equal(await values.first().evaluate(n => !!n._miniV2MarqueeAnimation), true);
        assert.equal(await values.nth(1).evaluate(n => !!n._miniV2MarqueeAnimation), false);
        assert.equal(await values.first().evaluate(n => {
          const cell = getComputedStyle(n.closest('td'));
          const value = getComputedStyle(n);
          return cell.fontSize === value.fontSize && cell.fontWeight === value.fontWeight
            && cell.lineHeight === value.lineHeight && value.marginTop === '0px';
        }), true);
        const cycle = await values.first().evaluate(node => {
          const animation = node._miniV2MarqueeAnimation;
          const timing = animation.effect.getTiming();
          const frames = animation.effect.getKeyframes();
          const overflow = Math.ceil(node.querySelector('.mini-v2-marquee-text').scrollWidth - node.clientWidth);
          animation.pause();
          const sample = time => {
            animation.currentTime = time;
            return new DOMMatrixReadOnly(getComputedStyle(node.querySelector('.mini-v2-marquee-text')).transform).m41;
          };
          return { duration: timing.duration, iterations: timing.iterations === Infinity, easing: timing.easing,
            direction: timing.direction, overflow, startPause: frames[1].offset * timing.duration,
            endPause: (1 - frames[2].offset) * timing.duration,
            start: sample(1000), middle: sample(timing.duration / 2),
            end: sample(timing.duration - 1000), reset: sample(timing.duration + 1000) };
        });
        assert.equal(cycle.iterations, true);
        assert.equal(cycle.easing, 'linear');
        assert.equal(cycle.direction, 'normal');
        assert.ok(Math.abs(cycle.startPause - 2000) < 1 && Math.abs(cycle.endPause - 2000) < 1);
        assert.ok(Math.abs((cycle.duration - 4000) / 1000 - Math.max(4, cycle.overflow / 22)) < 0.01);
        assert.ok(cycle.duration > 14000, 'long notes must not speed up to meet a ten-second travel cap');
        assert.ok(Math.abs(cycle.start) < 1 && Math.abs(cycle.reset) < 1);
        assert.ok(Math.abs(cycle.middle + cycle.overflow / 2) < 1);
        assert.ok(Math.abs(cycle.end + cycle.overflow) < 1);
        assert.deepEqual(await geometry(), before);
        if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2DetailPanel').screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-note-marquees-${width}.png`)
        });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await settle();
        assert.equal(await page.locator('.mini-v2-marquee-value').evaluateAll(nodes => nodes.every(n => !n._miniV2MarqueeAnimation)), true);
        assert.deepEqual(await geometry(), before);
        await action('edit-mini').click();
        assert.equal(await page.locator('.mini-v2-editor .mini-v2-marquee-value').count(), 0);
        assert.equal(await page.locator('[data-edit-copy-note="013-ZHESOL-01"]').inputValue(), note);
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), notes);
        await page.locator('[data-edit-copy-note="013-ZHESOL-01"]').fill('Short note');
        await action('save-edit').click();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await settle();
        assert.equal(await values.first().evaluate(n => !!n._miniV2MarqueeAnimation), false);
        assert.equal(await page.locator('.mini-v2-note-body').evaluate(n => !!n._miniV2MarqueeAnimation), true);
        assert.deepEqual(await geometry(), before);
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('an empty new-group draft reopens in creation mode and actually publishes after recovery', async () => {
      await fresh();
      await action('new-group').click();
      const rootId = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await page.locator('[data-remove-copy]').click();
      assert.equal(await action('save-edit').isDisabled(), true);
      await action('close-detail').click();
      await action('new-group').click();
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), rootId);
      assert.equal(await action('save-edit').innerText(), 'Create Group');
      assert.equal(await action('save-edit').isDisabled(), true);
      await action('close-detail').click();
      await open(soldier);
      await review('review-editor-drafts');
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), rootId);
      await page.locator('#miniV2EditName').fill('Recovered empty draft');
      await fillNewDetails();
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await action('add-copy').click();
      await action('save-edit').click();
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), data.groups.length + 1);
      assert.equal(await page.locator(`tr[data-group-id="${rootId}"]`).count(), 1);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Recovered empty draft');
      await action('new-group').click();
      await page.locator('[data-remove-copy]').click();
      await action('close-detail').click();
      await action('new-group').click();
      const discarded = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await action('discard-edit').click();
      await action('new-group').click();
      assert.notEqual(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), discarded);
    });

    await check('existing sticker blanks accept Apply in table order, retain drafts and update search only on Save', async () => {
      await fresh();
      const drow = data.groups.find(group => group.rootId === '121-DRORAN');
      const sticker = id => page.locator(`[data-edit-copy-sticker="${id}"]`);
      await open(drow.rootId);
      await action('edit-mini').click();
      const inputs = page.locator('.mini-v2-editor-sticker');
      assert.equal(await inputs.count(), 2);
      assert.equal(await page.locator('.mini-v2-editor-sticker[data-new-copy="true"]').count(), 0);
      await action('apply-next-sticker').click();
      await action('apply-next-sticker').click();
      assert.deepEqual(await inputs.evaluateAll(nodes => nodes.map(n => n.value)), ['M08', 'M09']);
      assert.equal(await page.locator('.mini-v2-copy-table tbody tr').count(), 2);
      await action('close-detail').click();
      await page.locator('#miniV2SearchInput').fill('M08');
      assert.equal(await page.locator(`tr[data-group-id="${drow.rootId}"]`).count(), 0);
      await page.locator('#miniV2SearchInput').fill('');
      await open(drow.rootId);
      assert.equal(await sticker(drow.copies[0].id).inputValue(), 'M08');
      await action('discard-edit').click();
      await action('edit-mini').click();
      assert.deepEqual(await inputs.evaluateAll(nodes => nodes.map(n => n.value)), ['', '']);
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
      await action('apply-next-sticker').click();
      await action('apply-next-sticker').click();
      await action('save-edit').click();
      await page.locator('#miniV2SearchInput').fill('m08');
      assert.equal(await page.locator(`tr[data-group-id="${drow.rootId}"]`).count(), 1);
      assert.deepEqual(await page.locator('[data-detail-copy-id]').evaluateAll(rows => rows.map(row => row.dataset.detailCopyId)), Array.from(drow.copies, copy => copy.id));
      assert.match(await page.locator('.mini-v2-summary-desktop [data-collection-view="missing"]').innerText(), /0/);
    });

    await check('existing sticker validation catches unchanged siblings and other groups but allows swaps and n/a', async () => {
      await fresh();
      const ids = data.groups.find(group => group.rootId === soldier).copies.map(copy => copy.id);
      const sticker = id => page.locator(`[data-edit-copy-sticker="${id}"]`);
      await open(soldier);
      await action('edit-mini').click();
      await sticker(ids[0]).fill('a55');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      assert.equal(await sticker(ids[0]).getAttribute('aria-invalid'), 'true');
      await sticker(ids[0]).fill('a97');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      await sticker(ids[0]).fill('A55');
      await sticker(ids[1]).fill('A12');
      await action('save-edit').click();
      assert.equal(await page.locator(`[data-detail-copy-id="${ids[0]}"] td`).first().innerText(), 'A55');
      assert.equal(await page.locator(`[data-detail-copy-id="${ids[1]}"] td`).first().innerText(), 'A12');
      await action('edit-mini').click();
      await sticker(ids[0]).fill('n/a');
      await sticker(ids[1]).fill('N/A');
      await sticker(ids[2]).fill('');
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true);
      assert.match(await page.locator('.mini-v2-summary-desktop [data-collection-view="missing"]').innerText(), /3/);
      const legacy = JSON.parse(JSON.stringify(data));
      legacy.groups[0].copies[1].sticker = legacy.groups[0].copies[0].sticker;
      await fresh(makeHtml(legacy));
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="notes"]').fill('Unrelated legacy edit');
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true, 'untouched legacy duplicates must not block unrelated corrections');
    });

    await check('deletion releases saved and draft stickers; Undo waits for reused assignments to be released', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).fill('G90');
      await action('close-detail').click();
      await open(fighter);
      await action('edit-mini').click();
      const fighterSticker = page.locator('.mini-v2-editor-sticker').first();
      for (const code of ['G90', 'A12']) {
        await fighterSticker.fill(code);
        await action('save-edit').click();
        assert.match(await page.locator('#miniV2EditorError').innerText(), /already assigned/);
      }
      await action('discard-edit').click();
      await open(soldier);
      await action('delete-group').click();
      await action('confirm-delete-group').click();
      await open(fighter);
      await action('edit-mini').click();
      const secondSticker = page.locator('.mini-v2-editor-sticker').nth(1);
      await fighterSticker.fill('g90');
      await secondSticker.fill('a12');
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true, 'deleted baseline and draft stickers can both be reused');
      await review('undo-delete-group');
      assert.match(await page.locator('#miniV2ChangesMenu [role="status"]').innerText(), /A12, G90/);
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"]`).count(), 0);
      await page.keyboard.press('Escape');
      await action('edit-mini').click();
      for (const code of ['G90', 'A12']) {
        assert.ok(await page.locator('.mini-v2-editor-sticker').evaluateAll((nodes, value) =>
          nodes.some(node => node.value.toUpperCase() === value), code));
      }
      await fighterSticker.fill('C10');
      await secondSticker.fill('C11');
      await action('save-edit').click();
      await review('undo-delete-group');
      assert.equal(await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).inputValue(), 'G90');
      await action('save-edit').click();
      await open(fighter);
      await action('edit-mini').click();
      await fighterSticker.fill('A12');
      await action('save-edit').click();
      assert.equal(await action('edit-mini').isVisible(), true, 'the old ID is released only after the correction is saved');
    });

    await check('discarding or removing a sequence edit cannot strand the next-ID action at Z99', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).fill('Z99');
      assert.equal(await action('apply-next-sticker').isDisabled(), true);
      await action('discard-edit').click();
      await action('new-group').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
      const added = page.locator('.mini-v2-editor-sticker[data-new-copy="true"]');
      await added.fill('Z99');
      await page.locator('[data-remove-copy]').click();
      await action('add-copy').click();
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
      await added.fill('Z99');
      await added.fill('');
      assert.equal(await action('apply-next-sticker').innerText(), 'Apply M08');
      await action('apply-next-sticker').click();
      assert.equal(await added.inputValue(), 'M08');
    });

    await check('saving unrelated metadata cannot persist a parked draft sequence preference', async () => {
      const storagePage = await browser.newPage();
      storagePage.on('pageerror', error => errors.push(error.message));
      const key = 'ppq-miniature-tracker:mock:next-sticker:v1';
      const act = name => settledAction(storagePage, storagePage.locator(`[data-action="${name}"]`));
      try {
        await storagePage.route('https://ppq-draft-sequence.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
        await storagePage.goto('https://ppq-draft-sequence.test/');
        await act('new-group').click();
        await storagePage.locator('.mini-v2-editor-sticker').fill('Z99');
        await act('close-detail').click();
        await storagePage.locator(`tr[data-group-id="${soldier}"]`).click();
        await act('edit-mini').click();
        await storagePage.locator('[data-edit-field="notes"]').fill('Unrelated saved change');
        await act('save-edit').click();
        assert.equal(await storagePage.evaluate(key => localStorage.getItem(key), key), 'M08');
        await act('new-group').click();
        await act('discard-edit').click();
        await storagePage.reload();
        await act('new-group').click();
        assert.equal(await act('apply-next-sticker').innerText(), 'Apply M08');
      } finally {
        await storagePage.close();
      }
    });

    await check('Set numbers accept suffixes and n/a disables stale numbers without losing an uncommitted selection', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      const set = page.locator('[data-edit-field="set"]');
      const number = page.locator('[data-edit-field="setNumber"]');
      await number.fill('4a');
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-set-field').innerText(), /Lords of Madness \(4a\)/);
      await action('edit-mini').click();
      await number.fill('5b');
      await set.selectOption('n/a');
      assert.equal(await number.isDisabled(), true);
      assert.equal(await number.inputValue(), '');
      await set.selectOption('Lords of Madness');
      assert.equal(await number.isDisabled(), false);
      assert.equal(await number.inputValue(), '5b');
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-set-field').innerText(), /\(5b\)/);
      await action('edit-mini').click();
      await set.selectOption('n/a');
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-set-field').innerText(), /n\/a/);
      assert.doesNotMatch(await page.locator('.mini-v2-set-field').innerText(), /5b/);
      await action('edit-mini').click();
      await set.selectOption('Lords of Madness');
      assert.equal(await number.inputValue(), '');
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('Variant number');
      await fillNewDetails({ set: 'Lords of Madness' });
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await number.fill('4a');
      assert.equal(await action('save-edit').isDisabled(), false);
      await action('save-edit').click();
      assert.match(await page.locator('.mini-v2-set-field').innerText(), /\(4a\)/);
    });

    await check('valid paint cannot be cleared and optional Notes never lower readiness', async () => {
      await fresh();
      await open(soldier);
      await action('edit-mini').click();
      await page.locator('[data-edit-field="paint"]').selectOption('');
      await action('save-edit').click();
      assert.match(await page.locator('#miniV2EditorError').innerText(), /Choose Paint/);
      await action('discard-edit').click();
      await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-field="paint"]').inputValue(), 'Painted');
      await page.locator('[data-edit-field="notes"]').fill('');
      await action('save-edit').click();
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
      await action('new-group').click();
      await page.locator('#miniV2EditName').fill('No optional notes');
      await fillNewDetails();
      await page.locator('[data-edit-field="home"]').selectOption('Spare People');
      await page.locator('.mini-v2-editor-sticker').fill('n/a');
      await action('save-edit').click();
      assert.equal(await action('toggle-detail-status').getAttribute('aria-label'), 'Group record complete');
    });

    await check('small-screen selections and draft recovery reveal the inspector without scrolling during editing', async () => {
      const large = JSON.parse(JSON.stringify(data));
      const base = large.groups[0];
      large.groups = Array.from({ length: 100 }, (_, i) => ({ ...base, rootId: `mobile-${i}`, name: `Miniature ${i}`,
        copies: base.copies.map((copy, j) => ({ ...copy, id: `mobile-${i}-${j}` })) }));
      for (const width of [390, 820]) {
        await page.setViewportSize({ width, height: 844 });
        await fresh(makeHtml(large));
        await open('mobile-0');
        const assertHeaderVisible = async () => {
          const box = await page.locator('.mini-v2-detail-header').boundingBox();
          assert.ok(box.y >= -1 && box.y + box.height < 844, `inspector header must be visible at ${width}px, not y=${box.y}`);
        };
        await assertHeaderVisible();
        if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-mobile-reveal-${width}.png`) });
        await action('edit-mini').click();
        await page.locator('[data-edit-field="notes"]').fill('Retain mobile draft');
        const bodyTop = await page.evaluate(() => document.body.scrollTop);
        await page.locator('[data-edit-field="notes"]').press('End');
        await page.keyboard.type('!');
        await settle();
        assert.equal(await page.evaluate(() => document.body.scrollTop), bodyTop);
        await action('close-detail').click();
        await review('review-editor-drafts');
        await settle();
        await assertHeaderVisible();
        assert.equal(await page.locator('[data-edit-field="notes"]').inputValue(), 'Retain mobile draft!');
        await action('new-group').click();
        await settle();
        await assertHeaderVisible();
        assert.equal(await action('save-edit').innerText(), 'Create Group');
        await action('new-group').click();
        await settle();
        await assertHeaderVisible();
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    const pendingReview = () => review('review-pending');
    const reviewCollection = view => page.locator(`.mini-v2-summary-desktop [data-collection-view="${view}"]`).click();
    const pendingRows = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(rows => [...new Set(rows.map(row => row.dataset.groupId))]);

    await check('pending review restores ordinary filters, individual selection, sorting and fixed header geometry', async () => {
      await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
      await open(fighter); await action('edit-mini').click();
      await page.locator('#miniV2EditName').fill('Edited Spirit Folk');
      await action('close-detail').click();
      await mode('individuals');
      await page.locator('#miniV2SearchInput').fill('Zhent');
      await page.locator('[data-facet-key="sexes"]').click();
      await page.locator('[data-facet-kind="sexes"][data-facet-value="Male"]').click();
      await page.keyboard.press('Escape');
      await page.locator('[data-sort-key="sticker"]').click();
      await page.locator(`tr[data-copy-id="${firstCopy}"]`).click(); await settle();
      const geometry = () => page.evaluate(() => ['.mini-v2-top-card', '.mini-v2-list-header', '.mini-v2-search-row', '.mini-v2-facet-shell']
        .map(selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { height: box.height, top: box.top }; }));
      const before = await geometry();
      await pendingReview(); await settle();
      assert.deepEqual(await pendingRows(), [soldier, fighter]);
      assert.match(await page.locator('#miniV2BrowseTitle').innerText(), /Pending/);
      assert.equal(await page.locator('[data-browse-mode="groups"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), '');
      assert.equal(await action('clear-filters').innerText(), 'Back');
      assert.equal(await page.locator(`tr[data-group-id="${fighter}"] .mini-v2-name`).innerText(), 'Edited Spirit Folk');
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-count`).innerText(), '2/3');
      assert.deepEqual(await geometry(), before);
      await action('clear-filters').click(); await settle();
      assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'Zhent');
      assert.equal(await page.locator('[data-browse-mode="individuals"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.mini-v2-browse-table tr[aria-current="true"]').getAttribute('data-copy-id'), firstCopy);
      assert.equal(await page.locator('[data-facet-key="sexes"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('th:has([data-sort-key="sticker"])').getAttribute('aria-sort'), 'ascending');
      assert.deepEqual(await geometry(), before);
      await pendingReview(); assert.equal((await pendingRows()).length, 2, 'leaving review must not discard drafts');
    });

    await check('pending review restores a scrolled collection without resurrecting a deleted selection', async () => {
      const large = JSON.parse(JSON.stringify(data));
      const base = large.groups[0];
      large.groups = Array.from({ length: 100 }, (_, i) => ({ ...base, rootId: `pending-${i}`, name: `Miniature ${i}`,
        copies: [{ ...base.copies[0], id: `pending-${i}-copy`, sticker: 'n/a' }] }));
      await fresh(makeHtml(large)); await open('pending-40');
      await select('pending-40-copy').selectOption('Quest Minis');
      await page.locator('#miniV2TableScroll').evaluate(node => { node.scrollTop = 700; });
      await settle();
      const scroll = await page.locator('#miniV2TableScroll').evaluate(node => node.scrollTop);
      assert.ok(scroll > 0);
      await pendingReview(); await action('clear-filters').click(); await settle();
      assert.equal(await page.locator('#miniV2TableScroll').evaluate(node => node.scrollTop), scroll);
      assert.equal(await page.locator('.mini-v2-browse-table tr[aria-current="true"]').getAttribute('data-group-id'), 'pending-40');
      await pendingReview(); await action('edit-mini').click();
      await action('delete-group').click(); await action('confirm-delete-group').click();
      await action('clear-filters').click(); await settle();
      assert.equal(await page.locator('#miniV2TableScroll').evaluate(node => node.scrollTop), scroll);
      assert.equal(await page.locator('#miniV2DetailEmpty').isVisible(), true);
      assert.equal(await page.locator('tr[data-group-id="pending-40"]').count(), 0);
    });

    await check('pending review restores draft-copy selection rather than the last copy inspected during review', async () => {
      await fresh(); await mode('individuals');
      await page.locator(`tr[data-copy-id="${firstCopy}"]`).click(); await settle();
      await action('edit-mini').click(); await action('add-copy').click();
      const added = await page.locator('[data-edit-copy-sticker][data-new-copy="true"]').getAttribute('data-edit-copy-sticker');
      await page.locator(`[data-detail-copy-id="${added}"] td`).nth(1).click();
      assert.equal(await page.locator('.mini-v2-copy-table tr[aria-current="true"]').getAttribute('data-detail-copy-id'), added);
      await pendingReview(); await mode('individuals');
      await page.locator(`tr[data-copy-id="${firstCopy}"]`).click();
      await action('clear-filters').click();
      assert.equal(await page.locator('.mini-v2-copy-table tr[aria-current="true"]').getAttribute('data-detail-copy-id'), added);
      assert.equal(await page.locator('[data-browse-mode="individuals"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`[data-edit-copy-sticker="${added}"]`).count(), 1, 'Back keeps the newly added copy draft');
    });

    await check('pending review returns through Away and Missing Stickers to their original browse context', async () => {
      for (const view of ['away', 'missing']) {
        await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
        await action('close-detail').click();
        await page.locator('#miniV2SearchInput').fill('Warhorse');
        await reviewCollection(view);
        const search = view === 'away' ? 'Crow' : 'Drow';
        await page.locator('#miniV2SearchInput').fill(search);
        const oldRows = await browseCopies();
        await pendingReview(); assert.deepEqual(await pendingRows(), [soldier]);
        await action('clear-filters').click();
        assert.equal(await page.locator('#miniV2SearchInput').inputValue(), search);
        assert.equal(await action('clear-filters').innerText(), 'Back');
        assert.deepEqual(await browseCopies(), oldRows);
        await action('clear-filters').click();
        assert.equal(await page.locator('#miniV2SearchInput').inputValue(), 'Warhorse');
        assert.equal(await action('clear-filters').innerText(), 'Clear');
        assert.equal(await page.locator('[data-browse-mode="groups"]').getAttribute('aria-pressed'), 'true');
      }
    });

    await check('pending review includes invalid zero-copy new drafts and Review exposes the issue without partial saves', async () => {
      await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
      await action('new-group').click();
      const id = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await page.locator('[data-remove-copy]').click();
      await pendingReview();
      assert.deepEqual(await pendingRows(), [soldier, id]);
      assert.match(await page.locator(`tr[data-group-id="${id}"] .mini-v2-name`).innerText(), /New.*Untitled miniature/s);
      await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await action('save-all-pending').isDisabled(), true);
      assert.match(await action('review-pending-issue').innerText(), /1 group needs attention/);
      await action('review-pending-issue').click();
      assert.equal(await page.locator('[data-editor-root]').getAttribute('data-editor-root'), id);
      assert.match(await page.locator('#miniV2EditorError').innerText(), /name/);
      await page.locator('#miniV2EditName').fill('New no-copy draft');
      await mode('individuals');
      assert.ok((await pendingRows()).includes(id), 'a zero-copy draft must remain discoverable even in Individuals');
      await page.locator('[data-sort-key="sticker"]').click();
      assert.match(await page.locator(`tr[data-group-id="${id}"] .mini-v2-individual-id`).innerText(), /No copies/);
      await action('clear-filters').click();
      assert.equal(await page.locator(`tr[data-group-id="${soldier}"] .mini-v2-count`).innerText(), '3/3', 'invalid batch must not apply even a valid location change');
      await pendingReview();
      await action('discard-edit').click();
      assert.deepEqual(await pendingRows(), [soldier]);
    });

    await check('pending Save All applies hidden groups, active and parked drafts and new copies, but not unfinished lists', async () => {
      await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
      await action('edit-mini').click(); await page.locator('[data-edit-field="notes"]').fill('Saved soldier draft');
      await open(fighter); await action('edit-mini').click(); await page.locator('[data-edit-field="notes"]').fill('Saved fighter draft');
      await action('new-group').click(); await page.locator('#miniV2EditName').fill('New batch miniature');
      const newId = await page.locator('[data-editor-root]').getAttribute('data-editor-root');
      await fillNewDetails(); await page.locator('#miniV2EditHome').selectOption('Spare People');
      await page.locator('[data-edit-copy-sticker]').fill('A03');
      await action('add-copy').click();
      await lists(); await listCategory('set'); await listAction('add').click();
      await page.locator('#miniV2ListName').fill('Unfinished Set draft'); await listAction('close').click();
      await pendingReview();
      assert.deepEqual(await pendingRows(), [soldier, fighter, newId]);
      await page.locator('#miniV2SearchInput').fill('Zhent');
      assert.deepEqual(await pendingRows(), [soldier]);
      await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await page.locator('.mini-v2-pending-scope').innerText(), '3 groups total / 1 shown');
      assert.equal(await action('save-all-pending').isDisabled(), false);
      await action('save-all-pending').click();
      assert.match(await page.locator('.mini-v2-empty').innerText(), /All changes saved/);
      assert.equal(await page.locator('.mini-v2-pending-scope').innerText(), 'No pending edits.');
      assert.equal(await page.locator('#miniV2ChangesMenu p').count(), 2, 'only the heading and one status line remain');
      assert.doesNotMatch(await page.locator('#miniV2ChangesMenu').innerText(), /Applied changes|reset on reload|Preview only|Demo only/);
      if (process.env.SCREENSHOT_PATH) await page.locator('#miniV2ChangesMenu').screenshot({
        path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-changes-empty.png')
      });
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'New batch miniature');
      assert.equal(await action('save-all-pending').isDisabled(), true);
      await page.keyboard.press('Escape'); await action('clear-filters').click();
      await page.locator('#miniV2SearchInput').fill('');
      assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), data.groups.length + 1);
      await open(soldier); assert.equal(await select(firstCopy).inputValue(), 'Quest Minis');
      assert.match(await page.locator('.mini-v2-note-body').innerText(), /Saved soldier draft/);
      await open(fighter); assert.match(await page.locator('.mini-v2-note-body').innerText(), /Saved fighter draft/);
      await open(newId); assert.equal(await page.locator('[data-detail-copy-id]').count(), 2);
      await lists(); assert.equal(await page.locator('#miniV2ListName').inputValue(), 'Unfinished Set draft');
      assert.equal(await listRow('Unfinished Set draft').count(), 0);
      await listAction('cancel').click(); await listAction('close').click();
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
      }), false);
      await fresh(); assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), data.groups.length);
      await open(soldier); assert.equal(await select(firstCopy).inputValue(), 'Spare People', 'preview batch must not survive a reload');
    });

    await check('pending review distinguishes filtered-out results from completion and retains inspection after per-group saves', async () => {
      await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
      await open(fighter); await select('048-SPIFOLFIG-01').selectOption('Quest Minis');
      await pendingReview();
      await page.locator('#miniV2SearchInput').fill('No match at all');
      assert.match(await page.locator('.mini-v2-empty').innerText(), /No pending changes match/);
      await page.locator('.mini-v2-empty [data-action="review-pending"]').click();
      assert.deepEqual(await pendingRows(), [soldier, fighter]);
      await open(soldier); await action('save-changes').click();
      assert.deepEqual(await pendingRows(), [fighter]);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      assert.match(await page.locator('.mini-v2-editor-scope').innerText(), /no pending changes/);
      await open(fighter); await action('save-changes').click();
      assert.match(await page.locator('.mini-v2-empty').innerText(), /All changes saved/);
      assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Spirit Folk Fighter');
      assert.equal(await action('clear-filters').innerText(), 'Back');
    });

    await check('pending Save All rejects cross-group duplicates but validates a sticker swap against the final collection', async () => {
      const crow = '093-CROCAP';
      await fresh(); await open(soldier); await action('edit-mini').click();
      await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).fill('D25');
      await open(crow); await action('edit-mini').click();
      await page.locator('[data-edit-copy-sticker="093-CROCAP-01"]').fill('A12');
      await pendingReview(); await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await action('save-all-pending').isDisabled(), true);
      assert.match(await action('review-pending-issue').innerText(), /2 groups need attention/);
      await page.keyboard.press('Escape'); await open(soldier);
      await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).fill('d24');
      await page.locator('[data-summary-panel="changes"]').click();
      assert.equal(await action('save-all-pending').isDisabled(), false);
      await action('save-all-pending').click(); await page.keyboard.press('Escape');
      await action('clear-filters').click(); await open(soldier); await action('edit-mini').click();
      assert.equal(await page.locator(`[data-edit-copy-sticker="${firstCopy}"]`).inputValue(), 'd24');
      await open(crow); await action('edit-mini').click();
      assert.equal(await page.locator('[data-edit-copy-sticker="093-CROCAP-01"]').inputValue(), 'A12');
    });

    await check('pending review retains renamed filters throughout nested returns and ignores a discarded return selection', async () => {
      await fresh(); await open(soldier); await select(firstCopy).selectOption('Quest Minis');
      await page.locator('[data-facet-key="more"]').click();
      await page.locator('[data-filter-set]').selectOption('Lords of Madness'); await page.keyboard.press('Escape');
      await reviewCollection('away'); await pendingReview();
      await lists(); await listCategory('set');
      await listRow('Lords of Madness').locator('[data-list-action="rename"]').click();
      await page.locator('#miniV2ListName').fill('Renamed collection'); await listAction('save').click(); await listAction('close').click();
      await action('clear-filters').click(); await action('clear-filters').click();
      await page.locator('[data-facet-key="more"]').click();
      assert.equal(await page.locator('[data-filter-set]').inputValue(), 'Renamed collection'); await page.keyboard.press('Escape');
      await action('new-group').click(); await page.locator('#miniV2EditName').fill('Discard this draft');
      await pendingReview(); await action('discard-edit').click();
      await action('clear-filters').click();
      assert.equal(await page.locator('#miniV2DetailEmpty').isVisible(), true);
      assert.equal(await page.locator('.mini-v2-editor').count(), 0);
    });

    await check('pending review stays within desktop and phone layouts with unchanged headers and accessible actions', async () => {
      for (const width of [1440, 1000, 820, 390, 320]) {
        await page.setViewportSize({ width, height: 900 }); await fresh();
        assert.equal(await page.locator('#miniV2BrowseBack').isVisible(), false);
        await open(soldier); await select(firstCopy).selectOption('Quest Minis');
        const height = await page.locator('.mini-v2-list-header').evaluate(node => node.getBoundingClientRect().height);
        await pendingReview(); await settle();
        if (process.env.SCREENSHOT_PATH && width === 1000) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-pending-narrow-sidebar.png')
        });
        assert.equal(await page.locator('.mini-v2-list-header').evaluate(node => node.getBoundingClientRect().height), height);
        assert.ok(await page.evaluate(() => document.body.scrollWidth <= innerWidth));
        assert.equal(await page.locator('.mini-v2-list-header').evaluate(node => [...node.querySelectorAll('button')].every(button => {
          const box = button.getBoundingClientRect(), parent = node.getBoundingClientRect();
          return box.left >= parent.left && box.right <= parent.right;
        })), true, `header buttons must fit at ${width}px`);
        assert.ok(await page.locator('#miniV2BrowseTitle').evaluate(node => node.scrollWidth <= node.clientWidth), 'pending title must not truncate');
        const back = page.getByRole('button', { name: 'Back to previous browse view', exact: true });
        assert.equal(await back.isVisible(), true);
        const controlEdges = await page.locator('.mini-v2-list-header').evaluate(node =>
          ['.mini-v2-browse-back', '.mini-v2-view-switch', '.mini-v2-new-button'].map(selector => {
            const box = node.querySelector(selector).getBoundingClientRect();
            return { top: box.top, bottom: box.bottom };
          }));
        assert.ok(controlEdges.every(box => Math.abs(box.top - controlEdges[0].top) < 0.5
          && Math.abs(box.bottom - controlEdges[0].bottom) < 0.5), `header controls must align vertically at ${width}px: ${JSON.stringify(controlEdges)}`);
        await page.locator('[data-summary-panel="changes"]').focus(); await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'review-pending');
        const menu = page.locator('#miniV2ChangesMenu');
        const box = await menu.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width);
        assert.ok(await menu.evaluate(node => node.scrollWidth <= node.clientWidth));
        await page.mouse.move(0, 0);
        assert.equal(await menu.locator('.mini-v2-review-pending').evaluate(node => {
          const style = getComputedStyle(node);
          return style.borderTopStyle === 'solid' && style.borderTopColor !== 'rgba(0, 0, 0, 0)'
            && Number(style.fontWeight) >= 600 && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
        }), true, 'review must look like a button without hover');
        if (process.env.SCREENSHOT_PATH && [1440, 390].includes(width)) await page.screenshot({
          path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-pending-${width}.png`)
        });
        await page.keyboard.press('Escape'); assert.equal(await menu.isVisible(), false);
        await back.focus(); await page.keyboard.press('Enter');
        assert.match(await page.locator('#miniV2BrowseTitle').innerText(), /Browse/);
        assert.equal(await page.locator('#miniV2BrowseBack').isVisible(), false);
        assert.equal(await page.locator('#miniV2DetailHeaderTitle').innerText(), 'Zhent Soldier');
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });

    await check('marquee honors reduced motion without changing card height', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const longSet = JSON.parse(JSON.stringify(data));
      longSet.groups.find(group => group.rootId === fighter).set = 'Lords of Madness - Collector Edition with an unusually long set name';
      await fresh(makeHtml(longSet));
      await open(fighter);
      const card = page.locator('.mini-v2-set-field');
      const height = await card.evaluate(n => n.clientHeight);
      assert.ok(await page.evaluate(() => document.getAnimations().some(a => a.effect.target.classList.contains('mini-v2-marquee-text'))));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settle();
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect.target.classList.contains('mini-v2-marquee-text')).length), 0);
      assert.equal(await card.evaluate(n => n.clientHeight), height);
    });
    assert.ok(checksRun > 0, 'TEST_FILTER must match at least one scenario');
    assert.deepEqual(errors, []);
    console.log('PASS no browser script errors');
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
