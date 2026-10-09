'use strict';
const vm = require('node:vm');
const { fixture, clone } = require('./persistence-fixture.cjs');
const { buildFiles } = require('../../tools/rehearsal/build.cjs');
const { fakeRehearsalSheets } = require('./rehearsal-sheets.cjs');

function rehearsalFixture(data, { live = false } = {}) {
  const base = fixture(data);
  const settings = { scriptId: 'isolated-test-project', spreadsheetId: base.config.spreadsheetId,
    collectionId: base.config.collectionId, ownerEmail: base.config.ownerEmail, savesEnabled: true };
  const files = buildFiles(settings, { live }), sent = [];
  const prefix = live ? 'Collection' : 'Rehearsal', lower = prefix.toLowerCase();
  const htmlOutput = html => ({ html, getContent() { return this.html; }, setContent(value) { this.html = value; return this; },
    append(value) { this.html += value; return this; }, setTitle() { return this; } });
  const snapshotFromHtml = html => {
    const match = html.match(/const INITIAL_STATE = \{ (?:rehearsal|collection)Mode: true, persistenceSnapshot: (.+) \};/);
    if (!match) throw new Error('Rehearsal load did not pass');
    return JSON.parse(match[1]);
  };
  let email = settings.ownerEmail, scriptId = settings.scriptId, consent = true, authChecks = 0;
  Object.assign(base.server, {
    Session: { getActiveUser: () => ({ getEmail: () => email }) },
    ScriptApp: { getScriptId: () => scriptId, AuthMode: { FULL: 'FULL' }, AuthorizationStatus: { REQUIRED: 'REQUIRED' },
      getAuthorizationInfo: (mode, scopes) => {
        authChecks++;
        if (mode !== 'FULL' || scopes.length !== 1 || scopes[0] !== 'https://www.googleapis.com/auth/spreadsheets') throw new Error('Wrong authorization scope');
        return { getAuthorizationStatus: () => consent ? 'NOT_REQUIRED' : 'REQUIRED',
          getAuthorizationUrl: () => 'https://script.google.com/oauthcallback?test=1&next=2' };
      } },
    HtmlService: { createHtmlOutput: htmlOutput,
      createHtmlOutputFromFile: name => htmlOutput(files[name + '.html']),
      createTemplateFromFile: name => ({ getRawContent() { return files[name + '.html']; }, evaluate() {
        const html = files[name + '.html'].replace('<?!= snapshotJson ?>', () => this.snapshotJson)
          .replace(/<\?!= (?:rehearsal|collection)Include_\("(\w+)", loadTiming\); \?>/g, (_, name) => base.server[lower + 'Include_'](name, this.loadTiming));
        return htmlOutput(html);
      } }) }
  });
  base.server.persistenceAdapterRuntime_ = () => ({ ...base.runtime });
  base.server.Sheets = fakeRehearsalSheets(id => base.runtime.read(id));
  vm.runInContext(files[prefix + 'Hash.js'], base.server);
  vm.runInContext(files[prefix + 'Read.js'], base.server);
  vm.runInContext(files['Code.js'], base.server);
  return {
    base, settings, files, sent, server: base.server,
    set email(value) { email = value; base.caller = value; },
    set scriptId(value) { scriptId = value; },
    set consent(value) { consent = value; },
    get authChecks() { return authChecks; },
    set enabled(value) { base.server[prefix.toUpperCase() + '_CONFIG_'].savesEnabled = value; },
    load() { return { ok: true, snapshot: snapshotFromHtml(base.server.doGet().html) }; },
    send(request) { sent.push(clone(request)); return clone(base.server['save' + prefix + 'Changes'](clone(request))); },
    html() {
      const output = base.server.doGet();
      snapshotFromHtml(output.html);
      return output.html;
    }
  };
}
module.exports = { rehearsalFixture };
