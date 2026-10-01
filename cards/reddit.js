dashboard.register({
  id: 'reddit',
  title: 'Reddit',
  className: 'card--wide',

  render() {
    return `
      <form id="reddit-setup" class="cal-setup">
        <p class="cal-hint">Which subreddit?</p>
        <div class="weather-form" style="margin-top:12px">
          <input id="reddit-sub" class="weather-input" type="text" placeholder="e.g. programming, worldnews…">
          <button type="submit" class="weather-btn">Go</button>
        </div>
      </form>`;
  },

  start() {
    const body = document.getElementById('card-body-reddit');

    body.addEventListener('submit', e => {
      if (!e.target.closest('#reddit-setup')) return;
      e.preventDefault();
      const sub = document.getElementById('reddit-sub').value.trim().replace(/^r\//, '');
      if (!sub) return;
      localStorage.setItem('dashboard-reddit-sub', sub);
      this._load(sub);
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.reddit-reset')) {
        localStorage.removeItem('dashboard-reddit-sub');
        body.innerHTML = this.render();
      }
    });

    const saved = localStorage.getItem('dashboard-reddit-sub') || 'popular';
    localStorage.setItem('dashboard-reddit-sub', saved);
    this._load(saved);
    setInterval(() => this._load(localStorage.getItem('dashboard-reddit-sub')), 30 * 60 * 1000);
  },

  async _load(sub) {
    const body = document.getElementById('card-body-reddit');
    body.innerHTML = `<div class="weather-loading">Loading r/${dashboard.esc(sub)}…</div>`;
    try {
      const res = await fetch(`/proxy/reddit?sub=${encodeURIComponent(sub)}`);
      if (res.status === 404) throw new Error(`r/${sub} not found`);
      if (!res.ok) throw new Error(`Reddit error ${res.status}`);
      const posts = await res.json();
      if (!posts.length) throw new Error(`r/${sub} appears empty or private`);
      body.innerHTML = this._html(sub, posts);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${dashboard.esc(err.message)}</div>` + this.render();
    }
  },

  _html(sub, posts) {
    const items = posts.slice(0, 10).map((p, i) => {
      const ago = dashboard.ago(new Date(p.updated));
      return `
        <div class="hn-item">
          <span class="hn-rank">${i + 1}</span>
          <div class="hn-body">
            <a class="hn-title" href="${dashboard.url(p.url)}" target="_blank" rel="noopener">${dashboard.esc(p.title)}</a>
            <div class="hn-meta">
              <span class="hn-domain">${dashboard.esc(p.subreddit)}</span>
              <span class="hn-dot">·</span>
              <span>${dashboard.esc(p.author)}</span>
              <span class="hn-dot">·</span>
              <span>${ago}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="news-header">
        <span class="news-label">r/${dashboard.esc(sub)} · Hot</span>
        <button class="wx-change reddit-reset">Change</button>
      </div>
      <div class="hn-list">${items}</div>`;
  }
});
