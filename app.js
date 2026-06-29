const dashboard = {
  cards: [],

  register(card) {
    this.cards.push(card);
  },

  init() {
    // Greeting
    const hour = new Date().getHours();
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const greetingEl = document.createElement('div');
    greetingEl.id = 'greeting';
    greetingEl.innerHTML = `Good ${period}`;
    document.body.insertBefore(greetingEl, document.getElementById('dashboard'));

    // Cards
    const el = document.getElementById('dashboard');
    el.innerHTML = this.cards.map(c => `
      <div class="card${c.className ? ' ' + c.className : ''}" id="card-${c.id}">
        ${c.title ? `<div class="card-title">${c.title}</div>` : ''}
        <div id="card-body-${c.id}">${c.render()}</div>
      </div>
    `).join('');

    this.cards.forEach(c => c.start?.());
  }
};
