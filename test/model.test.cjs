const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const model = require('../src/model.cjs');
const { Store } = require('../src/store.cjs');
const input = { name: 'Example medication', amount: '1 tablet · 10 mg', frequency: 'daily', doses: 2, weekdays: [] };
const morning = new Date(2026, 9, 5, 8, 15);

test('each daily dose can be recorded and undone independently', () => {
  let state = model.addMedication(model.emptyState(), input);
  const id = state.medications[0].id;
  state = model.toggleDose(state, id, 0, morning);
  state = model.toggleDose(state, id, 1, new Date(2026, 9, 5, 20));
  assert.equal(state.records['2026-10-05'].length, 2);
  assert.equal(state.records['2026-10-05'][0].takenAt, morning.toISOString());
  state = model.toggleDose(state, id, 0, morning);
  assert.deepEqual(state.records['2026-10-05'].map(r => r.dose), [1]);
});
test('next local day starts unchecked while previous checkoffs remain', () => {
  let state = model.addMedication(model.emptyState(), input);
  const id = state.medications[0].id;
  state = model.toggleDose(state, id, 0, new Date(2026, 9, 5, 23, 59));
  assert.equal(state.records['2026-10-06'], undefined);
  state = model.toggleDose(state, id, 0, new Date(2026, 9, 6, 0, 1));
  assert.equal(state.records['2026-10-05'].length, 1);
  assert.equal(state.records['2026-10-06'].length, 1);
});
test('weekly medications can only be checked off on selected weekdays', () => {
  const state = model.addMedication(model.emptyState(), { ...input, frequency: 'weekly', weekdays: [1, 3], doses: 1 });
  assert.equal(model.dueOn(state.medications[0], morning), true);
  assert.throws(() => model.toggleDose(state, state.medications[0].id, 0, new Date(2026, 9, 6)), /not scheduled/);
  assert.equal(model.toggleDose(state, state.medications[0].id, 0, morning).records['2026-10-05'].length, 1);
});
test('as-needed medication supports one reversible checkoff per day', () => {
  let state = model.addMedication(model.emptyState(), { ...input, frequency: 'as-needed' });
  assert.equal(state.medications[0].doses, 1);
  const id = state.medications[0].id;
  state = model.toggleDose(state, id, 0, morning);
  assert.throws(() => model.toggleDose(state, id, 1, morning), /not scheduled/);
  assert.equal(model.toggleDose(state, id, 0, morning).records['2026-10-05'].length, 0);
});
test('editing or removing a medication preserves recorded details', () => {
  let state = model.addMedication(model.emptyState(), input);
  const id = state.medications[0].id;
  state = model.toggleDose(state, id, 0, morning);
  state = model.editMedication(state, id, { ...input, amount: '2 tablets', doses: 1 });
  assert.equal(state.records['2026-10-05'][0].medication.amount, input.amount);
  assert.equal(state.medications[0].amount, '2 tablets');
  state = model.removeMedication(state, id);
  assert.equal(state.medications.length, 0);
  assert.equal(state.records['2026-10-05'][0].medication.name, input.name);
  model.validateState(state);
});
test('invalid medication details and duplicate backup records are rejected', () => {
  for (const bad of [{ name: ' ' }, { amount: '' }, { doses: 0 }, { doses: 1.5 }, { frequency: 'weekly', weekdays: [] }, { frequency: 'weekly', weekdays: [9] }]) {
    assert.throws(() => model.addMedication(model.emptyState(), { ...input, ...bad }));
  }
  let state = model.addMedication(model.emptyState(), input);
  state = model.toggleDose(state, state.medications[0].id, 0, morning);
  state.records['2026-10-05'].push(state.records['2026-10-05'][0]);
  assert.throws(() => model.validateState(state), /Duplicate/);
});
test('saved checkoffs survive restart, and damaged data is left untouched', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dosenote-store-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'medications.json');
  const store = new Store(file);
  let state = model.addMedication(store.load(), input);
  state = model.toggleDose(state, state.medications[0].id, 1, morning);
  store.save(state);
  assert.deepEqual(new Store(file).load(), state);
  fs.writeFileSync(file, 'damaged');
  assert.throws(() => new Store(file).load(), /left untouched/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'damaged');
});
test('failed save does not report success or change in-memory data', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dosenote-save-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new Store(path.join(directory, 'medications.json'));
  const original = store.load();
  fs.mkdirSync(`${store.file}.tmp`);
  assert.throws(() => store.save(model.addMedication(original, input)));
  assert.deepEqual(store.state, original);
});
