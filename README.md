# BrowserDashboard

A personal new-tab page you run locally. No build step, no frameworks —
plain HTML/CSS/JS plus a small Python server for two proxy routes.

Shows a greeting, date, live clock and a search bar, then cards for quick
links, weather, your Google Calendar, a to-do list, Hacker News, Reddit and
The Guardian.

**Highlights**

- Instant paint — each card shows its last data immediately and refreshes in the background
- Dark, light, or follow-the-OS theme, plus seven accent colors
- Weather with a 12-hour temperature sparkline, sunrise/sunset, rain chance, °C/°F
- Calendar badges for what's on **Now** and what starts "in 25m"
- Hacker News Top / Ask / Show tabs
- Keyboard: <kbd>/</kbd> search · <kbd>,</kbd> settings · <kbd>Esc</kbd> close

## Requirements

- macOS (or any system with Python 3 and `curl`)
- Python 3 (stdlib only — no `pip install` needed)

## Running

```sh
./serve.sh          # starts server.py on http://localhost:8080
python3 server.py   # equivalent
```

Then set your browser's new-tab page to `http://localhost:8080`:
- **Chrome**: install the "New Tab Redirect" extension → point it at `http://localhost:8080`
- **Firefox**: go to `about:config` → set `browser.newtab.url` → `http://localhost:8080`

The server must be running for the calendar and Reddit cards to work — they
route through a local proxy (CORS and TLS-fingerprinting issues otherwise).
Weather, news, and Hacker News fetch directly from the browser.

The server only listens on `127.0.0.1` — it isn't reachable from other
devices on your network.

## Setting up each card

Click the gear icon (top right, or press <kbd>,</kbd>) to open settings, or
use each card's own setup form on first load.

| Card | What to configure |
|---|---|
| Quick links | Settings → one `Name \| url` per line; clear to hide the row |
| Weather | Enter a city — saved automatically; °C/°F in settings |
| Calendar | Google Calendar → Settings → your calendar → Integrate calendar → "Secret address in iCal format" |
| News | Free API key from [open.platform.theguardian.com](https://open.platform.theguardian.com) |
| To do | Nothing — type a task and press Enter |
| Hacker News | Nothing — loads automatically |
| Reddit | Defaults to r/popular — use "Change" to switch subreddits |

Theme, accent and search engine (Google, DuckDuckGo, Kagi, Bing) are in
settings too.

All config (API keys, calendar URL, subreddit, your name, to-dos) is stored in the
browser's `localStorage` only — nothing is sent anywhere except the API
providers themselves and your own local server.

## Tests

```sh
node tests.js   # no deps — checks escaping, ICS parsing, link parsing
```

## Adding a card

See [CLAUDE.md](CLAUDE.md) for the card contract and project structure if
you want to extend this for yourself.

## License

Personal project, no license — use it as a reference if useful.
