'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, client, preview, groupTarget, request } = require('./helpers/persistence-fixture.cjs');

// Inspect what a reload can derive. Browser tests exercise the actual Apply control.
function available(f) {
  const state = client(f).initialState();
  const used = new Set(state.groups.flatMap(group => group.copies).map(copy => copy.sticker.trim().toUpperCase()));
  return state.stickerCatalog.filter(code => !used.has(code));
}

test('reload exposes the same first catalog gap after manually saving a later sticker', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  assert.equal(available(f)[0], 'A02'); target.value.copies['one-01'].sticker = 'a41';
  assert.equal((await c.send(request(target))).ok, true);
  assert.equal(available(f)[0], 'A00'); assert.equal(available(f).includes('A41'), false);
  assert.equal(f.stored().schemaVersion, 2); assert.equal('stickerStart' in f.stored(), false);
  assert.equal('stickerPreference' in f.sent[0], false);
});

test('a missing D11 remains available when every other A through F sticker is already used', () => {
  const data = preview();
  data.stickerCatalog = Array.from({ length: 700 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 100)) + String(i % 100).padStart(2, '0'));
  data.groups[0].copies[0].sticker = 'G41';
  data.groups[1].copies = data.stickerCatalog.slice(0, 600).filter(code => code !== 'D11').map((sticker, index) => ({
    id: `two-${sticker}`, miniNumber: String(index + 1), sticker, note: '', currentLocation: 'Drawer'
  }));
  const f = fixture(data); assert.equal(available(f)[0], 'D11'); assert.equal(available(f)[1], 'G00');
});

test('unsent and rejected assignments never consume catalog gaps', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.copies['one-01'].sticker = 'A02'; assert.equal(available(f)[0], 'A02');
  target.value.copies['one-01'].sticker = 'A01'; assert.equal((await c.send(request(target))).code, 'STICKER_CONFLICT');
  assert.equal(available(f)[0], 'A02'); assert.equal(f.commits, 0);
});

test('lost confirmations do not assign the next catalog gap twice', async () => {
  const f = fixture(), c = client(f), target = groupTarget(c);
  target.value.copies['one-01'].sticker = 'A02'; const req = request(target); f.mode = 'lost';
  assert.equal((await c.send(req)).code, 'SAVE_UNCERTAIN'); assert.equal(available(f).includes('A02'), false);
  assert.equal((await c.send(req)).ok, true); assert.equal(f.commits, 1); assert.deepEqual(f.sent[0], f.sent[1]);
});

test('removed copies release catalog IDs while blank and n/a assignments reserve none', async () => {
  const data = preview(); data.groups[0].copies.push({ ...data.groups[0].copies[0], id: 'one-02', miniNumber: '02', sticker: '' });
  const f = fixture(data), c = client(f), target = groupTarget(c);
  delete target.value.copies['one-01']; target.value.copies['one-02'].sticker = 'n/a';
  assert.equal((await c.send(request(target))).ok, true);
  assert.equal(available(f)[0], 'A00'); assert.equal(available(f)[1], 'A02');
  assert.ok(f.stored().copies.find(copy => copy.id === 'one-01').deletedAt);
});

test('two tabs cannot save the same suggested gap into different miniatures', async () => {
  const f = fixture(), first = client(f), second = client(f);
  const one = groupTarget(first), two = groupTarget(second, 'two');
  one.value.copies['one-01'].sticker = 'A02'; two.value.copies['two-01'].sticker = 'A02';
  assert.equal((await first.send(request(one))).ok, true);
  assert.equal((await second.send(request(two))).code, 'STICKER_CONFLICT');
  assert.equal(f.commits, 1); assert.equal(available(f).includes('A02'), false);
});
