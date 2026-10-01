// Shown until the user saves their own list in settings (empty list = card hidden).
const DEFAULT_LINKS = `GitHub | github.com
Gmail | mail.google.com
Calendar | calendar.google.com
YouTube | youtube.com
Hacker News | news.ycombinator.com
Guardian | theguardian.com`;

dashboard.register({
  id: 'links',
  title: null,
  className: 'card--full card--links',

  // "Name | url" per line; bare "url" uses the hostname as the name.
  // Lines whose URL isn't http(s) are dropped.
  parse(text) {
    return text.split('\n').map(line => {
      let [name, url] = line.includes('|') ? line.split('|').map(s => s.trim()) : ['', line.trim()];
      if (!url) return null;
      if (!/^[a-z][\w+.-]*:/i.test(url)) url = 'https://' + url;
      try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) return null;
        return { name: name || u.hostname.replace(/^www\./, ''), url: u.href, host: u.hostname };
      } catch { return null; }
    }).filter(Boolean);
  },

  render() {
    const links = this.parse(localStorage.getItem('dashboard-links') ?? DEFAULT_LINKS);
    if (!links.length) return '';
    return `<nav class="links">${links.map(l => `
      <a class="link-tile" href="${dashboard.esc(l.url)}" title="${dashboard.esc(l.url)}">
        <span class="link-icon" data-letter="${dashboard.esc(l.name[0].toUpperCase())}">
          <img src="https://icons.duckduckgo.com/ip3/${encodeURIComponent(l.host)}.ico" alt="" loading="lazy"
               onerror="this.remove()">
        </span>
        <span class="link-name">${dashboard.esc(l.name)}</span>
      </a>`).join('')}</nav>`;
  },

  start() {
    const card = document.getElementById('card-links');
    if (!card.querySelector('.link-tile')) card.hidden = true;
  }
});
