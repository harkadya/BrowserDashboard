// Self-check for the app.js helpers that guard against XSS.
// Run: node tests.js   (no deps — loads app.js into a bare VM context)
const fs = require('fs'), vm = require('vm'), assert = require('assert');

const ctx = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(__dirname + '/app.js', 'utf8') + '\nthis.dashboard = dashboard;', ctx);
const d = ctx.dashboard;

assert.strictEqual(d.esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
assert.strictEqual(d.esc("it's & ok"), 'it&#39;s &amp; ok');
assert.strictEqual(d.esc(null), '');

assert.strictEqual(d.url('javascript:alert(1)'), '#');
assert.strictEqual(d.url('data:text/html,hi'), '#');
assert.strictEqual(d.url('not a url'), '#');
assert.strictEqual(d.url('https://a.com/?q="x"'), 'https://a.com/?q=%22x%22');
assert.strictEqual(d.url('http://a.com/a&b'), 'http://a.com/a&amp;b');

const now = Date.now();
assert.strictEqual(d.ago(now), 'just now');
assert.strictEqual(d.ago(now - 5 * 60e3), '5m ago');
assert.strictEqual(d.ago(now - 3 * 3600e3), '3h ago');
assert.strictEqual(d.ago(now - 2 * 86400e3), '2d ago');

// Calendar ICS parsing: DTEND → duration, escaped SUMMARY, weekly RRULE.
const cards = {};
ctx.dashboard.register = c => { cards[c.id] = c; };
vm.runInContext(fs.readFileSync(__dirname + '/cards/calendar.js', 'utf8'), ctx);
const cal = cards.calendar;
const t = new Date(Date.now() + 86400e3);   // tomorrow, local time
const ymd = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', `DTSTART:${ymd}T090000`, `DTEND:${ymd}T103000`,
  'SUMMARY:Standup\\, daily', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;COUNT=3', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
const evs = cal._parse(ics);
assert.strictEqual(evs.length, 3);
assert.strictEqual(evs[0].title, 'Standup, daily');
assert.strictEqual(evs[0].dur, 90 * 60e3);

assert.strictEqual(cal._badge({ allDay: false, start: new Date(Date.now() - 60e3), dur: 30 * 60e3 }), 'Now');
assert.strictEqual(cal._badge({ allDay: false, start: new Date(Date.now() + 25 * 60e3 + 1e3), dur: 0 }), 'in 25m');
assert.strictEqual(cal._badge({ allDay: false, start: new Date(Date.now() + 125 * 60e3 + 1e3), dur: 0 }), 'in 2h 5m');
assert.strictEqual(cal._badge({ allDay: false, start: new Date(Date.now() + 5 * 3600e3), dur: 0 }), '');

// Quick links parsing
vm.runInContext(fs.readFileSync(__dirname + '/cards/links.js', 'utf8'), ctx);
const links = cards.links.parse('GitHub | github.com\nhttps://www.example.org/x\nBad | javascript:alert(1)\n\n');
assert.strictEqual(JSON.stringify(links.map(l => [l.name, l.url])),   // JSON: arrays are cross-realm
  JSON.stringify([['GitHub', 'https://github.com/'], ['example.org', 'https://www.example.org/x']]));

console.log('ok');
