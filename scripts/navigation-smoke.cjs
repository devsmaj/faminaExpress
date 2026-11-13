// Browser navigation/auth tests use isolated fixtures, never live user accounts or business data.
const { chromium } = require("../backend/node_modules/playwright");
const express = require("../backend/node_modules/express");
const assert = require("node:assert/strict");
const path = require("node:path");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = {
  id: id(20),
  restaurant_id: id(10),
  name: "TEST FOOD",
  description: "TEST ONLY",
  image: "https://fixture.example/food.jpg",
  category: "Pizza",
  price: 1500,
  available: true,
  verified: true,
  restaurants: { available: true },
};
const customerCart = new Map([
    ["customer", 3],
    ["customerB", 1],
  ]),
  receipts = new Set();
let failMerge = false,
  loseResponse = false,
  merges = 0;
const privateCalls = [];
let holdCart = false;
const pendingCarts = [];
const app = express();
app.use(express.json());
app.get("/api/config", (q, s) =>
  s.json({
    configured: true,
    supabaseUrl: "https://fixture.example",
    supabaseAnonKey: "TEST_PUBLIC",
  }),
);
let holdMenu = false, menuFailure = false;
const menuResponses = [];
app.get("/api/menu", (q, s) => {
  const send = () => menuFailure ? s.status(503).json({message:"TEST menu unavailable"}) : s.json([item]);
  if (holdMenu) menuResponses.push(send);
  else send();
});
app.get("/api/restaurants", (q, s) => s.json([]));
app.get("/api/auth/me", (q, s) => {
  const token = q.headers.authorization?.slice(7);
  s.json({
    user: {
      id: id(
        token === "customerB"
          ? 5
          : token === "rider"
            ? 4
            : token === "restaurant_owner"
              ? 3
              : token === "admin"
                ? 1
                : 2,
      ),
      role: token === "customerB" ? "customer" : token,
      name: "TEST USER",
      active: true,
    },
  });
});
app.get("/api/cart", (q, s) => {
  const quantity = customerCart.get(q.headers.authorization?.slice(7)) || 0;
  const send = () => s.json(quantity ? [{ ...item, quantity }] : []);
  if (holdCart) pendingCarts.push(send);
  else send();
});
app.post("/api/cart", (q, s) => {
  const user = q.headers.authorization.slice(7);
  customerCart.set(user, (customerCart.get(user) || 0) + q.body.quantity);
  s.json({ ok: true });
});
app.put("/api/cart/:id", (q, s) => {
  customerCart.set(q.headers.authorization.slice(7), q.body.quantity);
  s.json({ ok: true });
});
app.delete("/api/cart/:id", (q, s) => {
  customerCart.set(q.headers.authorization.slice(7), 0);
  s.json({ ok: true });
});
app.post("/api/cart/merge", (q, s) => {
  merges++;
  if (failMerge)
    return s.status(409).json({ message: "One restaurant per order" });
  const user = q.headers.authorization.slice(7),
    key = user + ":" + q.body.importKey;
  if (!receipts.has(key)) {
    customerCart.set(
      user,
      (customerCart.get(user) || 0) +
        q.body.items.reduce((sum, i) => sum + i.quantity, 0),
    );
    receipts.add(key);
  }
  if (loseResponse) {
    loseResponse = false;
    return s.status(503).json({ message: "TEST response lost after commit" });
  }
  s.json({ ok: true });
});
app.get("/api/orders", (q, s) => {
  privateCalls.push(q.headers.authorization);
  s.json([{ id: id(50), status: "preparing", total: 3700, order_items: [] }]);
});
app.get("/api/addresses", (q, s) => s.json([]));
app.get("/api/notifications", (q, s) => s.json([]));
app.use(express.static(path.resolve(__dirname, "..")));
const sdk = `window.supabase={createClient:()=>{let listener;const session=()=>{const role=localStorage.getItem('TEST_ROLE');return role?{access_token:role}:null};window.TEST_AUTH=role=>{if(role)localStorage.setItem('TEST_ROLE',role);else localStorage.removeItem('TEST_ROLE');listener?.(role?'SIGNED_IN':'SIGNED_OUT',session());};return {auth:{getSession:async()=>({data:{session:session()}}),onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}}},signInWithOAuth:async()=>{if(window.TEST_OAUTH_FAIL)return {error:Error("TEST Google unavailable")};localStorage.setItem('TEST_ROLE','customer');location.href='login.html?code=TEST';return {error:null};},signOut:async()=>{if(window.TEST_SIGN_OUT_WAIT)await new Promise(resolve=>window.TEST_RESOLVE_SIGN_OUT=resolve);if(window.TEST_SIGN_OUT_FAIL)return {error:Error('TEST sign-out failure')};localStorage.removeItem('TEST_ROLE');listener?.('SIGNED_OUT',null);return {error:null};}},channel:()=>({on(){return this},subscribe(fn){fn?.('SUBSCRIBED');return this}}),removeChannel(){}}}};`;
(async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "chrome",
      headless: true,
    });
    async function context(role) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
        reducedMotion: "reduce",
      });
      context.setDefaultNavigationTimeout(60000);
      context.setDefaultTimeout(60000);
      await context.addInitScript((role) => {
        window.FAMINA_API_BASE = location.origin + "/api";
        if (!sessionStorage.getItem("TEST_INITIALIZED")) {
          localStorage.setItem("language", "en");
          if (role) localStorage.setItem("TEST_ROLE", role);
          sessionStorage.setItem("TEST_INITIALIZED", "true");
        }
      }, role);
      await context.route("**/assets/vendor/supabase.js", (r) =>
        r.fulfill({ contentType: "application/javascript", body: sdk }),
      );
      await context.route("https://**/*", (r) => r.abort());
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      return { context, page };
    }
    const publicKeys = ["home", "explore", "restaurants", "about", "cart"],
      customerKeys = [
        "home",
        "explore",
        "restaurants",
        "cart",
        "orders",
        "track",
        "profile",
      ];
    async function ready(page) {
      await page.waitForFunction(async () => {
        if (!window.Famina?.Navigation || !document.querySelector("[data-navigation-link]")) return false;
        await Famina.ready;
        return !((location.pathname.endsWith("/index.html") || location.pathname.endsWith("/")) && Famina.user?.role === "customer");
      });
      await page.waitForTimeout(100);
    }
    async function keys(page) {
      return page
        .locator("[data-navigation-link]")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.navigationLink));
    }
    async function open(page) {
      await page.locator(".hamburger").click();
      await page.waitForTimeout(250);
      assert.equal(
        await page.locator(".hamburger").getAttribute("aria-expanded"),
        "true",
      );
      assert.equal(
        await page.locator(".nav").getAttribute("aria-modal"),
        "true",
      );
    }
    const { context: guest, page } = await context();
    holdMenu = true;
    await page.goto(base + "/menu.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".page-skeleton");
    assert.equal(await page.locator("main").getAttribute("aria-busy"), "true");
    await page.waitForFunction(() => document.documentElement.classList.contains("page-loading"));
    const menuDeadline = Date.now() + 10000;
    while (!menuResponses.length && Date.now() < menuDeadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert(menuResponses.length, "menu request never started");
    holdMenu = false;
    menuResponses.splice(0).forEach(send => send());
    await page.waitForFunction(() => !document.documentElement.classList.contains("page-loading"));
    assert.equal(await page.locator(".header-skeleton").count(),0);
    menuFailure = true;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => !document.documentElement.classList.contains("page-loading"));
    assert.match(await page.locator("#menu-items").innerText(), /temporarily unavailable/);
    assert.equal(await page.locator("main").getAttribute("aria-busy"),null);
    menuFailure = false;
    await page.reload({waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => !document.documentElement.classList.contains("page-loading"));
    console.log("Skeletons track pending requests and release on success/failure.");
    await ready(page);
    assert.deepEqual(await keys(page), publicKeys);
    assert.equal(await page.locator(".nav").evaluate((n) => n.inert), true);
    await page.locator("[data-add-item]").click();
    await page.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "1",
    );
    await page.locator("[data-add-item]").click();
    await page.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "2",
    );
    const draft = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("famina_guest_cart_v1")),
    );
    assert.deepEqual(Object.keys(draft.items[0]).sort(), [
      "itemId",
      "quantity",
    ]);
    for (const href of [
      "index.html",
      "menu.html",
      "restaurant.html",
      "about.html",
      "cart.html",
    ]) {
      await open(page);
      await page.locator('.nav-list a[href="' + href + '"]').click();
      await page.waitForURL("**/" + href);
      await ready(page);
      assert.equal(await page.locator("#footer").count(), ["index.html", "about.html"].includes(href) ? 1 : 0);
      await page.waitForFunction(
        () => document.getElementById("cart-count")?.textContent === "2",
      );
    }
    console.log("Public navigation and guest cart passed.");
    await page.reload();
    await ready(page);
    assert(
      (await page.locator("#cart-items").innerText()).includes("TEST FOOD"),
    );
    await open(page);
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(
        () => document.activeElement.closest("#auth-links") !== null,
      ),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document.activeElement.classList.contains("mobile-menu-brand"),
      ),
      true,
    );
    await page.locator("[data-language-toggle]").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#language-menu").isHidden(), true);
    assert.equal(
      await page.locator(".hamburger").getAttribute("aria-expanded"),
      "true",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".hamburger").getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      await page
        .locator(".hamburger")
        .evaluate((n) => n === document.activeElement),
      true,
    );
    for (const locale of ["fr-TD", "ar-TD", "en"]) {
      await open(page);
      await page.locator("[data-language-toggle]").click();
      await page.locator('[data-language-choice="' + locale + '"]').click();
      assert.equal(
        await page.locator("html").getAttribute("dir"),
        locale === "ar-TD" ? "rtl" : "ltr",
      );
      assert.deepEqual(await keys(page), publicKeys);
      await page.keyboard.press("Escape");
    }
    await open(page);
    await page.locator("#auth-links a").click();
    await page.waitForURL("**/login.html");
    await ready(page);
    await page.evaluate(() => window.TEST_OAUTH_FAIL = true);
    await page.click("#google-continue");
    await page.waitForSelector(".toast-error");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("famina-login-success")), null);
    assert.equal(await page.locator(".toast-success").count(), 0);
    await page.evaluate(() => window.TEST_OAUTH_FAIL = false);
    await page.click("#google-continue");
    await page.waitForURL("**/cart.html");
    await ready(page);
    await page.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "5",
    );
    assert.deepEqual(await keys(page), customerKeys);
    assert.equal(customerCart.get("customer"), 5);
    assert.equal(await page.locator("#footer").count(), 0);
    await page.waitForSelector(".toast-success");
    assert.match(await page.locator(".toast-success").innerText(), /Login successful/);
    await page.reload({waitUntil:"domcontentloaded"});
    await ready(page);
    assert.equal(await page.locator(".toast-success").count(),0);
    await page.evaluate(() => {
      const b = document.createElement("button"); b.id="TEST_LOADING_BUTTON";
      b.innerHTML='<svg aria-hidden="true"></svg><span>TEST action</span>';
      document.querySelector("main").append(b);
      window.TEST_BUSY = Famina.busy(b,()=>new Promise(resolve=>window.TEST_RESOLVE_BUSY=resolve));
    });
    assert.equal(await page.locator("#TEST_LOADING_BUTTON").isDisabled(),true);
    assert.equal(await page.locator("#TEST_LOADING_BUTTON .button-loading-ring").count(),1);
    assert.equal(await page.locator("#TEST_LOADING_BUTTON svg").count(),1);
    await page.evaluate(async()=>{TEST_RESOLVE_BUSY();await TEST_BUSY;});
    assert.equal(await page.locator("#TEST_LOADING_BUTTON").isDisabled(),false);
    assert.equal(await page.locator("#TEST_LOADING_BUTTON .button-loading-ring").count(),0);
    console.log("Login return, success alert and inline loading passed.");
    for (const href of [
      "customer-home.html",
      "menu.html",
      "restaurant.html",
      "cart.html",
      "orders.html",
      "profile.html",
    ]) {
      await open(page);
      await page.locator('.nav-list a[href="' + href + '"]').click();
      await page.waitForURL("**/" + href);
      await ready(page);
      if (href === "customer-home.html") {
        assert.equal(await page.locator("#footer").count(), 1);
        await page.waitForFunction(() => document.getElementById("customer-home-name")?.textContent === "TEST USER");
        await page.reload({ waitUntil: "domcontentloaded" });
        await ready(page);
        assert.equal(await page.evaluate(() => Famina.user?.role), "customer");
      } else {
        assert.equal(await page.locator("#footer").count(), 0);
      }
      await page.waitForFunction(
        () => document.getElementById("cart-count")?.textContent === "5",
      );
    }
    assert.equal(
      await page.evaluate(() => localStorage.getItem("famina_guest_cart_v1")),
      null,
    );
    await open(page);
    await page.locator("[data-navigation-link=track]").click();
    await page.waitForURL("**/delivery-tracking.html");
    await page.waitForSelector("#track-order-list a");
    assert(
      (await page.locator("#track-order-list a").getAttribute("href")).includes(
        id(50),
      ),
    );
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const locale of ["en", "fr-TD", "ar-TD"]) {
        await page.evaluate((locale) => i18n.setLanguage(locale), locale);
        await page.waitForTimeout(150);
        const labels = {
          en: ["Explore Food", "My Orders", "My Profile"],
          "fr-TD": ["Explorer les plats", "Mes commandes", "Mon profil"],
          "ar-TD": ["استكشف الأطباق", "طلباتي", "ملفي الشخصي"],
        }[locale];
        for (const [index, key] of ["explore", "orders", "profile"].entries())
          assert.equal(
            await page
              .locator("[data-navigation-link=" + key + "] span")
              .first()
              .textContent(),
            labels[index],
          );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          "navigation overflow " + width + " " + locale,
        );
        if (width >= 1280) {
          const boxes = await page.evaluate(() => {
            const b = (s) =>
              document.querySelector(s).getBoundingClientRect().toJSON();
            return {
              logo: b(".header .logo"),
              list: b(".nav-list"),
              actions: b(".header-actions"),
            };
          });
          assert(
            boxes.logo.right <= boxes.list.left &&
              boxes.list.right <= boxes.actions.left,
            "desktop header overlap " + width + " " + locale,
          );
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.NAV_PREVIEW_DIR) {
      const fs = require("node:fs");
      fs.mkdirSync(process.env.NAV_PREVIEW_DIR, { recursive: true });
      for (const locale of ["en", "ar-TD"]) {
        await page.evaluate((locale) => i18n.setLanguage(locale), locale);
        await open(page);
        await page.screenshot({
          path: path.join(
            process.env.NAV_PREVIEW_DIR,
            "customer-menu-" + locale + ".png",
          ),
        });
        await page.keyboard.press("Escape");
      }
    }
    await page.evaluate(() => i18n.setLanguage("en"));
    await open(page);
    await page.click("[data-sign-out]");
    await page.waitForSelector("dialog[open]");
    assert.equal(await page.locator("[data-cancel-sign-out]").evaluate(el=>el===document.activeElement),true);
    await page.click("[data-cancel-sign-out]");
    assert.equal(await page.evaluate(()=>Famina.user.role),"customer");
    await open(page);
    await page.click("[data-sign-out]");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(),0);
    assert.equal(await page.evaluate(()=>Famina.user.role),"customer");
    await open(page);
    await page.evaluate(() => (window.TEST_SIGN_OUT_FAIL = true));
    await page.click("[data-sign-out]");
    await page.click("[data-confirm-sign-out]");
    await page.waitForSelector("dialog",{state:"detached"});
    assert.deepEqual(await keys(page), customerKeys);
    assert.equal(await page.evaluate(() => Famina.user.role), "customer");
    await page.evaluate(() => {window.TEST_SIGN_OUT_FAIL = false;window.TEST_SIGN_OUT_WAIT=true;});
    await open(page);
    await page.click("[data-sign-out]");
    await page.click("[data-confirm-sign-out]");
    await page.waitForSelector("[data-confirm-sign-out][aria-busy=true] .button-loading-ring");
    assert.equal(await page.locator("[data-cancel-sign-out]").isDisabled(),true);
    await page.evaluate(()=>TEST_RESOLVE_SIGN_OUT());
    await page.waitForFunction(() => Famina.user === null);
    await page.waitForTimeout(150);
    assert.deepEqual(await keys(page), publicKeys);
    assert.equal(await page.locator("#track-order-list").count(), 0);
    assert.equal(
      await page.locator(".hamburger").getAttribute("aria-expanded"),
      "false",
    );
    await page.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "0",
    );
    assert.equal(customerCart.get("customer"), 5);
    // A different customer must see their own server cart rather than the signed-out customer's.
    await page.evaluate(() => TEST_AUTH("customerB"));
    await page.waitForFunction(() => Famina.user?.id.endsWith("000000000005"));
    await page.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "1",
    );
    const otherTab = await guest.newPage();
    otherTab.on("pageerror", (error) => errors.push(error.message));
    await otherTab.goto(base + "/index.html", {
      waitUntil: "domcontentloaded",
    });
    await ready(otherTab);
    await otherTab.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "1",
    );
    await page.evaluate((item) => Famina.Cart.add(item, 1), item.id);
    await otherTab.waitForFunction(
      () => document.getElementById("cart-count")?.textContent === "2",
    );
    await otherTab.close();
    await guest.close();
    console.log(
      "Customer navigation, languages, sign-out and cross-tab counts passed.",
    );
    const visitor = await context();
    for (const href of [
      "orders.html",
      "customer-home.html",
      "checkout.html",
      "profile.html",
      "delivery-tracking.html",
      "restaurant-owner-dashboard.html",
      "rider-dashboard.html",
      "admin-dashboard.html",
    ]) {
      const before = privateCalls.length;
      await visitor.page.goto(base + "/" + href, {
        waitUntil: "domcontentloaded",
      });
      await ready(visitor.page);
      await visitor.page.waitForSelector('main a[href="login.html"]');
      assert.equal(
        privateCalls.length,
        before,
        "visitor made private request on " + href,
      );
      assert.equal(
        await visitor.page
          .locator(
            "#profile-form,#rider-orders,#admin-content,.dashboard-tabs,.tracking-grid",
          )
          .count(),
        0,
      );
    }
    await visitor.context.close();
    console.log("Visitor private-route guards passed.");
    for (const role of ["restaurant_owner", "rider", "admin"]) {
      const staff = await context(role);
      await staff.page.goto(base + "/index.html", {
        waitUntil: "domcontentloaded",
      });
      await ready(staff.page);
      assert.deepEqual(await keys(staff.page), [
        "home",
        "explore",
        "restaurants",
        "dashboard",
      ]);
      const expected = {
        restaurant_owner: "restaurant-owner-dashboard.html",
        rider: "rider-dashboard.html",
        admin: "admin-dashboard.html",
      }[role];
      assert.equal(
        await staff.page
          .locator("[data-navigation-link=dashboard]")
          .getAttribute("href"),
        expected,
      );
      await staff.page.goto(base + "/profile.html", {
        waitUntil: "domcontentloaded",
      });
      await ready(staff.page);
      assert.equal(await staff.page.locator("#profile-form").count(), 0);
      await staff.context.close();
    }
    // An import failure retains the exact draft; a retry after a lost response must not double quantities.
    const retry = await context("customer");
    await retry.page.goto(base + "/cart.html", {
      waitUntil: "domcontentloaded",
    });
    await ready(retry.page);
    failMerge = true;
    await retry.page.evaluate(
      ({ item, key }) =>
        localStorage.setItem(
          "famina_guest_cart_v1",
          JSON.stringify({ key, items: [{ itemId: item, quantity: 2 }] }),
        ),
      { item: item.id, key: id(700) },
    );
    assert.equal(await retry.page.evaluate(() => Famina.Cart.merge()), false);
    assert(await retry.page.evaluate(() => Famina.Cart.hasGuestItems()));
    failMerge = false;
    loseResponse = true;
    const before = customerCart.get("customer");
    assert.equal(await retry.page.evaluate(() => Famina.Cart.merge()), false);
    assert.equal(customerCart.get("customer"), before + 2);
    assert.equal(await retry.page.evaluate(() => Famina.Cart.merge()), true);
    assert.equal(customerCart.get("customer"), before + 2);
    assert.equal(
      await retry.page.evaluate(() => Famina.Cart.hasGuestItems()),
      false,
    );
    holdCart = true;
    await retry.page.evaluate(() => {
      window.TEST_PENDING_CART = window.renderCartItems();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert(pendingCarts.length > 0);
    await retry.page.evaluate(() => TEST_AUTH(null));
    await retry.page.waitForFunction(() => Famina.user === null);
    holdCart = false;
    pendingCarts.splice(0).forEach((send) => send());
    await retry.page.evaluate(() => window.TEST_PENDING_CART);
    await retry.page.waitForTimeout(100);
    assert.equal(
      (await retry.page.locator("#cart-items").innerText()).includes(
        "TEST FOOD",
      ),
      false,
      "old customer cart reappeared after sign-out",
    );
    await retry.context.close();
    console.log("Cart retry and delayed-response isolation passed.");
    const failedHeader = await context();
    await failedHeader.context.route("**/components/header.html", route => route.fulfill({status:503,body:"TEST unavailable"}));
    await failedHeader.page.goto(base + "/about.html", {waitUntil:"domcontentloaded"});
    await failedHeader.page.waitForSelector(".header-component-error");
    await failedHeader.page.waitForFunction(() => !document.documentElement.classList.contains("page-loading"));
    assert.equal(await failedHeader.page.locator(".header-skeleton").count(),0);
    await failedHeader.context.close();
    assert.deepEqual(errors, []);
    console.log(
      "Navigation passed: public/customer/staff menus, guest cart/login merge/retry/isolation, sign-out failures, private routes, Track Order chooser, keyboard/RTL and 320–1440px layouts.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
