import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Deliberate release command, separate from local generation and routine clasp push.
const dir = '.local/live/';
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'));
const write = (name, value) => fs.writeFileSync(dir + name, JSON.stringify(value, null, 2));
const hash = source => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
const sameFiles = (actual, expected) => {
  assert.equal(actual.files.length, expected.files.length, 'Remote file count changed');
  for (const file of expected.files) {
    const found = actual.files.find(f => f.name === file.name && f.type === file.type);
    assert(found, 'Remote file missing: ' + file.name);
    assert.equal(hash(found.source), hash(file.source), 'Remote source differs: ' + file.name);
  }
};

try {
  const config = read('config.json');
  assert.equal(config.scriptId, '1SMCFIDHUrUk3FrPteOSIXqENMK21wmtrsE_8GZ00NzY4poJuHpOwHwB0');
  assert.equal(config.spreadsheetId, '1JxWeleWT2upYOmenJmXhbxmbo5WW7nsxPHbcuXPmVHY');
  assert.equal(JSON.parse(fs.readFileSync('.clasp.json')).scriptId, config.scriptId);
  const { initAuth } = await import(pathToFileURL(path.join(process.env.APPDATA, 'npm/node_modules/@google/clasp/build/src/auth/auth.js')));
  const { credentials } = await initAuth({});
  assert(credentials, 'No clasp authentication');
  const request = async (url, method = 'GET', data) => (await credentials.request({ url, method, ...(data ? { data } : {}), retry: false })).data;
  const base = 'https://script.googleapis.com/v1/projects/' + encodeURIComponent(config.scriptId);
  const project = await request(base);
  if (project.parentId) assert.equal(project.parentId, config.spreadsheetId, 'Unexpected bound workbook');
  const command = process.argv[2];
  if (command === 'inspect') {
    assert(!fs.existsSync(dir + 'project-before.json'), 'Pre-release snapshot already exists');
    const content = await request(base + '/content');
    const deployments = await request(base + '/deployments');
    write('project-before.json', project);
    write('content-before.json', content);
    write('deployments-before.json', deployments);
    console.log(JSON.stringify({ project: { title: project.title, scriptId: project.scriptId, parentId: project.parentId },
      files: content.files.map(f => f.name), deployments: deployments.deployments?.map(d => ({ id: d.deploymentId, version: d.deploymentConfig.versionNumber, entryPoints: d.entryPoints })) }));
  } else if (command === 'deploy') {
    assert(!fs.existsSync(dir + 'deployment.json'), 'Live deployment already created; do not duplicate');
    const verified = read('migration-verified.json');
    assert.equal(verified.spreadsheetId, config.spreadsheetId);
    assert.equal(verified.collectionId, config.collectionId);
    assert.equal(verified.exactMatch, true);
    assert.equal(read('baseline-verified.json').exactMatch, true, 'Six-tab backup not verified');
    sameFiles(await request(base + '/content'), read('content-before.json'));
    assert.deepEqual(await request(base + '/deployments'), read('deployments-before.json'), 'Remote deployment changed');
    const upload = read('upload.json');
    const manifest = JSON.parse(upload.files.find(f => f.name === 'appsscript').source);
    assert.deepEqual(manifest.webapp, { access: 'MYSELF', executeAs: 'USER_DEPLOYING' });
    assert.deepEqual(manifest.oauthScopes, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/userinfo.email']);
    const code = upload.files.find(f => f.name === 'Code').source;
    assert.deepEqual(JSON.parse(code.match(/var COLLECTION_CONFIG_ = (\{[^\n]+\});/)[1]), config);
    for (const file of upload.files) {
      assert(!/Rehearsal|rehearsal|__mini|saveTestMode|createSimulator|Copy load timing/.test(file.source), 'Debug feature leaked: ' + file.name);
      assert(!file.source.includes('1wa-y9lifHvSZOdu0MYRsCI4Kr9OtTs9WAWwssxpc2vM'), 'Test workbook leaked');
      assert(!file.source.includes('1mGipFEfW--whXnmIPyW9i9Y8eo4pyKezSooOVacO2_4'), 'Legacy workbook leaked');
    }
    await request(base + '/content', 'PUT', upload);
    sameFiles(await request(base + '/content'), upload);
    const description = 'Owner-only live collection saving - schema 2 - clean production build';
    const version = await request(base + '/versions', 'POST', { description });
    write('version.json', version);
    const deployment = await request(base + '/deployments', 'POST', {
      versionNumber: version.versionNumber, manifestFileName: 'appsscript', description
    });
    write('deployment.json', deployment);
    const actual = await request(base + '/deployments/' + deployment.deploymentId);
    assert.equal(actual.deploymentConfig.versionNumber, version.versionNumber);
    const app = actual.entryPoints?.find(e => e.entryPointType === 'WEB_APP')?.webApp;
    assert.equal(app?.entryPointConfig?.access, 'MYSELF');
    assert.equal(app.entryPointConfig.executeAs, 'USER_DEPLOYING');
    sameFiles(await request(base + '/content?versionNumber=' + version.versionNumber), upload);
    const all = await request(base + '/deployments');
    for (const old of read('deployments-before.json').deployments || []) {
      if (!old.deploymentConfig.versionNumber) continue; // HEAD follows the new manifest.
      assert.deepEqual(all.deployments.find(d => d.deploymentId === old.deploymentId), old, 'Prior deployment changed');
    }
    write('deployment-verified.json', actual);
    console.log(JSON.stringify({ version: version.versionNumber, app, priorVersionedDeploymentsUnchanged: true }));
  } else throw new Error('Use inspect or deploy');
} catch (error) {
  console.error(JSON.stringify({ operation: process.argv[2], status: error.response?.status || error.code || 'failed',
    message: error.response ? error.response.data?.error?.message || 'Google request failed' : error.message }));
  process.exitCode = 1;
}
