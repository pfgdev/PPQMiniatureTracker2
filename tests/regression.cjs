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
    const mode = value => page.locator(`[data-browse-mode="${value}"]`).click();
    const browseCopies = () => page.locator('.mini-v2-browse-table tbody tr').evaluateAll(rows => rows.map(row => row.dataset.copyId));
    const location = async value => {
      await action('toggle-location-menu').click();
      await page.locator(`[data-location-value="${value}"]`).click();
    };

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
          const tableGeometry = () => page.locator('.mini-v2-browse-table').evaluate(table => ({
            rowHeight: table.tBodies[0].rows[0].getBoundingClientRect().height,
            columns: [...table.tHead.rows[0].cells].map(cell => cell.getBoundingClientRect().left)
          }));
          const originalGeometry = await tableGeometry();
          const detail = await page.locator('#miniV2DetailContent').innerHTML();
          const toggle = page.locator('[data-browse-mode="individuals"]');
          const before = await page.locator('.mini-v2-view-switch').boundingBox();
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.mini-v2-browse-table tbody tr').count(), 28);
          assert.equal(await page.locator('.mini-v2-browse-table th').first().innerText(), 'ID');
          assert.equal(await page.locator('.mini-v2-browse-table th').nth(2).innerText(), 'CURRENT LOCATION');
          assert.match(await page.locator('#miniV2SummaryLane').innerText(), /Visible 28 individuals/i);
          assert.deepEqual(await tableGeometry(), originalGeometry);
          if (width >= 1280 && detailOpen) {
            assert.ok(await page.locator('.mini-v2-list-wrap').evaluate(wrap =>
              [...wrap.querySelectorAll('.mini-v2-copy-status')].every(badge => badge.getBoundingClientRect().right < wrap.getBoundingClientRect().right)
            ));
          }
          assert.equal(await page.locator('#miniV2DetailContent').innerHTML(), detail);
          const after = await page.locator('.mini-v2-view-switch').boundingBox();
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
      await action('review-changes').click();
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
      await page.locator('[data-facet-flag="needsStickersOnly"]').click();
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
      assert.deepEqual(after, before);
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
