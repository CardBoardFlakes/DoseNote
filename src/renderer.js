const $ = id => document.getElementById(id);
let state;
let editingId = null;
let pending = false;
let toastTimer;
let renderedDay;
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const timeLabel = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function notify(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').className = `toast${error ? ' error-toast' : ''}`;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 10000 : 3500);
}
async function request(operation) {
  const result = await operation;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
async function mutate(operation, message) {
  if (pending) return false;
  pending = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { state = await request(operation()); render(); notify(message); return true; }
  catch (error) { notify(error.message, true); return false; }
  finally { pending = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
}
function showTab(tab) {
  for (const name of ['today', 'settings']) {
    $(`${name}-panel`).hidden = name !== tab;
    if (name === tab) $(`${name}-tab`).setAttribute('aria-current', 'page');
    else $(`${name}-tab`).removeAttribute('aria-current');
  }
}
function frequencyLabel(med) {
  if (med.frequency === 'as-needed') return 'As needed · one checkoff per day';
  const days = med.frequency === 'weekly' ? [...med.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => weekdayNames[d]).join(', ') : 'Every day';
  return `${days} · ${med.doses === 1 ? 'once a day' : `${med.doses} doses a day`}`;
}
function sectionHeading(title, count, note) {
  const heading = element('div', 'section-heading');
  heading.append(element('h2', '', title), element('span', 'count-badge', String(count)));
  if (note) heading.append(element('span', 'section-note', note));
  return heading;
}
function medicationCard(med, records) {
  const complete = Array.from({ length: med.doses }, (_, dose) => records.some(r => r.id === med.id && r.dose === dose)).every(Boolean);
  const card = element('article', `medication-card${complete ? ' complete' : ''}`);
  const icon = element('span', 'med-icon', '✦');
  icon.setAttribute('aria-hidden', 'true');
  const info = element('div', 'med-info');
  info.append(element('h3', '', med.name), element('p', '', med.amount), element('p', '', frequencyLabel(med)));
  const actions = element('div', 'dose-actions');
  for (let dose = 0; dose < med.doses; dose++) {
    const record = records.find(r => r.id === med.id && r.dose === dose);
    const button = element('button', 'dose-button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(Boolean(record)));
    button.setAttribute('aria-label', `${med.name}, dose ${dose + 1}: ${record ? 'taken; click to undo' : 'mark as taken'}`);
    const check = element('span', 'check', record ? '✓' : '');
    check.setAttribute('aria-hidden', 'true');
    button.append(check, document.createTextNode(med.doses === 1 ? (record ? 'Taken' : 'Mark as taken') : `${record ? 'Taken' : 'Mark taken'} · dose ${dose + 1}`));
    if (record) button.append(element('span', 'taken-time', timeLabel(record.takenAt)));
    button.addEventListener('click', async () => {
      const success = await mutate(() => window.doseNote.toggle(med.id, dose), record ? 'Checkoff undone.' : `${med.name} marked as taken.`);
      if (success) document.querySelectorAll('.dose-button').forEach(b => { if (b.getAttribute('aria-label').startsWith(`${med.name}, dose ${dose + 1}:`)) b.focus(); });
    });
    actions.append(button);
  }
  card.append(icon, info, actions);
  return card;
}
function renderToday() {
  const now = new Date();
  renderedDay = localDay(now);
  $('today-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const records = state.records[renderedDay] || [];
  const due = state.medications.filter(m => m.frequency !== 'as-needed' && (m.frequency === 'daily' || m.weekdays.includes(now.getDay())));
  const optional = state.medications.filter(m => m.frequency === 'as-needed');
  const total = due.reduce((sum, m) => sum + m.doses, 0);
  const taken = due.reduce((sum, m) => sum + Array.from({ length: m.doses }, (_, dose) => records.some(r => r.id === m.id && r.dose === dose)).filter(Boolean).length, 0);
  const percent = total ? Math.round(taken / total * 100) : 0;
  $('progress-text').textContent = total ? `${taken} of ${total} doses taken` : 'No scheduled doses today';
  $('progress-caption').textContent = total && taken === total ? 'All scheduled doses checked off for today.' : total ? 'Your checkoffs are saved as you go.' : optional.length ? 'You can still record an as-needed medication below.' : 'Your checklist will appear on the days you selected.';
  $('progress-number').textContent = `${percent}%`;
  $('progress-bar').value = percent;
  $('progress').hidden = !state.medications.length;
  $('empty-state').hidden = Boolean(state.medications.length);
  $('daily-list').replaceChildren();
  $('as-needed-list').replaceChildren();
  if (due.length) {
    $('daily-list').append(sectionHeading('Scheduled today', due.length, 'Check off after taking'));
    due.forEach(med => $('daily-list').append(medicationCard(med, records)));
  } else if (state.medications.length) $('daily-list').append(element('p', 'muted', 'Your scheduled medications will appear on their selected days.'));
  if (optional.length) {
    $('as-needed-list').append(sectionHeading('As needed', optional.length, 'Excluded from daily progress'));
    optional.forEach(med => $('as-needed-list').append(medicationCard(med, records)));
  }
  renderHistory(now);
}
function renderHistory(now) {
  $('history-list').replaceChildren();
  let count = 0;
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const entries = state.records[localDay(date)] || [];
    if (!entries.length) continue;
    count += entries.length;
    const group = element('div', 'history-group');
    group.append(element('h3', '', offset === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })));
    entries.slice().sort((a, b) => a.takenAt.localeCompare(b.takenAt)).forEach(entry => {
      const med = entry.medication;
      const row = element('div', 'history-row');
      row.append(element('span', '', `${med.name} · ${med.amount}${med.doses > 1 ? ` · dose ${entry.dose + 1}` : ''}`), element('span', '', timeLabel(entry.takenAt)));
      group.append(row);
    });
    $('history-list').append(group);
  }
  if (!count) $('history-list').append(element('p', 'muted', 'Your taken doses will appear here.'));
}
function renderSettings() {
  $('medication-count').textContent = state.medications.length;
  $('saved-list').replaceChildren();
  if (!state.medications.length) $('saved-list').append(element('p', 'muted', 'No medications yet. Add your first one using the form.'));
  for (const med of state.medications) {
    const card = element('article', 'saved-med');
    card.append(element('h3', '', med.name), element('p', '', med.amount), element('p', '', frequencyLabel(med)));
    const actions = element('div', 'saved-actions');
    const edit = element('button', '', 'Edit');
    edit.setAttribute('aria-label', `Edit ${med.name}`);
    edit.onclick = () => startEdit(med);
    const remove = element('button', '', 'Remove');
    remove.setAttribute('aria-label', `Remove ${med.name}`);
    remove.onclick = () => confirmRemoval(med);
    actions.append(edit, remove);
    card.append(actions);
    $('saved-list').append(card);
  }
}
function render() { renderToday(); renderSettings(); }
function frequencyChanged() {
  $('doses-field').hidden = $('frequency').value === 'as-needed';
  $('as-needed-hint').hidden = $('frequency').value !== 'as-needed';
  $('weekdays-field').hidden = $('frequency').value !== 'weekly';
}
function resetForm() {
  editingId = null;
  $('medication-form').reset();
  $('form-title').textContent = 'Add a medication';
  $('save-medication').textContent = 'Add medication';
  $('cancel-edit').hidden = true;
  $('form-error').hidden = true;
  frequencyChanged();
}
function startEdit(med) {
  editingId = med.id;
  $('name').value = med.name;
  $('amount').value = med.amount;
  $('frequency').value = med.frequency;
  $('doses').value = med.doses;
  document.querySelectorAll('#weekdays-field input').forEach(input => { input.checked = med.weekdays.includes(Number(input.value)); });
  $('form-title').textContent = 'Edit medication';
  $('save-medication').textContent = 'Save changes';
  $('cancel-edit').hidden = false;
  $('form-error').hidden = true;
  frequencyChanged();
  $('name').focus();
}
function confirmRemoval(med) {
  $('confirm-message').textContent = `Remove ${med.name} from your routine?`;
  $('confirm-dialog').showModal();
  $('confirm-cancel').focus();
  $('confirm-remove').onclick = async () => {
    $('confirm-dialog').close();
    if (await mutate(() => window.doseNote.remove(med.id), 'Medication removed.')) {
      if (editingId === med.id) resetForm();
      $('name').focus();
    }
  };
}
$('today-tab').onclick = () => showTab('today');
$('settings-tab').onclick = () => showTab('settings');
$('manage-button').onclick = () => showTab('settings');
$('first-medication').onclick = () => { showTab('settings'); $('name').focus(); };
$('frequency').onchange = frequencyChanged;
$('cancel-edit').onclick = resetForm;
$('confirm-cancel').onclick = () => $('confirm-dialog').close();
$('medication-form').onsubmit = async event => {
  event.preventDefault();
  if (pending) return;
  const input = { name: $('name').value.trim(), amount: $('amount').value.trim(), frequency: $('frequency').value, doses: Number($('doses').value), weekdays: [...document.querySelectorAll('#weekdays-field input:checked')].map(input => Number(input.value)) };
  if (!input.name || !input.amount || input.frequency === 'weekly' && !input.weekdays.length) {
    $('form-error').textContent = input.frequency === 'weekly' && !input.weekdays.length ? 'Choose at least one day of the week.' : 'Enter a name and amount.';
    $('form-error').hidden = false;
    return;
  }
  const success = await mutate(() => editingId ? window.doseNote.edit(editingId, input) : window.doseNote.add(input), editingId ? 'Medication updated.' : 'Medication added. Your checklist is ready.');
  if (success) { resetForm(); $('name').focus(); }
};
$('export-backup').onclick = async () => {
  try { if (await request(window.doseNote.exportBackup())) notify('Backup saved.'); }
  catch (error) { notify(error.message, true); }
};
$('import-backup').onclick = async () => {
  try { const restored = await request(window.doseNote.importBackup()); if (restored) { state = restored; resetForm(); render(); notify('Backup restored.'); } }
  catch (error) { notify(error.message, true); }
};
async function initialize() {
  try { state = await request(window.doseNote.load()); render(); }
  catch (error) {
    $('today-panel').hidden = true;
    $('settings-panel').hidden = true;
    $('fatal-error').hidden = false;
    $('fatal-message').textContent = error.message;
    document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  }
}
setInterval(() => { if (state && !pending && localDay() !== renderedDay) renderToday(); }, 1000);
window.addEventListener('focus', () => { if (state && !pending) renderToday(); });
initialize();
