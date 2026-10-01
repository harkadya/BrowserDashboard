const HN_TABS = { top: 'front_page', ask: 'ask_hn', show: 'show_hn' };

dashboard.register({
  id: 'hn',
  title: 'Hacker News',
  className: 'card--wide',

  start() {
    document.getElementById('card-body-hn').addEventListener('click', e => {
      const tab = e.target.closest('[data-hn-tab]')?.dataset.hnTab;
      if (!tab) return;
      localStorage.setItem('dashboard-hn-tab', tab);
      this._load();
    });
    this._load();
    setInterval(() => this._load(), 30 * 60 * 1000);
  },

  render() {
    return dashboard.skeleton(6);
  },

  async _load() {
    const body = document.getElementById('card-body-hn');
    const tab  = HN_TABS[localStorage.getItem('dashboard-hn-tab')] ? localStorage.getItem('dashboard-hn-tab') : 'top';
    try {
      await dashboard.cached(`hn-${tab}`, 10 * 60 * 1000,
        () => dashboard.fetchJSON(`https://hn.algolia.com/api/v1/search?tags=${HN_TABS[tab]}&hitsPerPage=10`)
                .then(j => j.hits),
        hits => body.innerHTML = this._tabs(tab) + this._html(hits));
    } catch {
      body.innerHTML = `<div class="weather-error">Could not load Hacker News</div>`;
    }
  },

  _tabs(active) {
    return `<div class="tabs">${Object.keys(HN_TABS).map(t =>
      `<button class="tab${t === active ? ' tab--active' : ''}" data-hn-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`
    ).join('')}</div>`;
  },

  _html(hits) {
    return `
      <div class="hn-list">
        ${hits.map((h, i) => {
          const item   = `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`;
          const url    = h.url || item;
          let domain = 'news.ycombinator.com';
          try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
          return `
            <div class="hn-item">
              <span class="hn-rank">${i + 1}</span>
              <div class="hn-body">
                <a class="hn-title" href="${dashboard.url(url)}" target="_blank" rel="noopener">${dashboard.esc(h.title)}</a>
                <div class="hn-meta">
                  <span class="hn-domain">${dashboard.esc(domain)}</span>
                  <span class="hn-dot">·</span>
                  <span>${Number(h.points) || 0} pts</span>
                  <span class="hn-dot">·</span>
                  <a class="hn-comments" href="${item}" target="_blank" rel="noopener">${Number(h.num_comments) || 0} comments</a>
                  <span class="hn-dot">·</span>
                  <span>${dashboard.ago(new Date(h.created_at))}</span>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
});
