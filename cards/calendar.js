dashboard.register({
  id: 'calendar',
  title: 'Calendar',
  className: 'card--wide',

  render() {
    return `
      <form id="cal-setup" class="cal-setup">
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
      this._load(url);
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.cal-reset')) {
        localStorage.removeItem('dashboard-cal-ics');
        body.innerHTML = this.render();
      }
    });

    const saved = localStorage.getItem('dashboard-cal-ics');
    if (saved) this._load(saved);
  },

  async _load(icsUrl) {
    const body = document.getElementById('card-body-calendar');
    body.innerHTML = `<div class="weather-loading">Loading calendar…</div>`;
    try {
      const res = await fetch(`/proxy/ics?url=${encodeURIComponent(icsUrl)}`);
      if (!res.ok) throw new Error('Could not fetch calendar — is the server running?');
      const events = this._parse(await res.text());
      body.innerHTML = this._html(events);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${err.message}</div>` + this.render();
    }
  },

  _parse(text) {
    // unfold continued lines (RFC 5545)
    text = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const events = [];

    for (const block of text.split(/\nBEGIN:VEVENT\n/).slice(1)) {
      // ponytail: skipping RRULE (recurring events) — expand if most events are missing
      if (/^RRULE:/m.test(block)) continue;

      const get = key => {
        const m = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'm'));
        return m ? m[1].trim() : '';
      };

      const parseDate = s => {
        if (!s) return null;
        if (/^\d{8}$/.test(s))
          return { d: new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8)), allDay: true };
        const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
        if (!m) return null;
        const d = m[7] === 'Z'
          ? new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]))
          : new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]);
        return { d, allDay: false };
      };

      const dtLine = block.match(/^DTSTART[^\n]*/m)?.[0] ?? '';
      const dtValue = get('DTSTART');
      const parsed = parseDate(dtValue);
      if (!parsed) continue;

      events.push({
        title: get('SUMMARY') || '(No title)',
        start: parsed.d,
        allDay: parsed.allDay || dtLine.includes('VALUE=DATE'),
      });
    }

    return events.sort((a, b) => a.start - b.start);
  },

  _html(events) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const year = now.getFullYear();
    const month = now.getMonth();

    // days with events this month (for dots)
    const dotDays = new Set(
      events
        .filter(e => e.start.getFullYear() === year && e.start.getMonth() === month)
        .map(e => e.start.getDate())
    );

    // mini month grid
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let cells = '<div class="cal-cell cal-cell--empty"></div>'.repeat(firstDow);
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === now.getDate();
      cells += `<div class="cal-cell${isToday ? ' cal-cell--today' : ''}">
        ${d}${dotDays.has(d) && !isToday ? '<span class="cal-dot"></span>' : ''}
      </div>`;
    }

    // upcoming events
    const upcoming = events.filter(e => e.start >= today).slice(0, 6);
    const eventsHtml = upcoming.length
      ? upcoming.map(e => {
          const label = e.start < tomorrow ? 'Today'
            : e.start < new Date(tomorrow.getTime() + 86400000) ? 'Tomorrow'
            : e.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const time = e.allDay ? '' : ` · ${e.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          return `<div class="cal-event">
            <div class="cal-event-when">${label}${time}</div>
            <div class="cal-event-title">${e.title}</div>
          </div>`;
        }).join('')
      : '<div class="cal-empty">No upcoming events</div>';

    return `
      <div class="cal-top">
        <span class="cal-month-label">${monthLabel}</span>
        <button class="wx-change cal-reset">Change calendar</button>
      </div>
      <div class="cal-grid">
        ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div class="cal-weekday">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-events">${eventsHtml}</div>`;
  }
});
