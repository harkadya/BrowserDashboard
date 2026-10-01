const WMO = {
  0:  ['Clear sky',        '☀️'],
  1:  ['Mainly clear',     '🌤️'],
  2:  ['Partly cloudy',    '⛅'],
  3:  ['Overcast',         '☁️'],
  45: ['Fog',              '🌫️'],
  48: ['Icy fog',          '🌫️'],
  51: ['Light drizzle',    '🌦️'],
  53: ['Drizzle',          '🌦️'],
  55: ['Heavy drizzle',    '🌧️'],
  61: ['Light rain',       '🌧️'],
  63: ['Rain',             '🌧️'],
  65: ['Heavy rain',       '🌧️'],
  71: ['Light snow',       '🌨️'],
  73: ['Snow',             '❄️'],
  75: ['Heavy snow',       '❄️'],
  77: ['Snow grains',      '❄️'],
  80: ['Showers',          '🌦️'],
  81: ['Showers',          '🌧️'],
  82: ['Heavy showers',    '⛈️'],
  85: ['Snow showers',     '🌨️'],
  86: ['Snow showers',     '❄️'],
  95: ['Thunderstorm',     '⛈️'],
  96: ['Thunderstorm',     '⛈️'],
  99: ['Thunderstorm',     '⛈️'],
};

dashboard.register({
  id: 'weather',
  title: 'Weather',
  className: 'card--wide',

  render() {
    return `
      <form id="weather-form" class="weather-form">
        <input id="weather-input" class="weather-input" type="text"
               placeholder="Enter a city or place…" autocomplete="off">
        <button type="submit" class="weather-btn">Search</button>
      </form>`;
  },

  start() {
    const body = document.getElementById('card-body-weather');

    body.addEventListener('submit', e => {
      if (!e.target.closest('#weather-form')) return;
      e.preventDefault();
      const city = document.getElementById('weather-input').value.trim();
      if (city) this._fetch(city);
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.wx-change')) {
        localStorage.removeItem('dashboard-weather');
        body.innerHTML = this.render();
        body.querySelector('#weather-input').focus();
      }
    });

    const saved = localStorage.getItem('dashboard-weather');
    if (saved) {
      const loc = JSON.parse(saved);
      // Settings panel saves {name} only; card saves full {name,lat,lon,...}
      loc.lat ? this._fetchWeather(loc) : this._fetch(loc.name);
    }
  },

  async _fetch(city) {
    const body = document.getElementById('card-body-weather');
    body.innerHTML = `<div class="weather-loading">Searching for "${dashboard.esc(city)}"…</div>`;
    try {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      ).then(r => r.json());

      if (!geo.results?.length) throw new Error(`"${city}" not found — try a different spelling`);

      const loc = {
        name: geo.results[0].name,
        country: geo.results[0].country,
        admin1: geo.results[0].admin1 ?? '',
        lat: geo.results[0].latitude,
        lon: geo.results[0].longitude,
      };
      localStorage.setItem('dashboard-weather', JSON.stringify(loc));
      await this._fetchWeather(loc);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">${dashboard.esc(err.message)}</div>` + this.render();
    }
  },

  async _fetchWeather(loc) {
    const body = document.getElementById('card-body-weather');
    body.innerHTML = dashboard.skeleton(5);
    const f = localStorage.getItem('dashboard-weather-units') === 'f';
    try {
      await dashboard.cached(`weather-${loc.lat},${loc.lon}-${f ? 'f' : 'c'}`, 10 * 60 * 1000,
        () => dashboard.fetchJSON(
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${loc.lat}&longitude=${loc.lon}` +
          `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m,is_day` +
          `&hourly=temperature_2m,weathercode,precipitation_probability,is_day&forecast_hours=12` +
          `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,precipitation_probability_max` +
          (f ? `&temperature_unit=fahrenheit&windspeed_unit=mph` : '') +
          `&timezone=auto&forecast_days=7`),
        wx => body.innerHTML = this._html(loc, wx, f));
    } catch {
      body.innerHTML = `<div class="weather-error">Could not load weather data</div>` + this.render();
    }
  },

  // Clear/mainly-clear at night shows a moon instead of a sun.
  _icon(code, isDay = 1) {
    const [desc, icon] = WMO[code] ?? ['Unknown', '❓'];
    return [desc, !isDay && code <= 2 ? (code === 2 ? '☁️' : '🌙') : icon];
  },

  // 12-hour strip with a temperature sparkline drawn over it.
  _hourly(h) {
    const t = h.temperature_2m;
    const lo = Math.min(...t), hi = Math.max(...t), span = hi - lo || 1;
    const pts = t.map((v, i) => `${(i + 0.5) * 10},${26 - ((v - lo) / span) * 20}`).join(' ');
    const cells = h.time.map((time, i) => `
      <div class="hr-cell">
        <div class="hr-temp">${Math.round(t[i])}°</div>
        <div class="hr-icon">${this._icon(h.weathercode[i], h.is_day?.[i] ?? 1)[1]}</div>
        <div class="hr-pop">${h.precipitation_probability[i] >= 20 ? h.precipitation_probability[i] + '%' : ''}</div>
        <div class="hr-time">${i === 0 ? 'Now' : time.slice(11, 13)}</div>
      </div>`).join('');
    return `
      <div class="hr">
        <svg class="hr-line" viewBox="0 0 ${t.length * 10} 30" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"
                    vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
        <div class="hr-cells" style="grid-template-columns:repeat(${t.length},1fr)">${cells}</div>
      </div>`;
  },

  _html(loc, wx, f) {
    const cur = wx.current;
    const [desc, icon] = this._icon(cur.weathercode, cur.is_day);
    const place = [loc.name, loc.admin1, loc.country].filter(Boolean).join(', ');
    const d = wx.daily;

    const forecast = d.time.map((date, i) => {
      const label = i === 0
        ? 'Today'
        : new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' });
      const pop = d.precipitation_probability_max?.[i];
      return `
        <div class="fc-day${i === 0 ? ' fc-day--today' : ''}">
          <div class="fc-name">${label}</div>
          <div class="fc-icon">${this._icon(d.weathercode[i])[1]}</div>
          <div class="fc-hi">${Math.round(d.temperature_2m_max[i])}°</div>
          <div class="fc-lo">${Math.round(d.temperature_2m_min[i])}°</div>
          <div class="fc-pop">${pop >= 20 ? '💧' + pop + '%' : '&nbsp;'}</div>
        </div>`;
    }).join('');

    return `
      <div class="wx-header">
        <div>
          <div class="wx-loc">${dashboard.esc(place)}</div>
          <div class="wx-temp">${Math.round(cur.temperature_2m)}<span class="wx-unit">°${f ? 'F' : 'C'}</span></div>
          <div class="wx-desc">${icon} ${desc}</div>
          <div class="wx-meta">
            Feels like ${Math.round(cur.apparent_temperature)}° &nbsp;·&nbsp;
            ${cur.relative_humidity_2m}% humidity &nbsp;·&nbsp;
            ${Math.round(cur.windspeed_10m)} ${f ? 'mph' : 'km/h'} wind
          </div>
          <div class="wx-meta">↑ ${d.sunrise[0].slice(11)} &nbsp;·&nbsp; ↓ ${d.sunset[0].slice(11)}</div>
        </div>
        <button class="wx-change">Change location</button>
      </div>
      ${wx.hourly ? this._hourly(wx.hourly) : ''}
      <div class="fc">${forecast}</div>`;
  }
});
