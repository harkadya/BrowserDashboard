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
    body.innerHTML = dashboard.skeleton(4);
    const base = section
      ? `https://content.guardianapis.com/${encodeURIComponent(section)}`
      : 'https://content.guardianapis.com/search';
    const url = `${base}?api-key=${encodeURIComponent(key)}&show-fields=trailText,thumbnail&order-by=newest&page-size=12`;

    try {
      await dashboard.cached(`news-${section || 'top'}`, 15 * 60 * 1000,
        async () => {
          const { response } = await dashboard.fetchJSON(url);
          if (!response.results?.length) throw new Error('No articles found');
          return response.results;
        },
        results => body.innerHTML = this._html(results, section));
    } catch (err) {
      const msg = err.status === 401 ? 'Invalid API key'
                : err.status ? `Guardian API error ${err.status}` : err.message;
      body.innerHTML = `<div class="weather-error">${dashboard.esc(msg)}</div>` + this.render();
    }
  },

  _html(articles, section) {
    const sectionLabel = section
      ? section.charAt(0).toUpperCase() + section.slice(1)
      : 'Top stories';

    const items = articles.map(a => {
      const ago = dashboard.ago(new Date(a.webPublicationDate));
      const trail = a.fields?.trailText
        ? `<div class="news-trail">${dashboard.esc(a.fields.trailText.replace(/<[^>]+>/g, ''))}</div>`
        : '';
      return `
        <a class="news-item" href="${dashboard.url(a.webUrl)}" target="_blank" rel="noopener">
          ${a.fields?.thumbnail
            ? `<img class="news-thumb" src="${dashboard.url(a.fields.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">`
            : ''}
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
        <span class="news-label">The Guardian · ${dashboard.esc(sectionLabel)}</span>
        <button class="wx-change news-reset">Change</button>
      </div>
      <div class="news-grid">${items}</div>`;
  }
});
