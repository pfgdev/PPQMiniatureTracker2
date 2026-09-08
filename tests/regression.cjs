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
  server.buildMockAppState_ = () => data;
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
    const action = name => page.locator(`[data-action="${name}"]`);
    const tableWidth = () => page.locator('.mini-v2-browse-table').evaluate(node => node.getBoundingClientRect().width);
    const check = async (name, test) => { await test(); console.log(`PASS ${name}`); };

    await check('view selector is visual-only and preserves the original header height', async () => {
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
            const labelsFit = [...control.querySelectorAll('button')].every(n => n.scrollWidth <= n.clientWidth);
            control.style.display = 'none';
            note.hidden = false;
            const originalHeight = header.getBoundingClientRect().height;
            control.style.display = '';
            note.hidden = true;
            return { height, originalHeight, labelsFit, titleGap, inside: controlRect.right <= headerRect.right && controlRect.left >= headerRect.left };
          });
          assert.equal(measurements.height, measurements.originalHeight, `header height at ${width}, open=${detailOpen}`);
          assert.ok(measurements.inside && measurements.labelsFit);
          assert.ok(Math.abs(measurements.titleGap - 16) < 1, `title gap at ${width}, open=${detailOpen}`);
          const table = await page.locator('.mini-v2-browse-table').innerHTML();
          const detail = await page.locator('#miniV2DetailContent').innerHTML();
          const toggle = page.locator('[data-view-preview="individuals"]');
          const before = await page.locator('.mini-v2-view-switch').boundingBox();
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.mini-v2-browse-table').innerHTML(), table);
          assert.equal(await page.locator('#miniV2DetailContent').innerHTML(), detail);
          const after = await page.locator('.mini-v2-view-switch').boundingBox();
          if (JSON.stringify(after) !== JSON.stringify(before) && process.env.SCREENSHOT_PATH) {
            await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, '-selector-failure.png') });
          }
          assert.deepEqual(after, before, `selector bounds at ${width}, open=${detailOpen}`);
          assert.equal(await page.locator('#miniV2Root').evaluate(n => n.classList.contains('mini-v2-has-detail')), detailOpen);
          await page.locator('[data-view-preview="groups"]').focus();
          await page.keyboard.press('Space');
          assert.equal(await page.locator('[data-view-preview="groups"]').getAttribute('aria-pressed'), 'true');
        }
        if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH.replace(/\.png$/, `-selector-${width}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
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
      await action('review-changes').click();
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
        await action('review-changes').click();
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
    });

    await check('marquee honors reduced motion without changing card height', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await fresh();
      await open(fighter);
      const card = page.locator('.mini-v2-read-card').last();
      const height = await card.evaluate(n => n.clientHeight);
      assert.ok(await page.evaluate(() => document.getAnimations().some(a => a.effect.target.classList.contains('mini-v2-marquee-text'))));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await settle();
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect.target.classList.contains('mini-v2-marquee-text')).length), 0);
      assert.equal(await card.evaluate(n => n.clientHeight), height);
    });
    assert.deepEqual(errors, []);
    console.log('PASS no browser script errors');
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
