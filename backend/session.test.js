const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/session.js'), 'utf8');
function boot(state = {}) {
    const values = state.values || new Map();
    const sessionValues = state.sessionValues || new Map();
    const cookies = state.cookies || { value: '', written: '' };
    const events = [];
    const storage = entries => ({ getItem: key => entries.get(key) || null,
        setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) });
    const document = { addEventListener() {}, get cookie() { return cookies.value; },
        set cookie(value) { cookies.written = value; cookies.value = value.split(';')[0]; } };
    const sandbox = { location: new URL('https://example.com/faminaExpress/menu.html?restaurant=2#stay'), URL,
        localStorage: storage(values), sessionStorage: storage(sessionValues), document,
        window: { dispatchEvent: event => events.push(event.type) }, Event: class { constructor(type) { this.type = type; } },
        atob: value => Buffer.from(value, 'base64').toString('binary'), setTimeout: fn => fn() };
    vm.runInNewContext(source, sandbox);
    return { api: sandbox.window.FaminaSession, values, sessionValues, cookies, events, sandbox };
}
test('preferences use scoped, year-long Secure SameSite cookies without authentication secrets', () => {
    const state = boot();
    state.api.setPreference('language', 'ar-TD'); state.api.setPreference('theme', 'dark');
    state.api.save('frontend-token-test', { id: 1, email: 'customer@example.com' });
    assert.match(state.cookies.written, /Max-Age=31536000/);
    assert.match(state.cookies.written, /Path=\/faminaExpress\//);
    assert.match(state.cookies.written, /SameSite=Lax; Secure/);
    assert(!state.cookies.value.includes('token'));
    assert(!state.cookies.value.includes('customer'));
    assert.equal(boot(state).api.user().email, 'customer@example.com');
    state.values.delete('language'); state.values.delete('theme');
    const restored = boot(state);
    assert.equal(restored.api.getPreference('language'), 'ar-TD');
    assert.equal(restored.api.getPreference('theme'), 'dark');
});
test('sign-in return paths preserve query/hash and reject external or unrelated destinations', () => {
    const state = boot(); state.api.rememberPage();
    assert.equal(state.api.returnUrl(), 'https://example.com/faminaExpress/menu.html?restaurant=2#stay');
    assert.equal(state.api.returnUrl(), 'profile.html');
    for (const url of ['https://attacker.example/menu.html','https://example.com/other/menu.html','javascript:alert(1)']) {
        state.sessionValues.set('faminna_return_to', url);
        assert.equal(state.api.returnUrl(), 'profile.html');
    }
});
test('expired sessions clear sign-in state while retaining preferences and the current URL', () => {
    const state = boot(); state.api.setPreference('language','fr-TD');
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) - 60 })).toString('base64url');
    state.api.save('header.' + payload + '.signature', { id: 1 }, 'firebase');
    assert.equal(state.api.user(), null);
    assert.equal(state.values.get('token'), undefined);
    assert.equal(state.values.get('faminaAuthProvider'), undefined);
    assert.equal(state.values.get('language'),'fr-TD');
    assert.equal(state.sandbox.location.href,'https://example.com/faminaExpress/menu.html?restaurant=2#stay');
});
test('explicit logout clears identity without changing pages or deleting preferences', () => {
    const state = boot(); state.api.setPreference('theme','dark');
    state.api.save('frontend-token-test', { id: 1 }); state.api.clear();
    assert.equal(state.api.user(), null);
    assert.equal(state.api.getPreference('theme'),'dark');
    assert.equal(state.sandbox.location.pathname,'/faminaExpress/menu.html');
    assert(state.events.includes('famina-session-change'));
});
