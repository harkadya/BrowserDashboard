# BrowserDashboard

A personal new-tab page served locally on macOS. The header shows a greeting,
date, live clock and a search bar; cards below show quick links, weather,
calendar, a to-do list, Hacker News, Reddit and news. No build step — plain HTML/CSS/JS with a small Python server that
handles static files and two proxy routes.

The server binds to `127.0.0.1` only (see `server.py`) — it is not reachable
from other machines on the network.

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
`dashboard-{card-id}-{setting}` (e.g. `dashboard-weather-units`).

### Shared helpers (`app.js`)

| Helper | Use |
|---|---|
| `dashboard.esc(str)` | Escape any external text for `innerHTML` (quotes too — attribute-safe) |
| `dashboard.url(str)` | Escaped `href` value; anything not http(s) becomes `#` |
| `dashboard.cached(key, maxAgeMs, fetcher, render)` | Stale-while-revalidate: renders the last payload instantly, refetches when older than `maxAgeMs`, keeps stale data on failure. Stored as `dashboard-cache-{key}` — include config (sub, section, location) in the key |
| `dashboard.fetchJSON(url)` | `fetch` that throws on non-2xx; the error carries `.status` |
| `dashboard.skeleton(n)` | Shimmer placeholder for a card's first load |
| `dashboard.ago(date)` | "just now" / "5m ago" / "3h ago" / "2d ago" |

### Rendering external data

Any text from an API response or ICS feed is untrusted — HN/Reddit post
titles and calendar event summaries are written by random third parties, not
by you. Never interpolate it into an `innerHTML` template raw. Use the
shared `dashboard.esc(str)` helper (defined in `app.js`) for every dynamic
field that isn't a value you constructed yourself:

```js
`<a class="hn-title" href="${dashboard.url(h.url)}">${dashboard.esc(h.title)}</a>`
```

URLs from APIs go through `dashboard.url()`, not `esc()` alone — `esc` stops
attribute breakout but not a `javascript:` link.

Skipping this is a stored-XSS hole: a malicious post title or shared-calendar
invite can run arbitrary JS in the page, which has the Guardian API key and
the calendar's secret ICS URL sitting in `localStorage`.

### Settings panel, theme & accent

`app.js` owns a settings gear (top-right, fixed; shortcut `,`) that opens a
native `<dialog>` for editing every card's localStorage config in one place.
Appearance controls apply instantly: theme (`dashboard-theme` = `dark`
default | `light` | `auto`) and accent (`dashboard-accent`, index into
`ACCENTS`). Everything else is written on "Save & reload", which also clears
every `dashboard-cache-*` entry. New cards that add config should be wired
into the modal's open/save handlers in `_initSettings()`.

`app.js` is loaded in `<head>` and calls `dashboard.applyPrefs()` right away
so theme/accent are set before first paint.

### Theming

Colors are CSS variables on `:root`; the light theme overrides them under
`[data-theme="light"]` (and `prefers-color-scheme: light` when no
`data-theme` is set = auto). Never hardcode `rgba(255,255,255,…)` — tints go
through the `--ink` channel: `rgb(var(--ink) / 0.06)`, or `var(--surface)` /
`var(--surface-hover)`.

### Header

Search posts to the engine in `SEARCH_ENGINES` picked by
`dashboard-search-engine`. Shortcuts: `/` focuses search, `,` opens
settings (both ignored while typing in a field).

## File structure

```
index.html          Shell — loads CSS, app.js (in <head>), card scripts, calls dashboard.init()
style.css           Dark/light themes, CSS grid layout, per-card styles
app.js              Card registry, header (greeting/date/clock/search), settings dialog, helpers
server.py           Python stdlib HTTP server + proxy endpoints (no pip deps)
serve.sh            Thin wrapper: python3 server.py
tests.js            Self-check for helpers, ICS parsing, link parsing — `node tests.js`

cards/
  links.js          Quick links row — "Name | url" lines in dashboard-links, DuckDuckGo favicons
  weather.js        Open-Meteo (free, no key) — current, 12h sparkline strip, 7-day; °C/°F
  calendar.js       Google Calendar via ICS feed — routed through /proxy/ics; Now/in-Xm badges
  todo.js           To-do list stored in dashboard-todo-items
  hackernews.js     HN Top/Ask/Show via Algolia API (free, no key)
  reddit.js         Reddit RSS via /proxy/reddit — subreddit stored in localStorage
  news.js           The Guardian API — key stored in localStorage
```

## Server proxy routes

| Route | Purpose | Why proxied |
|---|---|---|
| `GET /proxy/ics?url=<url>` | Google Calendar ICS feed | CORS — browser blocked |
| `GET /proxy/reddit?sub=<sub>` | Reddit Atom RSS → JSON | Reddit TLS-fingerprints Python `urllib`; proxy uses `curl` |

Both proxies pass the upstream HTTP status through (Reddit 404/429, Google
404 when the secret ICS address has been reset) so cards can show a
specific error; anything else is a 502.

The Reddit proxy uses `subprocess.run(['curl', ...])` because Reddit returns
403 to Python's `urllib` (HTTP/1.1, different TLS fingerprint) but accepts
`curl` (HTTP/2). The RSS feed no longer includes upvote scores or comment
counts — only title, subreddit, author, and date are available.

## Secrets

The Guardian API key and the calendar's ICS URL are user secrets. They live
only in the browser's `localStorage`, set via the settings panel — never
hardcode a key/URL in source, a card file, or this doc, and don't add a
`.env` or config file that would hold one either.

## Card setup checklist

| Card | What to configure |
|---|---|
| Quick links | Settings → one `Name \| url` per line (defaults shown until saved) |
| Weather | Enter city on first load → saved automatically; units in settings |
| Calendar | Google Calendar → Settings → Integrate → "Secret address in iCal format" |
| News | Guardian API key → [open.platform.theguardian.com](https://open.platform.theguardian.com) (free) |
| To do | Nothing — type and press Enter |
| HN | Nothing — loads automatically; Top/Ask/Show tabs |
| Reddit | Defaults to r/popular — "Change" button to switch subreddits |

## CSS layout helpers

```css
.card--wide   /* grid-column: span 2 */
.card--full   /* grid-column: 1 / -1  (full row) */
.card--tall   /* grid-row: span 2 */
```

Grid is `repeat(auto-fill, minmax(260px, 1fr))` with `grid-auto-flow: dense`
so the number of columns adjusts to window width and gaps get backfilled.
On narrow screens `card--wide` collapses to 1 column.

## Testing

`node tests.js` — plain `assert`, no deps. Run it after touching `app.js`
helpers, the ICS parser in `calendar.js`, or `links.js` parsing.
