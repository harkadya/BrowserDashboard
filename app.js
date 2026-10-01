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
      dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
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
    const ls = localStorage;

    // Gear button
    const btn = document.createElement('button');
    btn.id = 'settings-btn';
    btn.title = 'Settings ( , )';
    btn.setAttribute('aria-label', 'Settings');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;
    document.body.appendChild(btn);

    const opts = (map, cur) => Object.entries(map)
      .map(([v, label]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`).join('');

    // Modal — native <dialog> gives Esc-to-close and focus trapping for free
    const modal = document.createElement('dialog');
    modal.id = 'settings-modal';
    modal.innerHTML = `
      <form class="settings-panel">
        <div class="settings-header">
          <span>Settings</span>
          <button id="settings-close" type="button" aria-label="Close">✕</button>
        </div>

        <div class="settings-section-title">Appearance</div>
        <div class="settings-field">
          <label>Theme</label>
          <div class="seg" id="s-theme">
            ${['dark', 'light', 'auto'].map(t => `<button type="button" data-theme-opt="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
          </div>
        </div>
        <div class="settings-field">
          <label>Accent</label>
          <div class="accent-swatches">
            ${ACCENTS.map((c, i) => `<button type="button" class="accent-swatch" data-accent="${i}" style="background:${c}" aria-label="Accent ${c}"></button>`).join('')}
          </div>
        </div>

        <div class="settings-section-title">General</div>
        <div class="settings-field">
          <label for="s-name">Your name</label>
          <input id="s-name" class="weather-input" type="text" placeholder="e.g. João">
        </div>
        <div class="settings-field">
          <label for="s-engine">Search engine</label>
          <select id="s-engine" class="weather-input">
            ${opts(Object.fromEntries(Object.entries(SEARCH_ENGINES).map(([k, e]) => [k, e.name])), ls.getItem('dashboard-search-engine') || 'google')}
          </select>
        </div>
        <div class="settings-field">
          <label for="s-links">Quick links <span class="settings-optional">— one per line: Name | url</span></label>
          <textarea id="s-links" class="weather-input" rows="5" spellcheck="false"></textarea>
          <small>Clear the box to hide the links row.</small>
        </div>

        <div class="settings-section-title">Weather</div>
        <div class="settings-field-row">
          <div class="settings-field" style="flex:2">
            <label for="s-weather">City</label>
            <input id="s-weather" class="weather-input" type="text" placeholder="e.g. Lisbon">
          </div>
          <div class="settings-field" style="flex:1">
            <label for="s-units">Units</label>
            <select id="s-units" class="weather-input">${opts({ c: '°C, km/h', f: '°F, mph' }, ls.getItem('dashboard-weather-units') || 'c')}</select>
          </div>
        </div>

        <div class="settings-section-title">Calendar</div>
        <div class="settings-field">
          <label for="s-cal">Google Calendar ICS URL</label>
          <input id="s-cal" class="weather-input" type="url" placeholder="https://calendar.google.com/calendar/ical/…">
          <small>Calendar Settings → Integrate calendar → "Secret address in iCal format"</small>
        </div>

        <div class="settings-section-title">News</div>
        <div class="settings-field">
          <label for="s-news-key">Guardian API key</label>
          <input id="s-news-key" class="weather-input" type="password" placeholder="Your key — open.platform.theguardian.com" autocomplete="off">
        </div>
        <div class="settings-field">
          <label for="s-news-section">Guardian section <span class="settings-optional">(optional)</span></label>
          <input id="s-news-section" class="weather-input" type="text" placeholder="e.g. technology, world — blank = top stories">
        </div>

        <div class="settings-section-title">Reddit</div>
        <div class="settings-field">
          <label for="s-reddit">Subreddit</label>
          <input id="s-reddit" class="weather-input" type="text" placeholder="popular">
        </div>

        <button id="settings-save" type="submit" class="weather-btn">Save &amp; reload</button>
        <small class="settings-hint">Shortcuts: <kbd>/</kbd> search · <kbd>,</kbd> settings · <kbd>Esc</kbd> close</small>
      </form>`;
    document.body.appendChild(modal);
    const $ = id => modal.querySelector('#' + id);

    // Appearance applies (and saves) immediately
    const markAppearance = () => {
      const theme = ls.getItem('dashboard-theme') || 'dark';
      const acc   = ls.getItem('dashboard-accent') || '0';
      modal.querySelectorAll('[data-theme-opt]').forEach(b => b.classList.toggle('active', b.dataset.themeOpt === theme));
      modal.querySelectorAll('[data-accent]').forEach(b => b.classList.toggle('active', b.dataset.accent === acc));
    };
    modal.addEventListener('click', e => {
      const t = e.target.closest('[data-theme-opt]')?.dataset.themeOpt;
      const a = e.target.closest('[data-accent]')?.dataset.accent;
      if (t) ls.setItem('dashboard-theme', t);
      if (a) ls.setItem('dashboard-accent', a);
      if (t || a) { this.applyPrefs(); markAppearance(); }
      if (e.target === modal || e.target.closest('#settings-close')) modal.close();   // ✕ or backdrop
    });

    // Open — pre-populate from localStorage
    btn.addEventListener('click', () => {
      const weather = ls.getItem('dashboard-weather');
      let city = '';
      try { city = weather ? JSON.parse(weather).name || '' : ''; } catch {}
      $('s-name').value         = ls.getItem('dashboard-name') || '';
      $('s-weather').value      = city;
      $('s-links').value        = ls.getItem('dashboard-links') ?? DEFAULT_LINKS;
      $('s-cal').value          = ls.getItem('dashboard-cal-ics') || '';
      $('s-news-key').value     = ls.getItem('dashboard-news-key') || '';
      $('s-news-section').value = ls.getItem('dashboard-news-section') || '';
      $('s-reddit').value       = ls.getItem('dashboard-reddit-sub') || '';
      markAppearance();
      modal.showModal();
    });

    // Save → persist, drop cached API data (config may have changed), reload
    modal.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const set = (key, val) => val ? ls.setItem(key, val) : ls.removeItem(key);
      const val = id => $(id).value.trim();

      set('dashboard-name', val('s-name'));
      set('dashboard-search-engine', val('s-engine'));
      ls.setItem('dashboard-links', val('s-links'));
      set('dashboard-weather-units', val('s-units') === 'f' ? 'f' : '');
      // Save city name only; weather card will geocode on next load
      const city = val('s-weather');
      let prev = '';
      try { prev = JSON.parse(ls.getItem('dashboard-weather'))?.name || ''; } catch {}
      if (!city) ls.removeItem('dashboard-weather');
      else if (city !== prev) ls.setItem('dashboard-weather', JSON.stringify({ name: city }));
      set('dashboard-cal-ics', val('s-cal'));
      set('dashboard-news-key', val('s-news-key'));
      ls.setItem('dashboard-news-section', val('s-news-section'));
      ls.setItem('dashboard-reddit-sub', val('s-reddit').replace(/^r\//, '') || 'popular');

      Object.keys(ls).filter(k => k.startsWith('dashboard-cache-')).forEach(k => ls.removeItem(k));
      location.reload();
    });
  }
};

if (typeof document !== 'undefined') dashboard.applyPrefs();
