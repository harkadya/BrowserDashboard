dashboard.register({
  id: 'clock',
  title: null,
  className: 'card--wide card--tall',

  render() {
    return `
      <div class="clock-time"><span class="clock-hm">--:--</span><span class="clock-sec">:--</span></div>
      <div class="clock-date">---</div>
    `;
  },

  start() {
    const hmEl   = document.querySelector('#card-body-clock .clock-hm');
    const secEl  = document.querySelector('#card-body-clock .clock-sec');
    const dateEl = document.querySelector('#card-body-clock .clock-date');

    const tick = () => {
      const now = new Date();
      hmEl.textContent  = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      secEl.textContent = ':' + String(now.getSeconds()).padStart(2, '0');
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    };

    tick();
    setInterval(tick, 1000);
  }
});
