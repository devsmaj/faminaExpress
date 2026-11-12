// Isolated UI fixtures only. This is not evidence of hosted OAuth, SMS, routing or Realtime delivery.
const { chromium } = require("../backend/node_modules/playwright");
const express = require("../backend/node_modules/express");
const assert = require("node:assert/strict");
const path = require("node:path");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const restaurant = {
  id: id(10),
  owner_id: id(3),
  name: "TEST RESTAURANT",
  cuisine: "TEST",
  description: "TEST ONLY",
  image: "https://images.example.test/food.png",
  latitude: 13.83,
  longitude: 20.83,
  available: true,
  approved: true,
  preparation_minutes: 20,
  commission_bps: 500,
};
const menu = {
  id: id(20),
  restaurant_id: restaurant.id,
  name: 'TEST <img src=x onerror="window.xss=1">',
  description: "TEST ONLY",
  category: "Pizza",
  image: restaurant.image,
  price: 1500,
  available: true,
  verified: true,
  restaurants: { available: true },
};
const address = {
  id: id(30),
  customer_id: id(2),
  label: "TEST ADDRESS",
  address: "TEST STREET",
  phone: "+23566000000",
  latitude: 13.84,
  longitude: 20.84,
};
let placed = 0,
  quoteRequests = 0,
  submitted;
const order = {
  id: id(50),
  customer_id: id(2),
  restaurant_id: restaurant.id,
  rider_id: id(4),
  status: "pending",
  subtotal: 3000,
  delivery_fee: 700,
  total: 3700,
  commission: 150,
  created_at: new Date().toISOString(),
  order_items: [{ ...menu, quantity: 2 }],
  address,
  duration_s: 1800,
  distance_m: 2000,
  route: {
    type: "LineString",
    coordinates: [
      [20.83, 13.83],
      [20.84, 13.84],
    ],
  },
  restaurants: restaurant,
  order_events: [
    { id: 1, status: "pending", created_at: new Date().toISOString() },
  ],
  location: null,
};
const app = express();
app.use(express.json());
app.get("/api/config", (q, s) =>
  s.json({
    configured: true,
    supabaseUrl: "https://fixture.example.test",
    supabaseAnonKey: "TEST_PUBLIC_ONLY",
  }),
);
app.get("/api/auth/me", (q, s) => {
  const role = (q.headers.authorization || "").split(" ")[1] || "customer";
  s.json({
    user: {
      id:
        role === "rider"
          ? id(4)
          : role === "restaurant_owner"
            ? id(3)
            : role === "admin"
              ? id(1)
              : id(2),
      role,
      active: true,
      name: "TEST USER",
      email: "test@example.test",
    },
  });
});
app.get("/api/restaurants", (q, s) => s.json([restaurant]));
app.get("/api/menu", (q, s) => s.json([menu]));
app.get("/api/cart", (q, s) => s.json([{ ...menu, quantity: 2 }]));
app.get("/api/addresses", (q, s) => s.json([address]));
app.get("/api/notifications", (q, s) => s.json([]));
app.post("/api/quotes", (q, s) => {
  quoteRequests++;
  s.json({
    id: id(40),
    restaurant_id: restaurant.id,
    address,
    items: [{ ...menu, quantity: 2 }],
    subtotal: 3000,
    delivery_fee: 700,
    total: 3700,
    distance_m: 2000,
    duration_s: 1800,
    route: order.route,
    expires_at: new Date(Date.now() + 300000).toISOString(),
  });
});
app.post("/api/orders", (q, s) => {
  placed++;
  submitted = { body: q.body, key: q.headers["idempotency-key"] };
  s.status(201).json(order);
});
app.get("/api/orders", (q, s) => s.json([order]));
app.get("/api/orders/:id", (q, s) =>
  s.json({
    ...order,
    delivery_code:
      q.headers.authorization === "Bearer customer" ? "123456" : null,
  }),
);
app.get("/api/restaurant-owner/restaurants", (q, s) => s.json([restaurant]));
app.get("/api/restaurant-owner/menu", (q, s) => s.json([menu]));
app.get("/api/admin/:table", (q, s) =>
  s.json(
    {
      orders: [order],
      restaurants: [restaurant],
      menu_items: [menu],
      profiles: [
        {
          id: id(3),
          name: "TEST OWNER",
          role: "restaurant_owner",
          active: true,
        },
        { id: id(4), name: "TEST RIDER", role: "rider", active: true },
      ],
      payments: [],
      refunds: [],
      delivery_zones: [],
    }[q.params.table] || [],
  ),
);
app.use(express.static(path.resolve(__dirname, "..")));
const sdk = (role) =>
  `window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:${JSON.stringify(role)}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},channel:()=>({on(){return this},subscribe(fn){fn?.('SUBSCRIBED');return this}}),removeChannel(){}})};`;
(async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "chrome",
      headless: true,
    });
    const errors = [];
    for (const [role, file] of [
      ["customer", "checkout.html"],
      ["restaurant_owner", "restaurant-owner-dashboard.html"],
      ["rider", "rider-dashboard.html"],
      ["admin", "admin-dashboard.html"],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
      });
      await context.addInitScript(() => {
        window.FAMINA_API_BASE = location.origin + "/api";
        localStorage.setItem("language", "en");
      });
      await context.route("**/assets/vendor/supabase.js", (r) =>
        r.fulfill({ contentType: "application/javascript", body: sdk(role) }),
      );
      await context.route("https://**/*", (r) => r.abort());
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(file + ": " + e.message));
      await page.goto(base + "/" + file);
      await page.waitForTimeout(1200);
      if (role === "customer") {
        await page.selectOption("#saved-address", address.id);
        await page.click("#request-quote");
        await page.waitForFunction(
          () =>
            !document.querySelector("#checkout-form [type=submit]").disabled,
        );
        assert.equal(quoteRequests, 1);
        assert(
          (await page.locator("#order-summary").innerText()).includes("3,700"),
        );
        assert.equal(await page.evaluate(() => window.xss), undefined);
        await page.click("#checkout-form [type=submit]");
        await page.waitForURL("**/delivery-tracking.html?order=*");
        await page.waitForSelector("#delivery-code");
        assert.equal(placed, 1);
        assert.deepEqual(submitted.body, {
          quoteId: id(40),
          paymentMethod: "cash_on_delivery",
        });
        assert.match(submitted.key, /^[0-9a-f-]{36}$/);
        assert(
          (await page.locator("#delivery-code").innerText()).includes("123456"),
        );
      }
      if (role === "restaurant_owner") {
        await page.click("[data-tab=menu]");
        await page.click("[data-edit-menu]");
        assert.equal(await page.inputValue("#item-price"), "1500");
        await page.click("#cancel-btn");
      }
      if (role === "rider")
        assert.equal(await page.locator("[data-share]").count(), 1);
      if (role === "admin") {
        await page.click("[data-admin-tab=restaurants]");
        await page.waitForSelector("#admin-form");
        assert.equal(await page.locator("#admin-owner_id option").count(), 1);
      }
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(300);
        for (const locale of ["en", "fr-TD", "ar-TD"]) {
          await page.evaluate(
            (locale) => window.i18n.setLanguage(locale),
            locale,
          );
          assert.equal(
            await page.locator("html").getAttribute("dir"),
            locale === "ar-TD" ? "rtl" : "ltr",
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
            file + " overflow at " + width + " " + locale,
          );
        }
      }
      console.log("UI verified: " + file + " / mobile + desktop / EN FR AR");
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      "No browser exceptions. All data above was isolated TEST fixture data.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
