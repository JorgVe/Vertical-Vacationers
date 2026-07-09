// Shared behaviour for the Karwendel Höhenweg site.
// Tracks which topic pages a visitor has opened (per-browser, via localStorage)
// so the home page can grey out icons that have already been "besproken".

const KW_PREFIX = 'kw2026_visited_';

/** Call this on a subpage to mark its topic as visited. */
function kwMarkVisited(topic) {
  try {
    localStorage.setItem(KW_PREFIX + topic, '1');
  } catch (e) {
    /* localStorage unavailable (e.g. private mode) — fail silently */
  }
}

/** Countdown to the start of the hike: 18 August 2026, 08:00 local time. */
const KW_SURPRISE_TIME = new Date(2026, 7, 18, 8, 0, 0).getTime();

function kwFormatCountdown(ms) {
  if (ms <= 0) return 'Nu beschikbaar!';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)} tot de start`;
}

/** Call this on the home page to start a live (no-refresh) countdown to the hike. */
function kwStartCountdown() {
  const el = document.getElementById('surpriseCountdown');
  if (!el) return;
  const tick = () => {
    el.textContent = kwFormatCountdown(KW_SURPRISE_TIME - Date.now());
  };
  tick();
  setInterval(tick, 1000);
}

/** Ordered topics along the home page mountain ridge. */
const KW_HOME_TOPICS = ['drive', 'hotels', 'hike', 'packinglist', 'todos'];

/** Hiker position for 0..5 topics visited — points along the ridge between the
 *  peaks (not directly under any icon), so the hiker reads as walking the trail. */
const KW_HIKER_STEPS = [
  { left: 2.5,  top: 71.8 },
  { left: 18.8, top: 59.7 },
  { left: 39.6, top: 49.4 },
  { left: 60.4, top: 37.7 },
  { left: 81.3, top: 54.4 },
  { left: 96.7, top: 68.8 },
];

/** Call this on the home page to walk the hiker to the next unvisited peak. */
function kwPlaceHiker() {
  const hiker = document.getElementById('hikerMarker');
  if (!hiker) return;
  let count = 0;
  KW_HOME_TOPICS.forEach((topic) => {
    try {
      if (localStorage.getItem(KW_PREFIX + topic) === '1') count++;
    } catch (e) { /* ignore */ }
  });
  const step = KW_HIKER_STEPS[count];
  hiker.style.left = step.left + '%';
  hiker.style.top = step.top + '%';
  hiker.classList.toggle('arrived', count >= KW_HOME_TOPICS.length);
}

/** Reset all visited flags (used by the "reset" link on the home page). */
function kwResetVisited() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KW_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  kwPlaceHiker();
}

/** Open/close the in-page 'meer informatie' modal (and any other modal-overlay). */
function kwOpenModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
}
function kwCloseModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not([hidden])').forEach((el) => { el.hidden = true; });
    document.body.style.overflow = '';
  }
});

/** Simple persisted checkbox lists (packing list / to-do's). */
function kwInitChecklist(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const items = list.querySelectorAll('input[type="checkbox"][data-key]');
  items.forEach((box) => {
    const key = 'kw2026_check_' + listId + '_' + box.getAttribute('data-key');
    try {
      box.checked = localStorage.getItem(key) === '1';
    } catch (e) { /* ignore */ }
    box.closest('.check-item').classList.toggle('checked', box.checked);
    box.addEventListener('change', () => {
      try {
        localStorage.setItem(key, box.checked ? '1' : '0');
      } catch (e) { /* ignore */ }
      box.closest('.check-item').classList.toggle('checked', box.checked);
    });
  });
  kwInitCustomItems(listId);
}

/** Custom items a visitor added to a checklist (per list, stored per browser). */
function kwCustomItemsKey(listId) {
  return 'kw2026_custom_' + listId;
}

function kwLoadCustomItems(listId) {
  try {
    return JSON.parse(localStorage.getItem(kwCustomItemsKey(listId)) || '[]');
  } catch (e) {
    return [];
  }
}

function kwSaveCustomItems(listId, items) {
  try {
    localStorage.setItem(kwCustomItemsKey(listId), JSON.stringify(items));
  } catch (e) { /* ignore */ }
}

function kwRenderCustomItem(listId, item) {
  const list = document.getElementById(listId);
  if (!list) return;

  const li = document.createElement('li');
  li.className = 'check-item custom-item';

  const box = document.createElement('input');
  box.type = 'checkbox';
  box.id = listId + '-' + item.key;
  box.dataset.key = item.key;

  const label = document.createElement('label');
  label.setAttribute('for', box.id);
  label.textContent = item.text;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-item-btn';
  removeBtn.setAttribute('aria-label', 'Verwijderen');
  removeBtn.textContent = '✕';

  li.append(box, label, removeBtn);

  const checkKey = 'kw2026_check_' + listId + '_' + item.key;
  try {
    box.checked = localStorage.getItem(checkKey) === '1';
  } catch (e) { /* ignore */ }
  li.classList.toggle('checked', box.checked);

  box.addEventListener('change', () => {
    try {
      localStorage.setItem(checkKey, box.checked ? '1' : '0');
    } catch (e) { /* ignore */ }
    li.classList.toggle('checked', box.checked);
  });

  removeBtn.addEventListener('click', () => {
    li.remove();
    kwSaveCustomItems(listId, kwLoadCustomItems(listId).filter((i) => i.key !== item.key));
    try {
      localStorage.removeItem(checkKey);
    } catch (e) { /* ignore */ }
  });

  list.appendChild(li);
}

/** Render any custom items a visitor previously added to this list. */
function kwInitCustomItems(listId) {
  kwLoadCustomItems(listId).forEach((item) => kwRenderCustomItem(listId, item));
}

/** Add a new item to a checklist from its 'add item' input. */
function kwAddChecklistItem(listId, inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const item = { key: 'custom' + Date.now().toString(36), text };
  kwSaveCustomItems(listId, [...kwLoadCustomItems(listId), item]);
  kwRenderCustomItem(listId, item);
  input.value = '';
  input.focus();
}

/** The 5 topic pages compiled into the printable booklet, in reading order. */
const KW_BOOKLET_PAGES = ['drive.html', 'hotels.html', 'hike.html', 'packinglist.html', 'todos.html'];

/** Fetch one topic page and turn its header + content into a booklet section. */
async function kwBuildBookletSection(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Kon ' + url + ' niet laden (status ' + res.status + ')');
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

  const header = doc.querySelector('.page-header');
  const main = doc.querySelector('.page-main');
  if (!main) return '';

  // Strip anything that doesn't make sense on paper: live maps, add-item forms.
  main.querySelectorAll('.komoot-embed, form.add-item-row').forEach((el) => el.remove());

  const eyebrow = header && header.querySelector('.eyebrow');
  const h1 = header && header.querySelector('h1');
  const intro = header && header.querySelector('p');

  return (
    '<section class="booklet-page">' +
    '<div class="booklet-heading">' +
    (eyebrow ? '<div class="booklet-eyebrow">' + eyebrow.textContent + '</div>' : '') +
    '<h1>' + (h1 ? h1.textContent : '') + '</h1>' +
    (intro ? '<p class="booklet-intro">' + intro.innerHTML + '</p>' : '') +
    '</div>' +
    main.innerHTML +
    '</section>'
  );
}

/** Compile the 5 topic pages into one printable booklet, then open the print dialog. */
async function kwPrintBooklet() {
  const container = document.getElementById('printBooklet');
  const btn = document.querySelector('.print-btn');
  if (!container) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Boekje wordt samengesteld…';
  }

  try {
    const sections = [];
    for (const url of KW_BOOKLET_PAGES) {
      sections.push(await kwBuildBookletSection(url));
    }
    container.innerHTML =
      '<section class="booklet-cover">' +
      '<div class="booklet-cover-kicker">Vertical Vacationers</div>' +
      '<h1>Karwendel Höhenweg</h1>' +
      '<div class="booklet-cover-dates">16 – 23 augustus 2026</div>' +
      '</section>' +
      sections.join('');
    window.print();
  } catch (e) {
    alert('Kon het boekje niet samenstellen. Dit werkt alleen als de site online staat, niet als je index.html lokaal als bestand opent.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Print reisboekje';
    }
  }
}
