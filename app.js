/**
 * Card contract — every card object passed to dashboard.register() must have:
 *
 *   id        {string}  Unique slug. Used as DOM id: card-{id}, card-body-{id}.
 *   title     {string|null}  Label shown above the card. null = no label.
 *   className {string}  Extra CSS class(es). Use 'card--wide' (2 cols),
 *                       'card--full' (full row), or 'card--tall' (2 rows).
 *   render()  {fn → string}  Returns the initial inner HTML (static or loading state).
 *   start()   {fn}      Called once after all cards are in the DOM. Wire up
 *                       event listeners, kick off fetches, start intervals here.
 *
 * Card order in index.html controls grid placement (earlier = top-left).
 * All per-card config is stored in localStorage as dashboard-{card-id}-{setting}.
 */
const ACCENTS = ['#7c8dff', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15'];

const SEARCH_ENGINES = {
  google: { name: 'Google',     url: 'https://www.google.com/search' },
  ddg:    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/' },
  kagi:   { name: 'Kagi',       url: 'https://kagi.com/search' },
  bing:   { name: 'Bing',       url: 'https://www.bing.com/search' },
};

const dashboard = {
  cards: [],

  register(card) {
    this.cards.push(card);
  },

  // Escapes text pulled from external APIs (HN/Reddit post titles, calendar
  // event summaries, etc.) before it's inserted via innerHTML — those are
  // attacker-controlled strings, not trusted markup.
  // Quotes are escaped too, so the result is safe inside attribute values.
  esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // For href values from APIs: only http(s) passes, so a `javascript:` URL
  // in a post can't run code when clicked. Returns an escaped string.
  url(str) {
    try {
      const u = new URL(str);
      return /^https?:$/.test(u.protocol) ? this.esc(u.href) : '#';
    } catch { return '#'; }
  },

  // Stale-while-revalidate: render the last good payload instantly (new tabs
  // open often), refetch only when older than maxAge. A failed fetch keeps
  // the stale view on screen and only throws if there was nothing cached.
  // ponytail: one localStorage entry per key, never pruned — keys are per
  // card/param, so the set stays tiny; settings "Save" clears them all.
  async cached(key, maxAge, fetcher, render) {
    const k = `dashboard-cache-${key}`;
    let hit = null;
    try { hit = JSON.parse(localStorage.getItem(k)); } catch {}
    if (hit) render(hit.data);
    if (hit && Date.now() - hit.t < maxAge) return;
    try {
      const data = await fetcher();
      try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), data })); } catch {} // quota
      render(data);
    } catch (err) {
      if (!hit) throw err;
    }
  },

  // fetch() that throws on non-2xx, with the status on the error.
  async fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return res.json();
  },

  // Shimmering placeholder lines shown while a card's first fetch runs.
  skeleton(lines = 4) {
    return `<div class="skeleton" aria-busy="true">${'<div class="skeleton-line"></div>'.repeat(lines)}</div>`;
  },

  // "5m ago" / "3h ago" / "2d ago"
  ago(date) {
    const m = Math.floor((Date.now() - date) / 60000);
    if (m < 1)    return 'just now';
    if (m < 60)   return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  },

  // Theme + accent. Runs as soon as app.js loads (it's in <head>) so the
  // page never flashes the wrong colors. Theme: 'dark' (default) | 'light' | 'auto'.
  applyPrefs() {
    const root  = document.documentElement;
    const theme = localStorage.getItem('dashboard-theme') || 'dark';
    theme === 'auto' ? delete root.dataset.theme : root.dataset.theme = theme;
    const idx = parseInt(localStorage.getItem('dashboard-accent') ?? '0', 10);
    root.style.setProperty('--accent', ACCENTS[idx] ?? ACCENTS[0]);
  },

  init() {
    // Greeting, date, clock, search
    const name    = localStorage.getItem('dashboard-name');
    const engine  = SEARCH_ENGINES[localStorage.getItem('dashboard-search-engine')] ?? SEARCH_ENGINES.google;
    const header  = document.createElement('header');
    header.id = 'greeting';
    header.innerHTML = `
      <div>
        <div id="greet-text"></div>
        <div id="greet-date"></div>
      </div>
      <span id="header-clock"><span id="header-hm">--:--</span><span class="header-sec">:--</span></span>`;
    const search = document.createElement('form');
    search.id = 'search';
    search.role = 'search';
    search.action = engine.url;
    search.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input name="q" type="search" placeholder="Search ${engine.name}…" autocomplete="off" aria-label="Search ${engine.name}" autofocus>
      <kbd>/</kbd>`;
    const main = document.getElementById('dashboard');
    document.body.insertBefore(header, main);
    document.body.insertBefore(search, main);

    const hmEl   = document.getElementById('header-hm');
    const secEl  = header.querySelector('.header-sec');
    const textEl = document.getElementById('greet-text');
    const dateEl = document.getElementById('greet-date');
    const tick   = () => {
      const now = new Date(), h = now.getHours();
      const period = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
      textEl.textContent = `Good ${period}${name ? `, ${name}` : ''}`;
      dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      hmEl.textContent   = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      secEl.textContent  = ':' + String(now.getSeconds()).padStart(2, '0');
    };
    tick();
    setInterval(tick, 1000);

    // Shortcuts: "/" focuses search, "," opens settings (ignored while typing)
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, select')) return;
      if (e.key === '/') { e.preventDefault(); search.q.focus(); }
      if (e.key === ',') { e.preventDefault(); document.getElementById('settings-btn').click(); }
    });

    // Cards
    const el = document.getElementById('dashboard');
    el.innerHTML = this.cards.map((c, i) => `
      <div class="card${c.className ? ' ' + c.className : ''}" id="card-${c.id}" style="--i:${i}">
        ${c.title ? `<div class="card-title">${c.title}</div>` : ''}
        <div id="card-body-${c.id}">${c.render()}</div>
      </div>
    `).join('');

    this.cards.forEach(c => c.start?.());

    // Settings
    this._initSettings();
  },

  _initSettings() {
    // Gear button
    const btn = document.createElement('button');
    btn.id = 'settings-btn';
    btn.title = 'Settings';
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;
    document.body.appendChild(btn);

    // Modal
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-panel">
        <div class="settings-header">
          <span>Settings</span>
          <button id="settings-close">✕</button>
        </div>

        <div class="settings-field">
          <label>Your name</label>
          <input id="s-name" class="weather-input" type="text" placeholder="e.g. João">
        </div>

        <div class="settings-section-title">Weather</div>
        <div class="settings-field">
          <label>City</label>
          <input id="s-weather" class="weather-input" type="text" placeholder="e.g. Lisbon">
        </div>

        <div class="settings-section-title">Calendar</div>
        <div class="settings-field">
          <label>Google Calendar ICS URL</label>
          <input id="s-cal" class="weather-input" type="url" placeholder="https://calendar.google.com/calendar/ical/…">
          <small>Calendar Settings → Integrate calendar → "Secret address in iCal format"</small>
        </div>

        <div class="settings-section-title">News</div>
        <div class="settings-field">
          <label>Guardian API key</label>
          <input id="s-news-key" class="weather-input" type="text" placeholder="Your key — open.platform.theguardian.com">
        </div>
        <div class="settings-field">
          <label>Guardian section <span class="settings-optional">(optional)</span></label>
          <input id="s-news-section" class="weather-input" type="text" placeholder="e.g. technology, world — blank = top stories">
        </div>

        <div class="settings-section-title">Reddit</div>
        <div class="settings-field">
          <label>Subreddit</label>
          <input id="s-reddit" class="weather-input" type="text" placeholder="popular">
        </div>

        <button id="settings-save" class="weather-btn" style="width:100%;margin-top:8px">Save & reload</button>
      </div>`;
    document.body.appendChild(modal);

    // Open — cycle accent, pre-populate from localStorage
    btn.addEventListener('click', () => {
      const cur  = parseInt(localStorage.getItem('dashboard-accent') ?? '0', 10);
      const next = (cur + 1) % ACCENTS.length;
      localStorage.setItem('dashboard-accent', next);
      this.applyPrefs();

      const weather = localStorage.getItem('dashboard-weather');
      document.getElementById('s-name').value        = localStorage.getItem('dashboard-name') || '';
      document.getElementById('s-weather').value     = weather ? (JSON.parse(weather).name || '') : '';
      document.getElementById('s-cal').value         = localStorage.getItem('dashboard-cal-ics') || '';
      document.getElementById('s-news-key').value    = localStorage.getItem('dashboard-news-key') || '';
      document.getElementById('s-news-section').value= localStorage.getItem('dashboard-news-section') || '';
      document.getElementById('s-reddit').value      = localStorage.getItem('dashboard-reddit-sub') || '';
      modal.classList.add('open');
      document.getElementById('s-name').focus();
    });

    // Close
    const close = () => modal.classList.remove('open');
    document.getElementById('settings-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // Save → persist to localStorage, reload page
    document.getElementById('settings-save').addEventListener('click', () => {
      const set = (key, val) => val
        ? localStorage.setItem(key, val)
        : localStorage.removeItem(key);

      const name    = document.getElementById('s-name').value.trim();
      const weather = document.getElementById('s-weather').value.trim();
      const cal     = document.getElementById('s-cal').value.trim();
      const newsKey = document.getElementById('s-news-key').value.trim();
      const newsSec = document.getElementById('s-news-section').value.trim();
      const reddit  = document.getElementById('s-reddit').value.trim();

      set('dashboard-name', name);
      // Save city name only; weather card will geocode on next load
      weather
        ? localStorage.setItem('dashboard-weather', JSON.stringify({ name: weather }))
        : localStorage.removeItem('dashboard-weather');
      set('dashboard-cal-ics', cal);
      set('dashboard-news-key', newsKey);
      localStorage.setItem('dashboard-news-section', newsSec);
      localStorage.setItem('dashboard-reddit-sub', reddit || 'popular');

      location.reload();
    });
  }
};

if (typeof document !== 'undefined') dashboard.applyPrefs();
