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
    body.innerHTML = `<div class="weather-loading">Loading r/${sub}…</div>`;
    try {
      const res = await fetch(`https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=12`, {
        headers: { Accept: 'application/json' }
      });
      if (res.status === 404) throw new Error(`r/${sub} not found`);
      if (!res.ok) throw new Error(`Reddit error ${res.status}`);
      const { data } = await res.json();
      if (!data.children.length) throw new Error(`r/${sub} appears empty or private`);
      body.innerHTML = this._html(sub, data.children);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${err.message}</div>` + this.render();
    }
  },

  _html(sub, posts) {
    const items = posts.map((p, i) => {
      const d   = p.data;
      const url = d.is_self ? `https://reddit.com${d.permalink}` : d.url;
      const ago = this._ago(new Date(d.created_utc * 1000));
      return `
        <div class="hn-item">
          <span class="hn-rank">${i + 1}</span>
          <div class="hn-body">
            <a class="hn-title" href="${url}" target="_blank" rel="noopener">${d.title}</a>
            <div class="hn-meta">
              <span class="hn-domain">${d.subreddit_name_prefixed}</span>
              <span class="hn-dot">·</span>
              <span>${d.score} pts</span>
              <span class="hn-dot">·</span>
              <a class="hn-comments" href="https://reddit.com${d.permalink}" target="_blank" rel="noopener">${d.num_comments} comments</a>
              <span class="hn-dot">·</span>
              <span>${ago}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="news-header">
        <span class="news-label">r/${sub} · Hot</span>
        <button class="wx-change reddit-reset">Change</button>
      </div>
      <div class="hn-list">${items}</div>`;
  },

  _ago(date) {
    const m = Math.floor((Date.now() - date) / 60000);
    if (m < 60)   return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
});
