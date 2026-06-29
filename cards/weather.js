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
  className: 'card--full',

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
    body.innerHTML = `<div class="weather-loading">Searching for "${city}"…</div>`;
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
      body.innerHTML = `<div class="weather-error">${err.message}</div>` + this.render();
    }
  },

  async _fetchWeather(loc) {
    const body = document.getElementById('card-body-weather');
    body.innerHTML = `<div class="weather-loading">Loading weather for ${loc.name}…</div>`;
    try {
      const wx = await fetch(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
        `&timezone=auto&forecast_days=7`
      ).then(r => r.json());

      body.innerHTML = this._html(loc, wx);
    } catch (err) {
      body.innerHTML = `<div class="weather-error">Could not load weather data</div>` + this.render();
    }
  },

  _html(loc, wx) {
    const cur = wx.current;
    const [desc, icon] = WMO[cur.weathercode] ?? ['Unknown', '❓'];

    const place = [loc.name, loc.admin1, loc.country].filter(Boolean).join(', ');

    const forecast = wx.daily.time.map((date, i) => {
      const [, dayIcon] = WMO[wx.daily.weathercode[i]] ?? ['', '❓'];
      const label = i === 0
        ? 'Today'
        : new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' });
      return `
        <div class="fc-day">
          <div class="fc-name">${label}</div>
          <div class="fc-icon">${dayIcon}</div>
          <div class="fc-hi">${Math.round(wx.daily.temperature_2m_max[i])}°</div>
          <div class="fc-lo">${Math.round(wx.daily.temperature_2m_min[i])}°</div>
        </div>`;
    }).join('');

    return `
      <div class="wx-header">
        <div>
          <div class="wx-loc">${place}</div>
          <div class="wx-temp">${Math.round(cur.temperature_2m)}<span class="wx-unit">°C</span></div>
          <div class="wx-desc">${icon} ${desc}</div>
          <div class="wx-meta">
            Feels like ${Math.round(cur.apparent_temperature)}° &nbsp;·&nbsp;
            ${cur.relative_humidity_2m}% humidity &nbsp;·&nbsp;
            ${Math.round(cur.windspeed_10m)} km/h wind
          </div>
        </div>
        <button class="wx-change">Change location</button>
      </div>
      <div class="fc">${forecast}</div>`;
  }
});
