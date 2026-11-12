const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function setup(provider) {
  const calls = [];
  const values = new Map(provider ? [['faminaAuthProvider', provider]] : []);
  const window = {
    FAMINA_API_BASE: 'https://api.example.com/api',
    location: { origin: 'https://famina.example.com' },
    fetch: async (url, init) => { calls.push({ url, init }); return new Response('{}'); }
  };
  vm.runInNewContext(readFileSync(join(__dirname, '../assets/js/frontend-api.js'), 'utf8'), {
    window, location: { hostname: 'famina.example.com', origin: window.location.origin, href: window.location.origin + "/index.html" }, URL, Response, Headers,
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  });
  return { window, calls };
}
test('auth requests reach the configured server without fabricated sessions', async () => {
  const { window, calls } = setup();
  await window.fetch('https://api.example.com/api/auth/firebase', { method: 'POST', body: '{"idToken":"test"}' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.com/api/auth/firebase');
});
test('legacy localhost URLs forward to the configured backend', async () => {
  const { window, calls } = setup('firebase');
  await window.fetch('http://localhost:3001/api/cart?check=1', { headers: { Authorization: 'Bearer signed-session' } });
  assert.equal(calls[0].url, 'https://api.example.com/api/cart?check=1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer signed-session');
});
test('demo credentials never fabricate a local successful login', async () => { const {window,calls}=setup();await window.fetch('http://localhost:3001/api/auth/login',{method:'POST',body:JSON.stringify({email:'customer@demo.com',password:'123456'})});assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.example.com/api/auth/login');});
