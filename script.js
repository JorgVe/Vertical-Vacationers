// Shared behaviour for the Karwendel Höhenweg site.
// Tracks which topic pages a visitor has opened (per-browser, via localStorage)
// so the home page can grey out icons that have already been "besproken".

// When a subpage is shown inside the home page's topic overlay (an iframe), hide its
// own top nav and footer so only the content shows through the overlay.
if (window.self !== window.top) {
  document.documentElement.classList.add('kw-embedded');
}

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

/* Topics that are external Notion pages: clicking them simply redirects the
 * browser to the page (the <a href> on the node) instead of opening a built-in
 * page or an embedded pop-up. Notion refuses to render inside an <iframe>, so a
 * normal redirect — which uses your logged-in Notion session — is the reliable
 * way in. The URLs live on the links in the HTML; change them there. */
const KW_NOTION_TOPICS = ['packinglist', 'todos'];

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

/* ---------------- Generic page pop-up (home page) ---------------- */
// The "Meer informatie" cards open their page inside an <iframe> overlay instead of
// navigating away, so the whole site reads as one place. The pages stay real,
// standalone URLs too (modifier-click / middle-click still open them in a new tab).
let kwPageLastFocus = null;

function kwOpenPage(e, url, title) {
  if (e) {
    // Let the browser handle new-tab intents (cmd/ctrl/shift/alt or middle click).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return true;
    e.preventDefault();
  }
  const overlay = document.getElementById('pageOverlay');
  const frame = document.getElementById('pageFrame');
  if (!overlay || !frame) {
    if (url) window.location.href = url; // no-JS / missing overlay fallback
    return false;
  }
  const titleEl = document.getElementById('pageOverlayTitle');
  if (titleEl) titleEl.textContent = title || '';
  if (overlay.hidden) {
    kwPageLastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  frame.src = url;
  const sheet = overlay.querySelector('.topic-sheet');
  if (sheet) sheet.focus();
  return false;
}

function kwClosePage() {
  const overlay = document.getElementById('pageOverlay');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
  const frame = document.getElementById('pageFrame');
  if (frame) frame.removeAttribute('src'); // stop the page loading
  if (kwPageLastFocus && typeof kwPageLastFocus.focus === 'function') kwPageLastFocus.focus();
  kwPageLastFocus = null;
}

/** The mountain SVG fills a fixed-ratio box on desktop (no distortion, so the peak
 *  nodes line up), and crops to fill the shorter decorative band on mobile. */
function kwTuneMountain() {
  const svg = document.querySelector('.mt-contour');
  if (!svg) return;
  const mobile = window.matchMedia('(max-width:820px)').matches;
  svg.setAttribute('preserveAspectRatio', mobile ? 'xMidYMax slice' : 'none');
}
window.addEventListener('resize', kwTuneMountain);

/** Reset all visited flags (used by the "reset" link on the home page). */
function kwResetVisited() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KW_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  kwPlaceHiker();
  kwRefreshResetButton();
}

/** True if the visitor has opened at least one topic — i.e. there is progress to reset. */
function kwHasProgress() {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith(KW_PREFIX));
  } catch (e) {
    return false;
  }
}

/** Show the "Voortgang resetten" row only when there is something to reset. */
function kwRefreshResetButton() {
  const row = document.getElementById('resetRow');
  if (row) row.hidden = !kwHasProgress();
}

/** Open/close the in-page 'meer informatie' modal (and any other modal-overlay). */
let kwLastFocus = null;

function kwTrapFocus(e, container) {
  if (e.key !== 'Tab') return;
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function kwOpenModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  kwLastFocus = document.activeElement;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  const card = el.querySelector('.modal-card');
  if (card) {
    el._trap = (e) => kwTrapFocus(e, card);
    el.addEventListener('keydown', el._trap);
    const target = card.querySelector('.modal-close') || card;
    target.focus();
  }
}
function kwCloseModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = true;
  document.body.style.overflow = '';
  if (el._trap) {
    el.removeEventListener('keydown', el._trap);
    el._trap = null;
  }
  if (kwLastFocus && typeof kwLastFocus.focus === 'function') {
    kwLastFocus.focus();
    kwLastFocus = null;
  }
}
/** Toggle the mobile hamburger nav on a subpage topbar. */
function kwToggleNav(btn) {
  const bar = btn.closest('.topbar');
  if (!bar) return;
  const open = bar.classList.toggle('nav-open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function kwCloseNav() {
  document.querySelectorAll('.topbar.nav-open').forEach((bar) => {
    bar.classList.remove('nav-open');
    const btn = bar.querySelector('.nav-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}
// Close the open hamburger menu when clicking anywhere outside a topbar.
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('.topbar')) return;
  kwCloseNav();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not([hidden])').forEach((el) => kwCloseModal(el.id));
    kwCloseNav();
    kwCloseTopic();
    kwClosePage();
  }
});

/* ---------------- Topic pop-up overlay (home page) ---------------- */
// Opening a topic from the home page shows that subpage inside an <iframe> overlay,
// so the whole trip reads as one continuous flow — switch topics with the tabs without
// ever leaving the home page. An iframe (rather than fetch) means this works the same
// whether the site is opened from a web server, GitHub Pages, or a local file.
// The topics stay real, standalone pages too (print booklet, direct links, no-JS).
let kwTopicLastFocus = null;

function kwTopicFromHref(href) {
  if (!href) return null;
  const name = href.split('/').pop().replace('.html', '');
  return KW_HOME_TOPICS.includes(name) ? name : null;
}

function kwOpenTopic(topic) {
  const overlay = document.getElementById('topicOverlay');
  const frame = document.getElementById('topicFrame');
  if (!overlay || !frame) {
    window.location.href = topic + '.html';
    return;
  }

  if (overlay.hidden) {
    kwTopicLastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  kwSetActiveTopicTab(topic);
  frame.src = topic + '.html';
}

/** Highlight the tab for the topic currently shown, and scroll it into view. */
function kwSetActiveTopicTab(topic) {
  const overlay = document.getElementById('topicOverlay');
  if (!overlay) return;
  overlay.querySelectorAll('.topic-tabs button').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.topic === topic ? 'page' : 'false');
  });
  const activeTab = overlay.querySelector('.topic-tabs button[aria-current="page"]');
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// Keep the home page in sync with what the iframe is showing: move the hiker as topics
// get marked visited, and re-highlight the tab if navigation happened inside the frame.
(function () {
  const frame = document.getElementById('topicFrame');
  if (!frame) return;
  frame.addEventListener('load', () => {
    try {
      kwPlaceHiker();
      const path = frame.contentWindow.location.pathname.split('/').pop().replace('.html', '');
      if (KW_HOME_TOPICS.includes(path)) kwSetActiveTopicTab(path);
    } catch (e) { /* cross-origin or not ready — ignore */ }
  });
})();

function kwCloseTopic() {
  const overlay = document.getElementById('topicOverlay');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
  const frame = document.getElementById('topicFrame');
  if (frame) frame.removeAttribute('src'); // stop the page (and any Komoot map) loading
  if (kwTopicLastFocus && typeof kwTopicLastFocus.focus === 'function') {
    kwTopicLastFocus.focus();
  }
  kwTopicLastFocus = null;
}

// Intercept home-page topic links (mountain nodes and the mobile list) so they open in
// the overlay instead of navigating. Modifier-clicks and middle-clicks fall through to
// normal browser behaviour (open in new tab).
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest('.mt-node, .mt-list a');
  if (!link) return;
  // Prefer an explicit data-topic (the Notion topics point href at Notion itself).
  const topic = link.getAttribute('data-topic') || kwTopicFromHref(link.getAttribute('href'));
  if (!topic) return;
  if (KW_NOTION_TOPICS.includes(topic)) {
    kwMarkVisited(topic); // record the visit, then let the browser follow the href (redirect)
    return;
  }
  if (!KW_HOME_TOPICS.includes(topic)) return;
  e.preventDefault();
  kwOpenTopic(topic);
});

/** The topic pages compiled into the printable booklet, in reading order.
 *  (Paklijst and To do's now live in Notion, so they're not part of the booklet.) */
const KW_BOOKLET_PAGES = ['drive.html', 'hotels.html', 'hike.html'];

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
  // The label may live in a child span (card layout) so we don't wipe the icon.
  const label = btn ? (btn.querySelector('.btn-label') || btn) : null;
  if (!container) return;

  if (btn) btn.disabled = true;
  if (label) label.textContent = 'Boekje wordt samengesteld…';

  try {
    const sections = [];
    for (const url of KW_BOOKLET_PAGES) {
      sections.push(await kwBuildBookletSection(url));
    }
    container.innerHTML =
      '<section class="booklet-cover">' +
      '<div class="booklet-cover-kicker">Schnapps and Schnitzels</div>' +
      '<h1>Karwendel Höhenweg</h1>' +
      '<div class="booklet-cover-dates">16 – 23 augustus 2026</div>' +
      '</section>' +
      sections.join('');
    window.print();
  } catch (e) {
    alert('Kon het boekje niet samenstellen. Dit werkt alleen als de site online staat, niet als je index.html lokaal als bestand opent.');
  } finally {
    if (btn) btn.disabled = false;
    if (label) label.textContent = 'Print reisboekje';
  }
}
