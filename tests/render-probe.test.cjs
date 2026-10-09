'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildFiles } = require('../tools/rehearsal/build.cjs');
const { buildRenderProbe } = require('../tools/rehearsal/render-probe.cjs');

function fixture() {
  const config = { scriptId: 'test-project', ownerEmail: 'owner@example.com' };
  const app = buildFiles({ ...config, spreadsheetId: 'not-included', collectionId: 'also-not-included', savesEnabled: true });
  const published = Object.entries(app).map(([name, source]) => ({
    name: name.replace(/\.[^.]+$/, ''), type: name.endsWith('.js') ? 'SERVER_JS' : name.endsWith('.json') ? 'JSON' : 'HTML', source
  }));
  const files = buildRenderProbe(published, config);
  const f = { files, config, email: config.ownerEmail, scriptId: config.scriptId, calls: [], outputs: [] };
  function file(name) {
    f.calls.push(name);
    const match = files.find(item => item.name === name && item.type === 'HTML');
    assert(match, 'Missing fixture file: ' + name);
    return match.source;
  }
  function output(html = '') {
    const value = { html, getContent() { return this.html; }, setContent(value) { this.html = value; return this; }, setTitle() { return this; } };
    f.outputs.push(value);
    return value;
  }
  function template(source) {
    return { getRawContent: () => source, evaluate() {
      if (source === '<?!= pageHtml ?>') return output(this.pageHtml);
      const expanded = source.replace(/<\?!= rehearsalInclude_\("(\w+)", loadTiming\); \?>/g,
        (_, name) => f.server.rehearsalInclude_(name)).replace('<?!= snapshotJson ?>', () => this.snapshotJson);
      assert(!expanded.includes('<?'));
      return output(expanded);
    } };
  }
  f.server = vm.createContext({ Date, ScriptApp: { getScriptId: () => f.scriptId },
    Session: { getActiveUser: () => ({ getEmail: () => f.email }) },
    HtmlService: { createHtmlOutput: output, createHtmlOutputFromFile: name => output(file(name)),
      createTemplateFromFile: name => template(file(name)), createTemplate: template } });
  vm.runInContext(files.find(file => file.type === 'SERVER_JS').source, f.server);
  f.run = () => JSON.parse(JSON.stringify(f.server.renderProbeRun_()));
  return f;
}

test('probe contains only diagnostic server functions, keeps owner-only access, and excludes collection configuration', () => {
  const f = fixture(), code = f.files.filter(file => file.type === 'SERVER_JS');
  assert.equal(code.length, 1);
  assert.deepEqual([...code[0].source.matchAll(/^function (\w+)\(/gm)].map(m => m[1]).filter(n => !n.endsWith('_')), ['doGet']);
  assert(!code[0].source.match(/Sheets\.|SpreadsheetApp|DriveApp|UrlFetchApp|saveRehearsalChanges|persistenceContract|PropertiesService/));
  assert(!f.files.some(file => file.source.includes('not-included') || file.source.includes('also-not-included')));
  assert.equal(JSON.parse(f.files.find(file => file.type === 'JSON').source).webapp.access, 'MYSELF');
  assert.throws(() => buildRenderProbe(f.files, { ...f.config, spreadsheetId: 'injected' }));
});

for (const email of ['', 'another@example.com']) test('denied owner reads no assets: ' + (email || 'blank'), () => {
  const f = fixture(); f.email = email;
  assert.match(f.server.doGet().html, /owner account/);
  assert.deepEqual(f.calls, []);
  assert.throws(f.run, /Owner required/);
});

test('wrong project fails before any assets are accessed', () => {
  const f = fixture(); f.scriptId = 'original-app';
  assert.match(f.server.doGet().html, /owner account/);
  assert.deepEqual(f.calls, []);
});

test('all strategies produce identical content with synthetic data and reports contain metadata only', () => {
  const f = fixture(), report = f.run();
  assert.equal(report.trials.length, 7);
  assert(report.trials.every(t => t.ok && t.steps.every(s => s.ok)));
  assert(report.trials.slice(1).every(t => t.matchesExpected));
  assert(report.trials.slice(1).every(t => t.matchesWorking));
  assert(report.syntheticJsonChars > 400000 && report.syntheticJsonChars < 550000);
  assert.equal(report.trials[2].snapshotSlots, 1);
  assert.equal(report.trials[2].staticUnchanged, true);
  const json = JSON.stringify(report);
  for (const secret of [f.config.ownerEmail, f.config.scriptId, 'synthetic-group-', 'Synthetic second line', 'const INITIAL_STATE', '<script>']) assert(!json.includes(secret));
  const constructed = f.outputs.find(output => output.html.includes('synthetic-group-0')).html;
  assert(constructed.includes('\\u003c/script\\u003e'));
  assert(!constructed.includes('Synthetic second line. </script>'));
});

test('static-file construction failure identifies stage, suppresses HTML/error contents, and continues other trials', () => {
  const f = fixture(), read = f.server.HtmlService.createHtmlOutputFromFile;
  f.server.HtmlService.createHtmlOutputFromFile = name => {
    if (name === 'Static') throw new Error('Malformed HTML content: <script>private-value Bearer secret ya29.token</script>');
    return read(name);
  };
  const report = f.run(), trial = report.trials[2];
  assert.equal(trial.ok, false);
  assert.equal(trial.steps.length, 1);
  assert.equal(trial.steps[0].name, 'create-output-from-file');
  assert.equal(trial.steps[0].error.code, 'MALFORMED_HTML');
  assert(report.trials.slice(3).every(t => t.ok));
  assert(!JSON.stringify(report).match(/private-value|Bearer|ya29|<script>/));
});

test('setContent failure is not misreported as a file-read failure', () => {
  const f = fixture(), read = f.server.HtmlService.createHtmlOutputFromFile;
  f.server.HtmlService.createHtmlOutputFromFile = name => {
    const output = read(name);
    if (name === 'Static') output.setContent = () => { throw new Error('HTML is malformed at line 123'); };
    return output;
  };
  const report = f.run(), trial = report.trials[2];
  assert.equal(trial.steps.at(-1).name, 'set-content');
  assert.equal(trial.steps.at(-1).error.line, 123);
  assert.equal(trial.steps.at(-1).error.code, 'MALFORMED_HTML');
  assert(report.trials.slice(3).every(t => t.matchesExpected));
});

for (const replacement of ['null', '/*REHEARSAL_SNAPSHOT*/null /*REHEARSAL_SNAPSHOT*/null']) {
  test('detects missing or duplicated snapshot slot after Google file read: ' + replacement, () => {
    const f = fixture(), read = f.server.HtmlService.createHtmlOutputFromFile;
    f.server.HtmlService.createHtmlOutputFromFile = name => {
      const output = read(name);
      if (name === 'Static') output.html = output.html.replace('/*REHEARSAL_SNAPSHOT*/null', replacement);
      return output;
    };
    const trial = f.run().trials[2];
    assert.equal(trial.ok, false);
    assert.equal(trial.staticUnchanged, false);
    assert.equal(trial.steps.at(-1).name, 'embed-snapshot');
    assert.equal(trial.steps.at(-1).error.code, 'SNAPSHOT_SLOT');
  });
}

test('changed output is reported even when Google APIs do not throw', () => {
  const f = fixture(), create = f.server.HtmlService.createHtmlOutput;
  f.server.HtmlService.createHtmlOutput = html => create(html + 'changed');
  const trial = f.run().trials[3];
  assert.equal(trial.ok, true);
  assert.equal(trial.matchesExpected, false);
  assert.equal(typeof trial.firstDifference, 'number');
});

test('output comparison distinguishes inter-tag whitespace from executable or text changes', () => {
  const f = fixture(), compare = f.server.renderProbeWhitespaceDelta_;
  const a = '<body><script>const x=1;</script>\n\n<div></div></body>';
  const b = '<body><script>const x=1;</script>\n<div></div></body>';
  const result = compare(a, b);
  assert.equal(result.whitespaceOnly, true);
  assert.equal(result.outsideScriptAndStyle, true);
  assert.equal(result.edits.length, 1);
  assert.equal(compare(a.replace('x=1', 'x=2'), b).whitespaceOnly, false);
  assert.equal(compare('<script>const x = 1;</script>', '<script>const x= 1;</script>').outsideScriptAndStyle, false);
  assert.equal(compare('<style>p { color:red }</style>', '<style>p{ color:red }</style>').outsideScriptAndStyle, false);
});

test('preparation failure renders a bounded report without running remaining trials', () => {
  const f = fixture();
  f.server.HtmlService.createTemplateFromFile = () => { throw new Error('No HTML file named Static was found. sensitive'); };
  const report = f.run();
  assert.equal(report.trials.length, 1);
  assert.equal(report.trials[0].steps.at(-1).error.code, 'FILE_NOT_FOUND');
  const page = f.server.doGet().html;
  assert(page.includes('Copy results') && page.includes('FILE_NOT_FOUND'));
  assert(!page.includes('sensitive'));
});

test('unknown errors are not printed verbatim; includes remain allowlisted', () => {
  const f = fixture();
  const result = f.server.renderProbeError_(new Error('sensitive collection note and owner@example.com'));
  assert.equal(result.code, 'UNCLASSIFIED');
  assert(!JSON.stringify(result).includes('sensitive'));
  assert.throws(() => f.server.rehearsalInclude_('Code'), /Unknown asset/);
});

test('report page supports desktop, mobile, clipboard and a selectable fallback without loading app assets', { skip: !process.env.PLAYWRIGHT_MODULE }, async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
  const f = fixture(), report = f.run(), html = f.server.renderProbePage_(report).html;
  assert(!html.includes('MiniRehearsalTransport') && !html.includes('google.script.run'));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.abort());
      await page.setContent(html);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Copy results' }).click();
      assert.match(await page.locator('#status').textContent(), /Results selected/);
      assert.deepEqual(JSON.parse(await page.evaluate(() => getSelection().toString())), report);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied = text; } } }));
      await page.getByRole('button', { name: 'Copy results' }).click();
      assert.match(await page.locator('#status').textContent(), /Copied/);
      assert.deepEqual(JSON.parse(await page.evaluate(() => window.copied)), report);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
