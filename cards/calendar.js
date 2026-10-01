dashboard.register({
  id: 'calendar',
  title: 'Calendar',
  className: 'card--wide card--tall',

  _events: [],
  _view: null,    // { year, month }
  _selected: null, // Date | null

  render() {
    return `<form id="cal-setup" class="cal-setup">
      <p class="cal-hint">Paste your Google Calendar ICS URL<br>
        <small>Calendar Settings → Integrate calendar → "Secret address in iCal format"</small>
      </p>
      <div class="weather-form" style="margin-top:12px">
        <input id="cal-url" class="weather-input" type="url"
               placeholder="https://calendar.google.com/calendar/ical/…">
        <button type="submit" class="weather-btn">Save</button>
      </div>
    </form>`;
  },

  start() {
    const now = new Date();
    this._view = { year: now.getFullYear(), month: now.getMonth() };

    const body = document.getElementById('card-body-calendar');

    body.addEventListener('submit', e => {
      if (!e.target.closest('#cal-setup')) return;
      e.preventDefault();
      const url = document.getElementById('cal-url').value.trim();
      if (!url.startsWith('https://calendar.google.com/')) {
        document.getElementById('cal-url').style.borderColor = '#f87171';
        return;
      }
      localStorage.setItem('dashboard-cal-ics', url);
      localStorage.removeItem('dashboard-cache-cal');
      this._load(url);
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.cal-prev')) {
        if (--this._view.month < 0) { this._view.month = 11; this._view.year--; }
        this._selected = null;
        this._render(); return;
      }
      if (e.target.closest('.cal-next')) {
        if (++this._view.month > 11) { this._view.month = 0; this._view.year++; }
        this._selected = null;
        this._render(); return;
      }
      const cell = e.target.closest('.cal-cell[data-date]');
      if (cell) {
        const d = new Date(cell.dataset.date + 'T00:00:00');
        // toggle: clicking selected day goes back to upcoming view
        this._selected = d.toDateString() === this._selected?.toDateString() ? null : d;
        this._render(); return;
      }
      if (e.target.closest('.wx-change')) {
        localStorage.removeItem('dashboard-cal-ics');
        localStorage.removeItem('dashboard-cache-cal');
        this._events = [];
        body.innerHTML = this.render();
      }
    });

    const saved = localStorage.getItem('dashboard-cal-ics');
    if (saved) this._load(saved);
    setInterval(() => {
      const url = localStorage.getItem('dashboard-cal-ics');
      if (url) this._load(url, true);
    }, 30 * 60 * 1000);
    // keep "Now" / "in 20m" labels current
    setInterval(() => this._events.length && this._render(), 60 * 1000);
  },

  async _load(icsUrl, quiet = false) {
    const body = document.getElementById('card-body-calendar');
    if (!quiet) body.innerHTML = dashboard.skeleton(7);
    try {
      await dashboard.cached('cal', 15 * 60 * 1000,
        async () => {
          const res = await fetch(`/proxy/ics?url=${encodeURIComponent(icsUrl)}`)
            .catch(() => { throw new Error('Local server not reachable — start ./serve.sh'); });
          if (!res.ok) throw new Error(`Could not fetch calendar (HTTP ${res.status})`);
          const text = await res.text();
          if (!text.includes('BEGIN:VCALENDAR'))
            throw new Error('That URL doesn\'t look like an ICS feed. Use the "Secret address in iCal format" from Google Calendar Settings → Integrate calendar.');
          return text;
        },
        text => { this._events = this._parse(text); this._render(); });
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${dashboard.esc(err.message)}</div>` + this.render();
    }
  },

  _parseDate(s) {
    if (!s) return null;
    s = s.trim();
    if (/^\d{8}$/.test(s))
      return new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    return m[7] === 'Z'
      ? new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]))
      : new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
  },

  _parse(text) {
    text = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const now = new Date();
    const winStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const winEnd   = new Date(now.getFullYear(), now.getMonth() + 6, 0);

    const events = [];
    for (const block of text.split(/\nBEGIN:VEVENT\n/).slice(1)) {
      const get = key => {
        const m = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'm'));
        return m ? m[1].trim() : '';
      };

      const dtLine  = block.match(/^DTSTART[^\n]*/m)?.[0] ?? '';
      const dtValue = get('DTSTART');
      const start   = this._parseDate(dtValue);
      if (!start) continue;

      const allDay = /^\d{8}$/.test(dtValue) || dtLine.includes('VALUE=DATE');
      const title  = (get('SUMMARY') || '(No title)').replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ');
      const end    = this._parseDate(get('DTEND'));
      const dur    = end ? end - start : 0;

      const rruleLine = block.match(/^RRULE:(.+)$/m)?.[1];
      if (rruleLine) {
        const exdates = new Set();
        for (const m of block.matchAll(/^EXDATE[^:]*:(.+)$/gm))
          m[1].split(',').forEach(ds => {
            const d = this._parseDate(ds.trim());
            if (d) exdates.add(d.toDateString());
          });
        events.push(...this._expand({ start, allDay, title, dur }, rruleLine, exdates, winStart, winEnd));
      } else if (start >= winStart && start <= winEnd) {
        events.push({ start, allDay, title, dur });
      }
    }
    return events.sort((a, b) => a.start - b.start);
  },

  _expand(base, rrule, exdates, winStart, winEnd) {
    const r = Object.fromEntries(rrule.split(';').map(p => p.split('=')));
    const interval = parseInt(r.INTERVAL || 1);
    const until    = r.UNTIL ? this._parseDate(r.UNTIL) : null;
    const maxCount = r.COUNT ? parseInt(r.COUNT) : Infinity;
    const byDay    = r.BYDAY ? r.BYDAY.split(',') : null;
    const NAMES    = ['SU','MO','TU','WE','TH','FR','SA'];
    const DAY_MS   = 86400000;
    const results  = [];

    const emit = d => {
      if (exdates.has(d.toDateString())) return;
      if (d >= winStart && d <= winEnd)
        results.push({ ...base, start: new Date(d) });
    };

    if (r.FREQ === 'WEEKLY' && byDay) {
      const dayNames = byDay.map(d => d.replace(/^-?\d+/, ''));
      // align to Sunday of the event's start week
      const ws = new Date(base.start);
      ws.setDate(ws.getDate() - ws.getDay());
      let count = 0;
      while (ws <= winEnd && count < maxCount) {
        if (until && ws > until) break;
        for (let d = 0; d < 7; d++) {
          const day = new Date(ws.getTime() + d * DAY_MS);
          if (day < base.start) continue;
          if (count >= maxCount || (until && day > until)) { count = maxCount; break; }
          if (!dayNames.includes(NAMES[day.getDay()])) continue;
          count++;
          emit(day);
        }
        ws.setDate(ws.getDate() + 7 * interval);
      }
      return results;
    }

    let c = new Date(base.start);
    let count = 0;
    while (c <= winEnd && count < maxCount) {
      if (until && c > until) break;
      if (!byDay || byDay.some(d => d.endsWith(NAMES[c.getDay()]))) {
        emit(c);
        count++;
      }
      switch (r.FREQ) {
        case 'DAILY':   c = new Date(c.getTime() + interval * DAY_MS); break;
        case 'WEEKLY':  c = new Date(c.getTime() + interval * 7 * DAY_MS); break;
        case 'MONTHLY': c = new Date(c.getFullYear(), c.getMonth() + interval, c.getDate()); break;
        case 'YEARLY':  c = new Date(c.getFullYear() + interval, c.getMonth(), c.getDate()); break;
        default: c = new Date(c.getTime() + DAY_MS);
      }
    }
    return results;
  },

  // 'Now' while a timed event runs, 'in 25m' / 'in 2h 5m' within 3h of start.
  _badge(e) {
    if (e.allDay) return '';
    const now = Date.now(), s = e.start.getTime();
    if (s <= now && now < s + e.dur) return 'Now';
    const m = Math.round((s - now) / 60000);
    if (m <= 0 || m > 180) return '';
    return m < 60 ? `in ${m}m` : `in ${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
  },

  _render() {
    document.getElementById('card-body-calendar').innerHTML = this._html();
  },

  _html() {
    const { year, month } = this._view;
    const today = new Date(); today.setHours(0,0,0,0);
    const firstDow     = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const monthLabel   = new Date(year, month, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // index events by date string
    const byDate = {};
    for (const e of this._events) {
      const k = e.start.toDateString();
      (byDate[k] = byDate[k] || []).push(e);
    }

    // grid cells
    let cells = '<div class="cal-cell"></div>'.repeat(firstDow);
    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(year, month, d);
      const isToday = date.toDateString() === today.toDateString();
      const isSel   = date.toDateString() === this._selected?.toDateString();
      const hasDot  = date.toDateString() in byDate;
      const iso     = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells += `<div class="cal-cell${isToday ? ' cal-cell--today' : ''}${isSel && !isToday ? ' cal-cell--selected' : ''}" data-date="${iso}">
        ${d}${hasDot ? '<span class="cal-dot"></span>' : ''}
      </div>`;
    }

    // events list
    const selKey = this._selected?.toDateString();
    let eventsToShow, emptyMsg;
    if (selKey) {
      eventsToShow = byDate[selKey] || [];
      emptyMsg = 'No events this day';
    } else {
      const now = Date.now();
      eventsToShow = this._events
        .filter(e => e.start >= today && (e.allDay || e.start.getTime() + e.dur > now || e.start >= now))
        .slice(0, 6);
      emptyMsg = 'No upcoming events';
    }

    const eventsHtml = eventsToShow.length
      ? eventsToShow.map(e => {
          const isTod = e.start.toDateString() === today.toDateString();
          const isTom = e.start.toDateString() === new Date(today.getTime()+86400000).toDateString();
          const label = isTod ? 'Today' : isTom ? 'Tomorrow'
            : e.start.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
          const time  = e.allDay ? '' : ` · ${e.start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
          const badge = this._badge(e);
          return `<div class="cal-event${badge === 'Now' ? ' cal-event--now' : ''}">
            <div class="cal-event-when">${label}${time}</div>
            <div class="cal-event-title">${dashboard.esc(e.title)}</div>
            ${badge ? `<span class="cal-badge">${badge}</span>` : ''}
          </div>`;
        }).join('')
      : `<div class="cal-empty">${emptyMsg}</div>`;

    return `
      <div class="cal-top">
        <button class="cal-nav cal-prev">&#8249;</button>
        <span class="cal-month-label">${monthLabel}</span>
        <button class="cal-nav cal-next">&#8250;</button>
        <button class="wx-change" style="margin-left:auto">Change</button>
      </div>
      <div class="cal-grid">
        ${'Su Mo Tu We Th Fr Sa'.split(' ').map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-events">${eventsHtml}</div>`;
  }
});
