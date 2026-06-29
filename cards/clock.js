dashboard.register({
  id: 'clock',
  title: null,
  className: 'card--wide',

  render() {
    return `
      <div class="clock-time">--:--</div>
      <div class="clock-date">---</div>
    `;
  },

  start() {
    const timeEl = document.querySelector('#card-body-clock .clock-time');
    const dateEl = document.querySelector('#card-body-clock .clock-date');

    const tick = () => {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    };

    tick();
    setInterval(tick, 1000);
  }
});
