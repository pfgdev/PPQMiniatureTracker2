'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, client, preview, groupTarget, request, clone } = require('./helpers/persistence-fixture.cjs');

function setup() {
  const data = preview();
  data.groups[0].copies.push({ ...data.groups[0].copies[0], id: 'one-02', miniNumber: '02', sticker: 'A02', note: 'Original copy note' });
  const f = fixture(data); return { f, c: client(f) };
}
async function save(c, target) {
  const response = await c.send(request(target)); assert.equal(response.ok, true, JSON.stringify(response)); c.accept(response.result.records);
  return response.result.records[0];
}

test('removed copies survive reload, do not reserve stickers and restore their original identity and notes', async () => {
  const { f, c } = setup(), target = groupTarget(c); delete target.value.copies['one-02']; await save(c, target);
  const reload = client(f), archive = reload.removed(); assert.equal(archive.groups.length, 0); assert.equal(archive.copies.length, 1);
  const copy = archive.copies[0]; assert.equal(copy.id, 'one-02'); assert.equal(copy.sticker, 'A02'); assert.equal(copy.parentDeleted, false);
  assert.equal(reload.initialState().groups[0].copies.length, 1);
  const record = await save(reload, { ...groupTarget(reload), restoreCopyId: copy.id });
  assert.equal(record.value.copies['one-02'].note, 'Original copy note'); assert.equal(record.value.copies['one-02'].miniNumber, '02');
  assert.equal(reload.removed().copies.length, 0); assert.equal(f.sent.at(-1).kind, 'restoreCopy');
});

test('a whole group restore does not resurrect copies removed before that group was deleted', async () => {
  const { f, c } = setup(), target = groupTarget(c); delete target.value.copies['one-02'];
  const saved = await save(c, target);
  await save(c, c.capture({ table: 'groups', id: 'one', before: saved.value, value: null }));
  const reload = client(f), archive = reload.removed(); assert.equal(archive.groups.length, 1);
  assert.deepEqual(Object.keys(archive.groups[0].group.copies), ['one-01']); assert.equal(archive.copies[0].parentDeleted, true);
  const restored = await save(reload, reload.capture({ table: 'groups', id: 'one', before: null, value: archive.groups[0].group }));
  assert.deepEqual(Object.keys(restored.value.copies), ['one-01']); assert.equal(reload.removed().copies[0].parentDeleted, false);
  const value = { table: 'groups', id: 'one', before: restored.value, value: clone(restored.value), restoreCopyId: 'one-02' };
  await save(reload, reload.capture(value)); assert.equal(client(f).initialState().groups[0].copies.length, 2);
});

test('restoration cannot steal a sticker that was reassigned while the copy was removed', async () => {
  const { f, c } = setup(), target = groupTarget(c); delete target.value.copies['one-02']; await save(c, target);
  const two = groupTarget(c, 'two'); two.value.copies['two-01'].sticker = 'A02'; await save(c, two);
  const reload = client(f), before = JSON.stringify(f.stored());
  const result = await reload.send(request({ ...groupTarget(reload), restoreCopyId: 'one-02' }));
  assert.equal(result.code, 'STICKER_CONFLICT'); assert.equal(JSON.stringify(f.stored()), before); assert.equal(reload.removed().copies.length, 1);
});

test('lost restore acknowledgment retries the original operation instead of adding a duplicate copy', async () => {
  const { f, c } = setup(), target = groupTarget(c); delete target.value.copies['one-02']; await save(c, target);
  const reload = client(f), req = request({ ...groupTarget(reload), restoreCopyId: 'one-02' });
  f.mode = 'lost'; assert.equal((await reload.send(req)).code, 'SAVE_UNCERTAIN');
  const retry = await reload.send(req); assert.equal(retry.ok, true); assert.equal(retry.replayed, true);
  assert.deepEqual(f.sent.at(-1), f.sent.at(-2)); assert.equal(f.stored().copies.length, 3);
  assert.equal(f.commits, 2);
});

test('restore-and-save validates the whole result before reviving a remotely deleted group', async () => {
  const { f, c } = setup(), target = groupTarget(c);
  target.value.notes = 'My draft'; f.external('deleteGroup', { rootId: 'one' });
  const other = client(f), two = groupTarget(other, 'two'); two.value.copies['two-01'].sticker = 'A00'; await save(other, two);
  const conflict = await c.send(request(target)); assert.equal(conflict.code, 'STALE');
  const before = JSON.stringify(f.stored());
  const result = await c.send(request({ ...target, before: null, baseline: conflict.latest[0].baseline }));
  assert.equal(result.code, 'STICKER_CONFLICT'); assert.equal(JSON.stringify(f.stored()), before);
  assert.ok(f.stored().groups[0].deletedAt);
});

test('restoring a removed list choice never rewinds miniature assignments', async () => {
  const { f, c } = setup(), human = c.initialState().choiceRecords.race.find(item => item.value === 'Human');
  await save(c, c.capture({ table: 'lists:race', id: human.id, before: human, value: { ...human, hidden: true } }));
  const target = groupTarget(c); target.value.race = 'n/a'; await save(c, target);
  const reload = client(f), removed = reload.initialState().choiceRecords.race.find(item => item.id === human.id);
  await save(reload, reload.capture({ table: 'lists:race', id: human.id, before: removed, value: { ...removed, hidden: false } }));
  assert.equal(client(f).initialState().groups[0].race, 'n/a'); assert.equal(client(f).initialState().groups[1].race, 'Human');
});

test('an explicit conflict restore preserves a copy ID and saves its edits after another tab removed it', async () => {
  const { f, c } = setup(), original = groupTarget(c), other = client(f), removal = groupTarget(other);
  original.value.copies['one-02'].note = 'Keep these edits'; delete removal.value.copies['one-02']; await save(other, removal);
  const stale = await c.send(request(original)); assert.equal(stale.code, 'STALE');
  const restored = await c.send(request({ ...original, before: stale.latest[0].value, baseline: stale.latest[0].baseline }));
  assert.equal(restored.ok, true, JSON.stringify(restored)); assert.equal(f.sent.at(-1).kind, 'restoreGroupAndSave');
  const copies = f.stored().copies.filter(copy => copy.rootId === 'one');
  assert.equal(copies.length, 2); assert.equal(copies[1].id, 'one-02'); assert.equal(copies[1].note, 'Keep these edits'); assert.equal(copies[1].deletedAt, '');
});

test('Save All can explicitly restore a remotely deleted group and save another draft atomically', async () => {
  const { f, c } = setup(), targets = [groupTarget(c), groupTarget(c, 'two')];
  targets[0].value.notes = 'Restored draft'; targets[1].value.notes = 'Other draft';
  f.external('deleteGroup', { rootId: 'one' });
  const conflict = await c.send(request(targets)); assert.equal(conflict.code, 'STALE'); assert.equal(f.commits, 1);
  const result = await c.send(request(targets.map((target, index) => ({ ...target,
    before: conflict.latest[index].value, baseline: conflict.latest[index].baseline
  }))));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(f.commits, 2);
  assert.equal(f.sent.at(-1).kind, 'saveBatch'); assert.equal(f.sent.at(-1).payload.changes[0].kind, 'restoreGroupAndSave');
  assert.deepEqual(f.stored().groups.map(group => group.notes), ['Restored draft', 'Other draft']);
  assert.deepEqual(f.stored().copies.filter(copy => !copy.deletedAt).map(copy => copy.id), ['one-01', 'one-02', 'two-01']);
});
