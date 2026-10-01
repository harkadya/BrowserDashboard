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

console.log('ok');
