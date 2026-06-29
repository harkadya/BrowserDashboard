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
const dashboard = {
  cards: [],

  register(card) {
    this.cards.push(card);
  },

  init() {
    // Greeting
    const hour   = new Date().getHours();
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const name   = localStorage.getItem('dashboard-name');
    const greetingEl = document.createElement('div');
    greetingEl.id = 'greeting';
    greetingEl.textContent = `Good ${period}${name ? `, ${name}` : ''}`;
    document.body.insertBefore(greetingEl, document.getElementById('dashboard'));

    // Cards
    const el = document.getElementById('dashboard');
    el.innerHTML = this.cards.map(c => `
      <div class="card${c.className ? ' ' + c.className : ''}" id="card-${c.id}">
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

    // Open — pre-populate from localStorage
    btn.addEventListener('click', () => {
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
