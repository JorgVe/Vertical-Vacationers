// "Leer ons kennen" — shared profile cards for the six hikers.
//
// Each person fills in their own card; everyone can read all six. Data lives in a
// small Supabase database so an update by one person is visible to the others.
// Editing is protected by a personal PIN that is checked *server-side* (see
// SUPABASE_SETUP.md) — the PINs are never sent to or stored in the browser.
//
// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG — paste your Supabase project details here (see SUPABASE_SETUP.md).
//  Both values are safe to publish: the anon key only works together with the
//  database's row-level-security rules, which forbid editing without a valid PIN.
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vnykifzufcupspmnsvhy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueWtpZnp1ZmN1cHNwbW5zdmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzY1ODgsImV4cCI6MjA5OTM1MjU4OH0.TEt2dRGxjm8hWjUqwekbNBBwYAQYhHl7y6k78pVIg1k';
// ─────────────────────────────────────────────────────────────────────────────

/** The six hikers, in the order their cards appear. Must match the names seeded
 *  into the database (profiles + profile_pins tables). */
const KW_PEOPLE = ['Jorg', 'Sara', 'Freddie', 'Layla', 'Ward', 'Charlotte'];

/** The fields on each card, in display + form order. `type` drives the input used
 *  in the edit form; `select` fields render a dropdown from `options`. To add or
 *  change a field, edit this list — nothing else needs to change. */
const KW_PROFILE_FIELDS = [
  { key: 'bio',      label: 'Over mij',                     type: 'textarea', placeholder: 'Vertel kort iets over jezelf…' },
  { key: 'tempo',    label: 'Mijn tempo',                   type: 'select',   options: ['Rustig aan', 'Gemiddeld', 'Stevig doorstappen'] },
  { key: 'ervaring', label: 'Wandelervaring',               type: 'text',     placeholder: 'Bijv. eerste meerdaagse / af en toe / veel' },
  { key: 'dieet',    label: 'Dieet & allergieën',           type: 'text',     placeholder: 'Bijv. vegetarisch, notenallergie…' },
  { key: 'medisch',  label: 'Goed om te weten',             type: 'text',     placeholder: 'Bijv. gevoelige knieën, hoogtevrees, blaren…' },
  { key: 'meenemen', label: 'Wat ik meeneem voor de groep', type: 'text',     placeholder: 'Bijv. EHBO-kit, kaart, powerbank…' },
  { key: 'snurk',    label: 'Snurk-alarm (voor de dorms)',  type: 'select',   options: ['Nee', 'Een beetje', 'Ja — neem oordoppen mee 😴'] },
];

/** True once the CONFIG block above has real values. */
function kwProfilesConfigured() {
  return SUPABASE_URL.startsWith('https://') &&
         SUPABASE_ANON_KEY &&
         SUPABASE_ANON_KEY !== 'PASTE_YOUR_ANON_KEY_HERE';
}

/* ---------------- Supabase REST / RPC helpers ---------------- */

function kwSbHeaders() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
}

/** Load every profile row. Returns a map of name → { data, updated_at }. */
async function kwLoadProfiles() {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?select=name,data,updated_at',
    { headers: kwSbHeaders() }
  );
  if (!res.ok) throw new Error('Kon profielen niet laden (status ' + res.status + ')');
  const rows = await res.json();
  const map = {};
  rows.forEach((row) => { map[row.name] = { data: row.data || {}, updated_at: row.updated_at }; });
  return map;
}

/** Ask the database whether this PIN is correct for this person (server-side check). */
async function kwVerifyPin(name, pin) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/verify_pin', {
    method: 'POST',
    headers: kwSbHeaders(),
    body: JSON.stringify({ p_name: name, p_pin: pin }),
  });
  if (!res.ok) throw new Error('Verbinding mislukt (status ' + res.status + ')');
  return (await res.json()) === true;
}

/** Save a person's profile. The database re-checks the PIN and rejects a wrong one. */
async function kwSaveProfile(name, pin, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/save_profile', {
    method: 'POST',
    headers: kwSbHeaders(),
    body: JSON.stringify({ p_name: name, p_pin: pin, p_data: data }),
  });
  if (!res.ok) {
    let msg = 'Opslaan mislukt (status ' + res.status + ')';
    try { const body = await res.json(); if (body && body.message) msg = body.message; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
}

/* ---------------- Rendering ---------------- */

const kwProfileState = { profiles: {}, editing: null, unlocked: false };

function kwEscape(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Format an ISO timestamp as e.g. "3 juli 2026". */
function kwFormatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
}

/** Build the read-only body of one person's card. */
function kwRenderCardBody(name) {
  const entry = kwProfileState.profiles[name] || { data: {}, updated_at: null };
  const data = entry.data || {};
  const filled = KW_PROFILE_FIELDS.filter((f) => (data[f.key] || '').toString().trim());

  if (!filled.length) {
    return '<p class="profile-empty">Nog niets ingevuld. ' +
           kwEscape(name) + ' kan hier straks iets over zichzelf kwijt.</p>';
  }

  const rows = filled.map((f) =>
    '<div class="profile-field">' +
      '<dt>' + kwEscape(f.label) + '</dt>' +
      '<dd>' + kwEscape(data[f.key]).replace(/\n/g, '<br>') + '</dd>' +
    '</div>'
  ).join('');

  const stamp = entry.updated_at
    ? '<p class="profile-updated">Bijgewerkt op ' + kwEscape(kwFormatDate(entry.updated_at)) + '</p>'
    : '';

  return '<dl class="profile-fields">' + rows + '</dl>' + stamp;
}

/** (Re)render all six cards into the grid. */
function kwRenderProfiles() {
  const grid = document.getElementById('profileGrid');
  if (!grid) return;
  grid.innerHTML = KW_PEOPLE.map((name) =>
    '<article class="profile-card" data-name="' + kwEscape(name) + '">' +
      '<div class="profile-card-head">' +
        '<span class="profile-avatar" aria-hidden="true">' + kwEscape(name.charAt(0)) + '</span>' +
        '<h2>' + kwEscape(name) + '</h2>' +
      '</div>' +
      '<div class="profile-card-body">' + kwRenderCardBody(name) + '</div>' +
      '<button type="button" class="profile-edit-btn" onclick="kwOpenProfileEditor(\'' + kwEscape(name) + '\')">' +
        'Bewerk mijn kaart' +
      '</button>' +
    '</article>'
  ).join('');
}

/* ---------------- Edit modal ---------------- */

/** Open the edit modal for one person: first a PIN gate, then the form. */
function kwOpenProfileEditor(name) {
  if (!KW_PEOPLE.includes(name)) return;
  kwProfileState.editing = name;
  kwProfileState.unlocked = false;
  kwRenderEditor();
  kwOpenModal('profileModal');
  const pin = document.getElementById('profilePin');
  if (pin) pin.focus();
}

/** Render the modal contents for the current editing state (locked → PIN, unlocked → form). */
function kwRenderEditor() {
  const modal = document.getElementById('profileModalBody');
  const name = kwProfileState.editing;
  if (!modal || !name) return;

  if (!kwProfileState.unlocked) {
    modal.innerHTML =
      '<h2>Hoi ' + kwEscape(name) + '!</h2>' +
      '<p class="modal-text">Vul je persoonlijke pincode in om je eigen kaart te bewerken. ' +
        'Alleen jij kunt jouw kaart aanpassen; de anderen kunnen \'m wel lezen.</p>' +
      '<form class="profile-pin-form" id="profilePinForm" autocomplete="off">' +
        '<input type="password" inputmode="numeric" class="profile-input" id="profilePin" ' +
          'placeholder="Pincode" aria-label="Pincode" autocomplete="off">' +
        '<button type="submit" class="profile-save-btn">Ontgrendel</button>' +
      '</form>' +
      '<p class="profile-error" id="profileError" hidden></p>';
    const form = document.getElementById('profilePinForm');
    if (form) form.addEventListener('submit', kwHandlePinSubmit);
    return;
  }

  const data = (kwProfileState.profiles[name] || {}).data || {};
  const fields = KW_PROFILE_FIELDS.map((f) => {
    const val = data[f.key] || '';
    let input;
    if (f.type === 'textarea') {
      input = '<textarea class="profile-input" id="pf-' + f.key + '" rows="3" ' +
              'placeholder="' + kwEscape(f.placeholder || '') + '">' + kwEscape(val) + '</textarea>';
    } else if (f.type === 'select') {
      const opts = ['<option value="">— kies —</option>'].concat(
        f.options.map((o) => '<option value="' + kwEscape(o) + '"' +
          (o === val ? ' selected' : '') + '>' + kwEscape(o) + '</option>')
      ).join('');
      input = '<select class="profile-input" id="pf-' + f.key + '">' + opts + '</select>';
    } else {
      input = '<input type="text" class="profile-input" id="pf-' + f.key + '" ' +
              'placeholder="' + kwEscape(f.placeholder || '') + '" value="' + kwEscape(val) + '">';
    }
    return '<label class="profile-form-field"><span>' + kwEscape(f.label) + '</span>' + input + '</label>';
  }).join('');

  modal.innerHTML =
    '<h2>Jouw kaart, ' + kwEscape(name) + '</h2>' +
    '<form class="profile-form" id="profileForm">' + fields +
      '<div class="profile-form-actions">' +
        '<button type="button" class="profile-cancel-btn" onclick="kwCloseModal(\'profileModal\')">Annuleren</button>' +
        '<button type="submit" class="profile-save-btn" id="profileSaveBtn">Opslaan</button>' +
      '</div>' +
      '<p class="profile-error" id="profileError" hidden></p>' +
    '</form>';
  const form = document.getElementById('profileForm');
  if (form) form.addEventListener('submit', kwHandleProfileSubmit);
}

function kwShowError(msg) {
  const el = document.getElementById('profileError');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

async function kwHandlePinSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('profilePin');
  const name = kwProfileState.editing;
  const pin = (input.value || '').trim();
  if (!pin) return;

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Controleren…'; }
  try {
    const ok = await kwVerifyPin(name, pin);
    if (!ok) {
      kwShowError('Onjuiste pincode. Probeer het opnieuw.');
      if (btn) { btn.disabled = false; btn.textContent = 'Ontgrendel'; }
      input.select();
      return;
    }
    kwProfileState.unlocked = true;
    kwProfileState.pin = pin; // kept in memory only, for the save call
    kwRenderEditor();
  } catch (err) {
    kwShowError(err.message || 'Er ging iets mis.');
    if (btn) { btn.disabled = false; btn.textContent = 'Ontgrendel'; }
  }
}

async function kwHandleProfileSubmit(e) {
  e.preventDefault();
  const name = kwProfileState.editing;
  const data = {};
  KW_PROFILE_FIELDS.forEach((f) => {
    const el = document.getElementById('pf-' + f.key);
    if (el) data[f.key] = (el.value || '').trim();
  });

  const btn = document.getElementById('profileSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Opslaan…'; }
  try {
    await kwSaveProfile(name, kwProfileState.pin, data);
    kwProfileState.profiles[name] = { data, updated_at: new Date().toISOString() };
    kwRenderProfiles();
    kwCloseModal('profileModal');
  } catch (err) {
    kwShowError(err.message || 'Opslaan mislukt.');
    if (btn) { btn.disabled = false; btn.textContent = 'Opslaan'; }
  }
}

/* ---------------- Page init ---------------- */

async function kwInitProfiles() {
  const grid = document.getElementById('profileGrid');
  const notice = document.getElementById('profileNotice');
  if (!grid) return;

  if (!kwProfilesConfigured()) {
    if (notice) notice.hidden = false;
    kwRenderProfiles(); // still show the six empty cards as a preview
    grid.querySelectorAll('.profile-edit-btn').forEach((b) => { b.disabled = true; });
    return;
  }

  kwRenderProfiles(); // instant empty cards while the data loads
  try {
    kwProfileState.profiles = await kwLoadProfiles();
    kwRenderProfiles();
  } catch (err) {
    if (notice) {
      notice.hidden = false;
      const span = notice.querySelector('span');
      if (span) span.innerHTML = '⚠ De profielen konden niet geladen worden: ' + kwEscape(err.message);
    }
  }
}
