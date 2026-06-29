# BrowserDashboard

A personal new-tab page served locally on macOS. Cards show weather, calendar,
news, Hacker News, and Reddit. No build step — plain HTML/CSS/JS with a small
Python server that handles static files and two proxy routes.

## Running

```sh
./serve.sh          # starts server.py on http://localhost:8080
python3 server.py   # equivalent
```

Set your browser's new tab URL to `http://localhost:8080`.
- Chrome: install "New Tab Redirect" extension → point to `http://localhost:8080`
- Firefox: `about:config` → `browser.newtab.url` → `http://localhost:8080`

The server must be running for the calendar and Reddit cards to work (they
route through the local proxy). Weather, news, and HN fetch external APIs
directly from the browser.

## Adding a card

1. Create `cards/my-card.js` — call `dashboard.register({ ... })` at the top level.
2. Add `<script src="cards/my-card.js"></script>` in `index.html` before the
   closing `dashboard.init()` call. **Order = grid order** (top-left first).

### Card contract

```js
dashboard.register({
  id:        'my-card',          // unique slug; becomes DOM id "card-my-card"
  title:     'My Card',          // label above card, or null
  className: 'card--wide',       // layout: card--wide (2 col) | card--full (row) | card--tall (2 row)

  render() {
    // Returns initial HTML string — shown immediately on page load.
    // Use for a loading skeleton or a first-time setup form.
    return `<div>Loading…</div>`;
  },

  start() {
    // Called once, after all cards are in the DOM.
    // Wire event listeners here (use event delegation on #card-body-{id}).
    // Kick off fetch calls and setInterval refreshes here.
  }
});
```

Persist user config in `localStorage` with a namespaced key:
`dashboard-{card-id}-{setting}` (e.g. `dashboard-weather-location`).

## File structure

```
index.html          Shell — loads CSS, app.js, card scripts, calls dashboard.init()
style.css           Dark theme, CSS grid layout, per-card styles
app.js              Card registry (dashboard.register / dashboard.init)
server.py           Python stdlib HTTP server + proxy endpoints (no pip deps)
serve.sh            Thin wrapper: python3 server.py

cards/
  clock.js          Live clock and date — no API
  weather.js        Open-Meteo (free, no key) — saves city to localStorage
  calendar.js       Google Calendar via ICS feed — routed through /proxy/ics
  news.js           The Guardian API — key stored in localStorage
  hackernews.js     HN front page via Algolia API (free, no key)
  reddit.js         Reddit RSS via /proxy/reddit — subreddit stored in localStorage
```

## Server proxy routes

| Route | Purpose | Why proxied |
|---|---|---|
| `GET /proxy/ics?url=<url>` | Google Calendar ICS feed | CORS — browser blocked |
| `GET /proxy/reddit?sub=<sub>` | Reddit Atom RSS → JSON | Reddit TLS-fingerprints Python `urllib`; proxy uses `curl` |

The Reddit proxy uses `subprocess.run(['curl', ...])` because Reddit returns
403 to Python's `urllib` (HTTP/1.1, different TLS fingerprint) but accepts
`curl` (HTTP/2). The RSS feed no longer includes upvote scores or comment
counts — only title, subreddit, author, and date are available.

## Card setup checklist

| Card | What to configure |
|---|---|
| Weather | Enter city on first load → saved automatically |
| Calendar | Google Calendar → Settings → Integrate → "Secret address in iCal format" |
| News | Guardian API key → [open.platform.theguardian.com](https://open.platform.theguardian.com) (free) |
| HN | Nothing — loads automatically |
| Reddit | Defaults to r/popular — "Change" button to switch subreddits |

## CSS layout helpers

```css
.card--wide   /* grid-column: span 2 */
.card--full   /* grid-column: 1 / -1  (full row) */
.card--tall   /* grid-row: span 2 */
```

Grid is `repeat(auto-fill, minmax(260px, 1fr))` so the number of columns
adjusts to window width. On narrow screens `card--wide` collapses to 1 column.
