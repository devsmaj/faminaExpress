const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
test("real server starts without a database and does not accept demo orders", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `const http=require('http');const listen=http.Server.prototype.listen;http.Server.prototype.listen=function(...a){this.once('listening',()=>console.log('READY:'+this.address().port));return listen.apply(this,a)};require('./server')`,
    ],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        PORT: "0",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Server startup timeout")),
        10000,
      );
      child.stdout.on("data", (d) => {
        const match = String(d).match(/READY:(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.once("error", reject);
    });
    const base = "http://127.0.0.1:" + port;
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/api/menu")).status, 503);
    assert.equal(
      (
        await fetch(base + "/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
  } finally {
    child.kill();
  }
});
