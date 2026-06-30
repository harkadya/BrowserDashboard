# BrowserDashboard

A personal new-tab page you run locally. No build step, no frameworks —
plain HTML/CSS/JS plus a small Python server for two proxy routes.

Shows a greeting with a live clock, then cards for weather, your Google
Calendar, news, Hacker News, and Reddit.

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

Click the gear icon (top right) to open settings, or use each card's own
setup form on first load.

| Card | What to configure |
|---|---|
| Weather | Enter a city — saved automatically |
| Calendar | Google Calendar → Settings → your calendar → Integrate calendar → "Secret address in iCal format" |
| News | Free API key from [open.platform.theguardian.com](https://open.platform.theguardian.com) |
| Hacker News | Nothing — loads automatically |
| Reddit | Defaults to r/popular — use "Change" to switch subreddits |

All config (API keys, calendar URL, subreddit, your name) is stored in the
browser's `localStorage` only — nothing is sent anywhere except the API
providers themselves and your own local server.

## Adding a card

See [CLAUDE.md](CLAUDE.md) for the card contract and project structure if
you want to extend this for yourself.

## License

Personal project, no license — use it as a reference if useful.
