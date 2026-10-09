'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { rehearsalFixture } = require('./helpers/rehearsal-fixture.cjs');
const { services } = require('./helpers/persistence-fixture.cjs');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('tools/rehearsal/Hash.js', 'utf8'), context);
const digest = value => context.rehearsalSha256_(value);
const expected = value => createHash('sha256').update(value).digest('hex');

test('V8 fingerprint hashing matches standard SHA-256 vectors', () => {
  assert.equal(digest(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(digest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(digest('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(digest('a'.repeat(1000000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});

test('UTF-8, nulls, surrogate handling and SHA block/padding boundaries match Node', () => {
  for (const value of ['\0', '\r\n', '\u00e9', '\u6f22\u5b57', '\ud83d\ude00', '\ud800', '\udc00', '\ud800x\udc00']) {
    assert.equal(digest(value), expected(value));
    assert.equal(digest(JSON.stringify({ notes: value })), expected(JSON.stringify({ notes: value })));
  }
  for (const length of [1, 2, 3, 4, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 45000]) {
    for (const letter of ['a', '\u00e9', '\ud83d\ude00']) {
      const value = letter.repeat(length);
      assert.equal(digest(value), expected(value), 'Length ' + length);
    }
  }
});

test('deterministic mixed Unicode fuzz matches Node SHA-256', () => {
  let seed = 123456789;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 100; i++) {
    const value = Array.from({ length: next() % 1500 }, () => String.fromCharCode(next() % 65536)).join('');
    assert.equal(digest(value), expected(value));
  }
});

test('all collection record tokens match the previous native hash implementation', () => {
  const f = rehearsalFixture();
  const file = '.local/rehearsal/candidate-state.json';
  const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : f.base.stored();
  const before = f.server.persistenceClientSnapshot_(state, services);
  const after = f.server.persistenceClientSnapshot_(state, { ...services, digest });
  assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before)));
});

test('previously committed native-hash requests replay after the V8-hash switch', () => {
  const f = rehearsalFixture(), state = f.base.stored();
  const payload = { rootId: 'one', copies: [{ id: 'one-01', currentLocationId: state.groups[0].homeId }] };
  const request = { requestId: 'previous-native-request', collectionId: state.collectionId,
    expectedRevision: 0, kind: 'saveLocations', payload,
    preconditions: f.server.persistencePreconditions_(state, 'saveLocations', payload, services) };
  const saved = f.server.persistenceContractSave_(request, f.base.config, f.base.runtime);
  assert.equal(saved.ok, true);
  const replay = f.send(request);
  assert.equal(replay.ok, true); assert.equal(replay.replayed, true);
  assert.equal(f.base.commits, 1);
  assert.equal(replay.timing.outcome, 'ok');
  assert.equal(replay.timing.writeMs, 0);
  assert(replay.timing.hashCalls > 0);
  assert(!JSON.stringify(replay.timing).includes('one'));
});

test('rehearsal hashing makes no native digest calls while keeping lock and Sheets paths', () => {
  const f = rehearsalFixture();
  f.base.runtime.services = { ...services, digest() { throw new Error('Native hash must not be called'); } };
  assert.equal(f.load().snapshot.groups.length, 2);
  assert.deepEqual(f.base.trace, ['lock', 'read', 'read', 'release']);
});
