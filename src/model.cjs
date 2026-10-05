const { randomUUID } = require('node:crypto');

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyState() {
  return { version: 1, medications: [], records: {} };
}

function medicationInput(input) {
  if (!input || typeof input !== 'object') throw new Error('Enter medication details.');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const amount = typeof input.amount === 'string' ? input.amount.trim() : '';
  if (!name || name.length > 100) throw new Error('Enter a medication name (up to 100 characters).');
  if (!amount || amount.length > 100) throw new Error('Enter an amount, such as “1 tablet · 10 mg”.');
  if (!['daily', 'weekly', 'as-needed'].includes(input.frequency)) throw new Error('Choose a frequency.');
  const doses = Number(input.doses);
  if (!Number.isInteger(doses) || doses < 1 || doses > 6) throw new Error('Choose 1 to 6 doses.');
  const weekdays = [...new Set(input.weekdays || [])];
  if (input.frequency === 'weekly' && (!weekdays.length || weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6))) {
    throw new Error('Choose at least one day of the week.');
  }
  return { name, amount, frequency: input.frequency, doses: input.frequency === 'as-needed' ? 1 : doses, weekdays: input.frequency === 'weekly' ? weekdays : [] };
}

function addMedication(state, input) {
  if (state.medications.length >= 100) throw new Error('You can save up to 100 medications.');
  const details = medicationInput(input);
  return { ...state, medications: [...state.medications, { ...details, id: randomUUID(), createdOn: dayKey() }] };
}

function editMedication(state, id, input) {
  const existing = state.medications.find(m => m.id === id);
  if (!existing) throw new Error('Medication was not found.');
  const details = medicationInput(input);
  // Keep the previous version for doses already recorded today.
  const records = { ...state.records };
  for (const [date, entries] of Object.entries(records)) {
    records[date] = entries.map(entry => entry.id === id && !entry.medication ? { ...entry, medication: existing } : entry);
  }
  return { ...state, records, medications: state.medications.map(m => m.id === id ? { ...m, ...details } : m) };
}

function removeMedication(state, id) {
  if (!state.medications.some(m => m.id === id)) throw new Error('Medication was not found.');
  return { ...state, medications: state.medications.filter(m => m.id !== id) };
}

function dueOn(medication, date = new Date()) {
  return medication.frequency !== 'weekly' || medication.weekdays.includes(date.getDay());
}

function toggleDose(state, id, dose, now = new Date()) {
  const medication = state.medications.find(m => m.id === id);
  if (!medication) throw new Error('Medication was not found.');
  if (!Number.isInteger(dose) || dose < 0 || dose >= medication.doses || !dueOn(medication, now)) throw new Error('This dose is not scheduled today.');
  const date = dayKey(now);
  const entries = state.records[date] || [];
  const found = entries.some(entry => entry.id === id && entry.dose === dose);
  const next = found ? entries.filter(entry => entry.id !== id || entry.dose !== dose) : [...entries, { id, dose, takenAt: now.toISOString(), medication: { ...medication } }];
  return { ...state, records: { ...state.records, [date]: next } };
}

function validateState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.medications) || state.medications.length > 100 || !state.records || Array.isArray(state.records) || typeof state.records !== 'object') throw new Error('This file is not a DoseNote backup.');
  const ids = new Set();
  for (const med of state.medications) {
    medicationInput(med);
    if (typeof med.id !== 'string' || !med.id || ids.has(med.id)) throw new Error('Invalid medication identifiers.');
    ids.add(med.id);
  }
  for (const [date, entries] of Object.entries(state.records)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entries)) throw new Error('Invalid medication history.');
    const keys = new Set();
    for (const entry of entries) {
      if (typeof entry.id !== 'string' || !Number.isInteger(entry.dose) || entry.dose < 0 || entry.dose > 5 || typeof entry.takenAt !== 'string' || !Number.isFinite(Date.parse(entry.takenAt)) || !entry.medication || entry.medication.id !== entry.id) throw new Error('Invalid dose record.');
      medicationInput(entry.medication);
      if (keys.has(`${entry.id}:${entry.dose}`)) throw new Error('Duplicate dose record.');
      keys.add(`${entry.id}:${entry.dose}`);
    }
  }
  return state;
}

module.exports = { dayKey, emptyState, medicationInput, addMedication, editMedication, removeMedication, dueOn, toggleDose, validateState };
