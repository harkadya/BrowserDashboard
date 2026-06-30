dashboard.register({
  id: 'hn',
  title: 'Hacker News',
  className: 'card--wide',

  start() {
    this._load();
    setInterval(() => this._load(), 30 * 60 * 1000);
  },

  render() {
    return `<div class="weather-loading">Loading…</div>`;
  },

  async _load() {
    const body = document.getElementById('card-body-hn');
    try {
      const { hits } = await fetch(
        'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10'
      ).then(r => r.json());

      body.innerHTML = `
        <div class="hn-list">
          ${hits.map((h, i) => {
            const url    = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
            const domain = h.url ? new URL(h.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com';
            const ago    = this._ago(new Date(h.created_at));
            return `
              <div class="hn-item">
                <span class="hn-rank">${i + 1}</span>
                <div class="hn-body">
                  <a class="hn-title" href="${url}" target="_blank" rel="noopener">${dashboard.esc(h.title)}</a>
                  <div class="hn-meta">
                    <span class="hn-domain">${dashboard.esc(domain)}</span>
                    <span class="hn-dot">·</span>
                    <span>${h.points} pts</span>
                    <span class="hn-dot">·</span>
                    <a class="hn-comments" href="https://news.ycombinator.com/item?id=${h.objectID}" target="_blank" rel="noopener">${h.num_comments} comments</a>
                    <span class="hn-dot">·</span>
                    <span>${ago}</span>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    } catch {
      body.innerHTML = `<div class="weather-error">Could not load Hacker News</div>`;
    }
  },

  _ago(date) {
    const m = Math.floor((Date.now() - date) / 60000);
    if (m < 60)   return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
});
