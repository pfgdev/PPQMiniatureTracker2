'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Use the published working assets, not a dirty worktree or collection export.
function buildRenderProbe(publishedFiles, config) {
  assert.deepEqual(Object.keys(config).sort(), ['ownerEmail', 'scriptId']);
  assert(Object.values(config).every(value => typeof value === 'string' && value));
  const get = (name, type) => {
    const matches = publishedFiles.filter(file => file.name === name && file.type === type);
    assert.equal(matches.length, 1, 'Missing or duplicated published asset: ' + name);
    return matches[0].source.replace(/\r\n/g, '\n');
  };
  const manifest = JSON.parse(get('appsscript', 'JSON'));
  assert.equal(manifest.webapp.access, 'MYSELF');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  const baseline = get('Index', 'HTML');
  const assets = ['Styles', 'SaveFlow', 'PersistenceClient', 'RehearsalTransport', 'Scripts'];
  let full = baseline;
  for (const name of assets) {
    const slot = `<?!= rehearsalInclude_("${name}", loadTiming); ?>`;
    assert.equal(full.split(slot).length, 2, 'Unexpected include: ' + name);
    full = full.split(slot).join(get(name, 'HTML'));
  }
  assert.equal(full.split('<?!= snapshotJson ?>').length, 2);
  full = full.split('<?!= snapshotJson ?>').join('/*REHEARSAL_SNAPSHOT*/null');
  assert(!full.includes('<?'), 'Unexpanded template');
  const code = fs.readFileSync(path.join(__dirname, 'RenderProbe.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(code.split('__RENDER_PROBE_CONFIG__').length, 2);
  return [
    { name: 'appsscript', type: 'JSON', source: JSON.stringify(manifest, null, 2) },
    { name: 'Code', type: 'SERVER_JS', source: code.replace('__RENDER_PROBE_CONFIG__', () => JSON.stringify(config)) },
    { name: 'Baseline', type: 'HTML', source: baseline },
    { name: 'Static', type: 'HTML', source: full },
    ...assets.map(name => ({ name, type: 'HTML', source: get(name, 'HTML') }))
  ];
}

module.exports = { buildRenderProbe };
