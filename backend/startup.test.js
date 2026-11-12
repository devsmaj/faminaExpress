const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const jwt = require('jsonwebtoken');

for (const invalidKeys of [false, true]) {
  test(`real server starts and accepts orders with ${invalidKeys ? 'invalid' : 'missing'} optional VAPID keys`, async () => {
    const env = { ...process.env, PORT: '0', JWT_SECRET: 'startup-integration-secret' };
    for (const key of ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT']) delete env[key];
    if (invalidKeys) Object.assign(env, { VAPID_PUBLIC_KEY: 'YOUR_VAPID_PUBLIC_KEY', VAPID_PRIVATE_KEY: 'YOUR_VAPID_PRIVATE_KEY', VAPID_SUBJECT: 'mailto:test@example.com' });
    const runner = `const http = require('node:http');
      const listen = http.Server.prototype.listen;
      http.Server.prototype.listen = function (...args) {
        this.once('listening', () => console.log('READY:' + this.address().port));
        return listen.apply(this, args);
      };
      require('./server');`;
    const child = spawn(process.execPath, ['-e', runner], { cwd: __dirname, env, stdio: ['ignore','pipe','pipe'] });
    let output = '';
    child.stderr.on('data', data => output += data.toString());
    try {
      const port = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server failed to start: ' + output)), 10000);
        child.stdout.on('data', data => {
          output += data.toString();
          const match = output.match(/READY:(\d+)/);
          if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        });
        child.once('exit', code => { clearTimeout(timeout); reject(new Error('Server exited: ' + code + ' ' + output)); });
        child.once('error', error => { clearTimeout(timeout); reject(error); });
      });
      const base = 'http://127.0.0.1:' + port;
      let response = await fetch(base + '/health');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'ok');
      response = await fetch(base + '/api/menu');
      assert.equal(response.status, 200);
      response = await fetch(base + '/api/notifications/public-key');
      assert.equal(response.status, 503);
      response = await fetch(base + '/api/auth/firebase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 400);
      const token = jwt.sign({ id: 'startup-test-user', role: 'customer' }, env.JWT_SECRET);
      response = await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ items: [{ id: 1, quantity: 1 }], total: 12.99, paymentMethod: 'card' }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).userId, 'startup-test-user');
    } finally { child.kill(); }
  });
}
