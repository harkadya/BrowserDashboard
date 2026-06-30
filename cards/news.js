dashboard.register({
  id: 'news',
  title: 'News',
  className: 'card--full',

  render() {
    return `
      <form id="news-setup" class="cal-setup">
        <p class="cal-hint">Enter your Guardian API key and optionally a section to follow.<br>
          <small>Sections: world · technology · science · business · sport · culture · politics</small>
        </p>
        <div style="display:flex;gap:10px;margin-top:12px">
          <input id="news-key" class="weather-input" type="text" placeholder="Guardian API key" style="flex:2">
          <input id="news-section" class="weather-input" type="text" placeholder="Section (optional)" style="flex:1">
          <button type="submit" class="weather-btn">Save</button>
        </div>
      </form>`;
  },

  start() {
    const body = document.getElementById('card-body-news');

    body.addEventListener('submit', e => {
      if (!e.target.closest('#news-setup')) return;
      e.preventDefault();
      const key = document.getElementById('news-key').value.trim();
      const section = document.getElementById('news-section').value.trim();
      if (!key) return;
      localStorage.setItem('dashboard-news-key', key);
      localStorage.setItem('dashboard-news-section', section);
      this._load(key, section);
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.news-reset')) {
        localStorage.removeItem('dashboard-news-key');
        localStorage.removeItem('dashboard-news-section');
        body.innerHTML = this.render();
      }
    });

    const key = localStorage.getItem('dashboard-news-key');
    if (key) {
      this._load(key, localStorage.getItem('dashboard-news-section') || '');
      setInterval(() => this._load(key, localStorage.getItem('dashboard-news-section') || ''), 30 * 60 * 1000);
    }
  },

  async _load(key, section) {
    const body = document.getElementById('card-body-news');
    const base = section
      ? `https://content.guardianapis.com/${encodeURIComponent(section)}`
      : 'https://content.guardianapis.com/search';
    const url = `${base}?api-key=${key}&show-fields=trailText&order-by=newest&page-size=12`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid API key' : `Guardian API error ${res.status}`);
      const { response } = await res.json();
      if (!response.results?.length) throw new Error('No articles found');
      body.innerHTML = this._html(response.results, section);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${err.message}</div>` + this.render();
    }
  },

  _html(articles, section) {
    const sectionLabel = section
      ? section.charAt(0).toUpperCase() + section.slice(1)
      : 'Top stories';

    const items = articles.map(a => {
      const ago = this._ago(new Date(a.webPublicationDate));
      const trail = a.fields?.trailText
        ? `<div class="news-trail">${dashboard.esc(a.fields.trailText.replace(/<[^>]+>/g, ''))}</div>`
        : '';
      return `
        <a class="news-item" href="${a.webUrl}" target="_blank" rel="noopener">
          <div class="news-meta">
            <span class="news-section">${dashboard.esc(a.sectionName)}</span>
            <span class="news-age">${ago}</span>
          </div>
          <div class="news-title">${dashboard.esc(a.webTitle)}</div>
          ${trail}
        </a>`;
    }).join('');

    return `
      <div class="news-header">
        <span class="news-label">The Guardian · ${sectionLabel}</span>
        <button class="wx-change news-reset">Change</button>
      </div>
      <div class="news-grid">${items}</div>`;
  },

  _ago(date) {
    const m = Math.floor((Date.now() - date) / 60000);
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
});
