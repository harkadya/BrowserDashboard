dashboard.register({
  id: 'todo',
  title: 'To do',
  className: 'card--wide',

  _items: [],

  render() {
    return `
      <form class="todo-form">
        <input class="weather-input" name="text" placeholder="Add a task and press Enter…" autocomplete="off" maxlength="200">
      </form>
      <ul class="todo-list"></ul>
      <div class="todo-foot"></div>`;
  },

  start() {
    try { this._items = JSON.parse(localStorage.getItem('dashboard-todo-items')) || []; } catch {}
    const body = document.getElementById('card-body-todo');

    body.addEventListener('submit', e => {
      e.preventDefault();
      const input = e.target.text, text = input.value.trim();
      if (!text) return;
      this._items.push({ id: Date.now(), text, done: false });
      input.value = '';
      this._save();
    });

    body.addEventListener('change', e => {
      const item = this._find(e.target);
      if (item) { item.done = e.target.checked; this._save(); }
    });

    body.addEventListener('click', e => {
      if (e.target.closest('.todo-del')) {
        const item = this._find(e.target);
        this._items = this._items.filter(i => i !== item);
        this._save();
      } else if (e.target.closest('.todo-clear')) {
        this._items = this._items.filter(i => !i.done);
        this._save();
      }
    });

    this._draw();
  },

  _find(el) {
    const id = Number(el.closest('[data-id]')?.dataset.id);
    return this._items.find(i => i.id === id);
  },

  _save() {
    localStorage.setItem('dashboard-todo-items', JSON.stringify(this._items));
    this._draw();
  },

  _draw() {
    const body = document.getElementById('card-body-todo');
    // open tasks first, then done; each group keeps insertion order
    const sorted = [...this._items].sort((a, b) => a.done - b.done);
    body.querySelector('.todo-list').innerHTML = sorted.map(i => `
      <li class="todo-item${i.done ? ' todo-item--done' : ''}" data-id="${i.id}">
        <label>
          <input type="checkbox"${i.done ? ' checked' : ''}>
          <span>${dashboard.esc(i.text)}</span>
        </label>
        <button class="todo-del" aria-label="Delete task">✕</button>
      </li>`).join('');
    const open = this._items.filter(i => !i.done).length, done = this._items.length - open;
    body.querySelector('.todo-foot').innerHTML = this._items.length
      ? `<span>${open} open</span>${done ? `<button class="todo-clear">Clear ${done} done</button>` : ''}`
      : `<span>Nothing to do. Nice.</span>`;
  }
});
