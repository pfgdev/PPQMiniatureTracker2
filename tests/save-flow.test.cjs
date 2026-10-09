const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ setTimeout });
const source = fs.readFileSync(path.join(__dirname, '../SaveFlow.html'), 'utf8');
vm.runInContext(source.replace(/<\/?script>/g, ''), context);
const flow = vm.runInContext('MiniSaveFlow', context);
const clone = value => JSON.parse(JSON.stringify(value));
const group = (id, sticker) => ({ rootId: id, name: id, notes: '', copies: { [id]: { id, sticker, currentLocation: 'Drawer', note: '' } } });
function fixture() {
  const one = group('one', 'A00'), two = group('two', 'A01');
  const transport = flow.createSimulator([{ table: 'groups', id: 'one', value: one }, { table: 'groups', id: 'two', value: two }], { delay: 0 });
  const request = { requestId: 'request-1', targets: [{ table: 'groups', id: 'one', before: one, value: { ...clone(one), notes: 'my edit' } }] };
  return { transport, request, one, two };
}
test('simulation is async, atomic, and never mutates the submitted draft', async () => {
  const { transport, request } = fixture(), before = JSON.stringify(request);
  const promise = transport.send(request); assert.equal(transport.inspect().commits, 0);
  assert.equal((await promise).ok, true); assert.equal(transport.inspect().commits, 1);
  assert.equal(JSON.stringify(request), before);
});
for (const mode of ['failure', 'lost']) test(`${mode}: exact retry resolves safely, changed request ID contents are rejected`, async () => {
  const { transport, request } = fixture(); transport.setOutcome(mode);
  assert.equal((await transport.send(request)).ok, false);
  assert.equal(transport.inspect().commits, mode === 'lost' ? 1 : 0);
  const retry = await transport.send(request); assert.equal(retry.ok, true); assert.equal(transport.inspect().commits, 1);
  assert.equal(retry.replayed, mode === 'lost');
  request.targets[0].value.name = 'Changed request';
  assert.equal((await transport.send(request)).code, 'REQUEST_REUSED'); assert.equal(transport.inspect().commits, 1);
});
test('concurrent duplicated submission creates only one receipt and one commit', async () => {
  const { transport, request } = fixture();
  const results = await Promise.all([transport.send(request), transport.send(request)]);
  assert.equal(transport.inspect().commits, 1); assert.equal(results.filter(r => r.replayed).length, 1);
});
test('affected-record conflicts reject whole batch; unrelated changes do not', async () => {
  const { transport, request, two } = fixture();
  transport.change({ table: 'groups', id: 'two' }, { ...two, notes: 'other tab' });
  assert.equal((await transport.send(request)).ok, true);
  const stale = { requestId: 'second', targets: [{ table: 'groups', id: 'two', before: two, value: { ...two, notes: 'mine' } }] };
  const response = await transport.send(stale); assert.equal(response.code, 'STALE');
  assert.equal(response.latest[0].value.notes, 'other tab'); assert.equal(transport.inspect().commits, 1);
});
test('duplicate stickers reject without partial updates, while final-state swaps work', async () => {
  const { transport, request, two } = fixture(); request.targets[0].value.copies.one.sticker = 'A01';
  assert.equal((await transport.send(request)).code, 'INVALID'); assert.equal(transport.inspect().commits, 0);
  request.targets.push({ table: 'groups', id: 'two', before: two, value: { ...two, copies: { two: { ...two.copies.two, sticker: 'A00' } } } });
  assert.equal((await transport.send(request)).ok, true); assert.equal(transport.inspect().commits, 1);
});
test('three-way review preserves unrelated latest fields and requires explicit overlapping choices', () => {
  const base = group('one', 'A00'), mine = clone(base), latest = clone(base);
  mine.name = 'My name'; mine.copies.one.note = 'My note'; latest.name = 'Latest name'; latest.notes = 'Their notes';
  const initial = flow.merge(base, mine, latest);
  assert.equal(initial.conflicts.length, 1); assert.equal(initial.conflicts[0].resolved, false);
  const resolved = flow.merge(base, mine, latest, { '["name"]': 'mine' });
  assert.equal(resolved.value.name, 'My name'); assert.equal(resolved.value.notes, 'Their notes');
  assert.equal(resolved.value.copies.one.note, 'My note'); assert.ok(resolved.conflicts.every(c => c.resolved));
});
test('preview-only legacy sticker duplicates do not block metadata repairs or permit additional duplicates', async () => {
  const one = group('one', 'A00'), two = group('two', 'A00'), three = group('three', '');
  const transport = flow.createSimulator([one, two, three].map(value => ({ table: 'groups', id: value.rootId, value })), { delay: 0 });
  assert.equal((await transport.send({ requestId: 'repair', targets: [{ table: 'groups', id: 'one', before: one, value: { ...one, notes: 'repair' } }] })).ok, true);
  assert.equal((await transport.send({ requestId: 'duplicate', targets: [{ table: 'groups', id: 'three', before: three, value: group('three', 'A00') }] })).code, 'INVALID');
});
test('copy removal versus external edit and whole-record deletion require review, not resurrection', () => {
  const base = group('one', 'A00'), mine = clone(base), latest = clone(base);
  delete mine.copies.one; latest.copies.one.note = 'New note';
  assert.deepEqual(clone(flow.merge(base, mine, latest).conflicts[0].path), ['copies', 'one']);
  assert.equal(flow.merge(base, mine, latest, { '["copies","one"]': 'mine' }).value.copies.one, undefined);
  assert.equal(flow.merge(base, mine, latest, { '["copies","one"]': 'latest' }).value.copies.one.note, 'New note');
  assert.equal(flow.merge(base, { ...base, notes: 'mine' }, null).conflicts.length, 1);
});
test('two different new copies merge without erasing either copy', () => {
  const base = group('one', 'A00'), mine = clone(base), latest = clone(base);
  mine.copies.new1 = { id: 'new1', sticker: '' }; latest.copies.new2 = { id: 'new2', sticker: '' };
  const result = flow.merge(base, mine, latest);
  assert.equal(result.conflicts.length, 0); assert.deepEqual(Object.keys(result.value.copies).sort(), ['new1', 'new2', 'one']);
});

test('overwrite applies my conflicting fields and copy removal but preserves unrelated saved changes', () => {
  const base = group('one', 'A00'), mine = clone(base), latest = clone(base);
  mine.name = 'Mine'; latest.name = 'Theirs'; latest.notes = 'Unrelated saved note';
  mine.copies.one.note = 'My copy note'; latest.copies.one.currentLocation = 'Encounter Box';
  const result = flow.overwriteEdits(base, mine, latest);
  assert.equal(result.name, 'Mine'); assert.equal(result.notes, 'Unrelated saved note');
  assert.equal(result.copies.one.note, 'My copy note'); assert.equal(result.copies.one.currentLocation, 'Encounter Box');
  delete mine.copies.one;
  assert.equal(flow.overwriteEdits(base, mine, latest).copies.one, undefined);
  assert.equal(flow.overwriteEdits(base, null, latest), null);
  assert.deepEqual(clone(flow.overwriteEdits(base, mine, null)), mine);
});

test('repeated conflict demonstrations do not accumulate name suffixes or strip real parentheses', async () => {
  const { transport, request } = fixture();
  const original = { ...request.targets[0].before, name: 'Soldier (Invisible)' };
  transport.change(request.targets[0], original); request.targets[0].before = original;
  for (let index = 0; index < 4; index++) {
    transport.setOutcome('conflict');
    const response = await transport.send({ ...request, requestId: `conflict-${index}` });
    assert.equal(response.code, 'STALE');
    const name = response.latest[0].value.name;
    assert.equal(name, index % 2 ? 'Soldier (Invisible)' : 'Soldier (Invisible) - Updated');
    request.targets[0].before = response.latest[0].value;
  }
  assert.equal(transport.inspect().commits, 0);
});
test('reviewed requests must check latest baseline again if a third edit arrives', async () => {
  const { transport, request, one } = fixture(); transport.change({ table: 'groups', id: 'one' }, { ...one, name: 'other tab' });
  const response = await transport.send(request), latest = response.latest[0].value;
  const merged = flow.merge(one, request.targets[0].value, latest);
  transport.change({ table: 'groups', id: 'one' }, { ...latest, name: 'third edit' });
  const retry = await transport.send({ requestId: 'reviewed', targets: [{ ...request.targets[0], before: latest, value: merged.value }] });
  assert.equal(retry.code, 'STALE'); assert.equal(transport.inspect().commits, 0);
});
test('simulation contains no network, Google bridge, or durable draft storage calls', () => {
  assert.doesNotMatch(source, /google\.script|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|SpreadsheetApp|Sheets\.Spreadsheets/);
});
test('a simulated external list rename carries assignments through conflict review', async () => {
  const one = { ...group('one', 'A00'), race: 'Human' }, choice = { id: 'choice-1', value: 'Human', home: false, hidden: false };
  const target = { table: 'lists:race', id: choice.id, before: choice, value: { ...choice, value: 'Humans' } };
  const transport = flow.createSimulator([{ table: 'groups', id: 'one', value: one }, { ...target, value: choice }], { delay: 0 });
  transport.setOutcome('conflict'); const conflict = await transport.send({ requestId: 'first', targets: [target] });
  assert.equal(conflict.code, 'STALE');
  assert.equal((await transport.send({ requestId: 'reviewed', targets: [{ ...target, before: conflict.latest[0].value }] })).ok, true);
  const stored = transport.inspect().records.find(r => r.value.rootId === 'one').value;
  assert.equal(stored.race, 'Humans');
});
