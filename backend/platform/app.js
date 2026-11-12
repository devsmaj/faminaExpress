const express = require("express");
const cors = require("cors");
const { createSupabase, ApiError } = require("./supabase");
const { roadRoute, validPoint } = require("./routing");
const uuid = (value) => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApiError(400, "Invalid identifier.");
  return value;
};
const integer = (n, min, max) => {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new ApiError(400, "Invalid quantity or amount.");
  return n;
};
const text = (s, max = 500) => {
  if (typeof s !== "string" || !s.trim() || s.length > max)
    throw new ApiError(400, "Required information is missing or too long.");
  return s.trim();
};
function createApp({
  env = process.env,
  db = createSupabase(env),
  route = (a, b) => roadRoute(a, b, env),
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  const origins = (
    env.FRONTEND_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((s) => s.trim());
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
    next();
  });
  app.use(
    cors({
      origin: (origin, done) => done(null, !origin || origins.includes(origin)),
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "64kb", strict: true }));
  const hits = new Map();
  app.use("/api", (req, res, next) => {
    const now = Date.now(),
      key = req.socket.remoteAddress;
    if (hits.size > 10000) hits.clear();
    const record = hits.get(key);
    const current =
      record && record.until > now ? record : { count: 0, until: now + 60000 };
    hits.set(key, current);
    if (++current.count > 300)
      return res
        .status(429)
        .json({ message: "Too many requests. Please wait." });
    next();
  });
  const run = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const authenticate = async (req, res, next) => {
    try {
      const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
      req.token = match?.[1];
      req.user = await db.authenticate(req.token);
      next();
    } catch (e) {
      next(e);
    }
  };
  const role = (wanted) => (req, res, next) =>
    req.user.role === wanted
      ? next()
      : next(new ApiError(403, "Access denied."));
  app.get("/", (req, res) =>
    res.json({ service: "FA-MINNA Express API", health: "/health" }),
  );
  app.get("/health", (req, res) =>
    res.json({
      status: "ok",
      databaseConfigured: db.configured,
      paymentsLive: false,
    }),
  );
  app.get("/api/config", (req, res) =>
    res.json({
      supabaseUrl: db.url || "",
      supabaseAnonKey: db.key || "",
      configured: db.configured,
      payments: [
        { id: "cash_on_delivery", enabled: true },
        { id: "airtel_money", enabled: false },
        { id: "moov_money", enabled: false },
      ],
    }),
  );
  app.get(
    "/api/restaurants",
    run(async (req, res) =>
      res.json(
        await db.rows(
          "restaurants",
          "approved=eq.true&select=*&order=name",
          null,
        ),
      ),
    ),
  );
  app.get(
    "/api/menu",
    run(async (req, res) =>
      res.json(
        await db.rows(
          "menu_items",
          "verified=eq.true&select=*,restaurants!inner(approved,available)&restaurants.approved=eq.true&order=name",
          null,
        ),
      ),
    ),
  );
  app.use("/api", authenticate);
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
  app.post(
    "/api/auth/logout",
    run(async (req, res) => {
      await db.call("/auth/v1/logout", { token: req.token, method: "POST" });
      res.json({ ok: true });
    }),
  );
  app.put(
    "/api/profile",
    run(async (req, res) =>
      res.json(
        await db.rpc(
          "update_profile",
          { p_name: text(req.body.name, 100) },
          req.token,
        ),
      ),
    ),
  );
  app.get(
    "/api/addresses",
    run(async (req, res) =>
      res.json(await db.rows("addresses", "select=*&order=label", req.token)),
    ),
  );
  app.post(
    "/api/addresses",
    role("customer"),
    run(async (req, res) => {
      const b = req.body;
      if (!validPoint(b) || !/^\+235\d{8}$/.test(b.phone))
        throw new ApiError(
          400,
          "Valid coordinates and a +235 phone number are required.",
        );
      await db.call("/rest/v1/addresses", {
        method: "POST",
        token: req.token,
        body: {
          customer_id: req.user.id,
          label: text(b.label, 80),
          address: text(b.address),
          phone: b.phone,
          instructions:
            typeof b.instructions === "string"
              ? b.instructions.slice(0, 1000)
              : "",
          latitude: b.latitude,
          longitude: b.longitude,
        },
      });
      res.status(201).json({ ok: true });
    }),
  );
  app.delete(
    "/api/addresses/:id",
    run(async (req, res) => {
      await db.call("/rest/v1/addresses?id=eq." + uuid(req.params.id), {
        method: "DELETE",
        token: req.token,
      });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/cart",
    run(async (req, res) => {
      const rows = await db.rows(
        "cart_items",
        "select=item_id,quantity,menu_items(*,restaurants(available))",
        req.token,
      );
      res.json(
        rows
          .map((row) => ({
            ...row.menu_items,
            id: row.item_id,
            name: row.menu_items?.name || "Unavailable item",
            price: row.menu_items?.price ?? null,
            available: Boolean(
              row.menu_items?.available &&
              row.menu_items?.restaurants?.available,
            ),
            quantity: row.quantity,
          }))
          .filter((row) => row.id),
      );
    }),
  );
  app.post(
    "/api/cart/merge",
    role("customer"),
    run(async (req, res) => {
      if (
        !Array.isArray(req.body.items) ||
        req.body.items.length < 1 ||
        req.body.items.length > 20
      )
        throw new ApiError(400, "Invalid guest cart");
      const items = req.body.items.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new ApiError(400, "Invalid guest cart");
        return {
          itemId: uuid(item.itemId),
          quantity: integer(item.quantity, 1, 50),
        };
      });
      await db.rpc(
        "merge_guest_cart",
        { p_key: uuid(req.body.importKey), p_items: items },
        req.token,
      );
      res.json({ ok: true });
    }),
  );
  for (const [method, path, add] of [
    ["post", "/api/cart", true],
    ["put", "/api/cart/:id", false],
    ["delete", "/api/cart/:id", false],
  ])
    app[method](
      path,
      role("customer"),
      run(async (req, res) => {
        await db.rpc(
          "set_cart_item",
          {
            p_item: uuid(req.params.id || req.body.itemId),
            p_quantity:
              method === "delete" ? 0 : integer(req.body.quantity, 0, 50),
            p_add: add,
          },
          req.token,
        );
        res.json({ ok: true });
      }),
    );
  app.post(
    "/api/quotes",
    role("customer"),
    run(async (req, res) => {
      const addressId = uuid(req.body.addressId);
      const addresses = await db.rows(
        "addresses",
        `id=eq.${addressId}&select=*`,
        req.token,
      );
      const address = addresses[0];
      if (!address) throw new ApiError(404, "Address not found.");
      const cart = await db.rows(
        "cart_items",
        "select=quantity,menu_items(restaurant_id)",
        req.token,
      );
      const ids = [
        ...new Set(cart.map((row) => row.menu_items?.restaurant_id)),
      ];
      if (ids.length !== 1 || !ids[0])
        throw new ApiError(409, "Choose items from one restaurant.");
      const restaurants = await db.rows(
        "restaurants",
        `id=eq.${uuid(ids[0])}&approved=eq.true&available=eq.true&select=*`,
        req.token,
      );
      if (!restaurants[0]) throw new ApiError(409, "Restaurant unavailable.");
      const road = await route(restaurants[0], address);
      const quote = await db.rpc(
        "create_quote",
        {
          p_customer: req.user.id,
          p_address: addressId,
          p_distance: road.distance,
          p_duration: road.duration,
          p_route: road.geometry,
          p_context: {
            restaurantId: restaurants[0].id,
            origin: {
              latitude: restaurants[0].latitude,
              longitude: restaurants[0].longitude,
            },
            destination: {
              latitude: address.latitude,
              longitude: address.longitude,
            },
          },
        },
        null,
        true,
      );
      res.status(201).json(Array.isArray(quote) ? quote[0] : quote);
    }),
  );
  app.post(
    "/api/orders",
    role("customer"),
    run(async (req, res) => {
      if (req.body.paymentMethod !== "cash_on_delivery")
        throw new ApiError(409, "Mobile money is not activated.");
      const order = await db.rpc(
        "checkout",
        {
          p_quote: uuid(req.body.quoteId),
          p_key: uuid(req.headers["idempotency-key"]),
          p_method: req.body.paymentMethod,
        },
        req.token,
      );
      res.status(201).json(Array.isArray(order) ? order[0] : order);
    }),
  );
  app.get(
    "/api/orders",
    run(async (req, res) =>
      res.json(
        await db.rows(
          "orders",
          "select=*,order_items(*)&order=created_at.desc&limit=200",
          req.token,
        ),
      ),
    ),
  );
  app.get(
    "/api/orders/:id",
    run(async (req, res) => {
      const id = uuid(req.params.id);
      const rows = await db.rows(
        "orders",
        `id=eq.${id}&select=*,order_items(*),payments(*),order_events(*),restaurants(name,latitude,longitude)`,
        req.token,
      );
      if (!rows[0]) throw new ApiError(404, "Order not found.");
      const locations = await db.rows(
        "rider_locations",
        `order_id=eq.${id}&select=*`,
        req.token,
      );
      res.json({
        ...rows[0],
        location: locations[0] || null,
        delivery_code: await db.rpc(
          "delivery_code",
          { p_order: id },
          req.token,
        ),
      });
    }),
  );
  app.post(
    "/api/orders/:id/status",
    run(async (req, res) => {
      const result = await db.rpc(
        "transition_order",
        {
          p_order: uuid(req.params.id),
          p_status: text(req.body.status, 30),
          p_reason: req.body.reason || "",
          p_code: req.body.code || "",
          p_cash_confirmed: req.body.cashCollected === true,
        },
        req.token,
      );
      if (result.error) throw new ApiError(409, result.error);
      res.json(result);
    }),
  );
  app.post(
    "/api/orders/:id/refund",
    role("customer"),
    run(async (req, res) =>
      res.json(
        await db.rpc(
          "request_refund",
          { p_order: uuid(req.params.id), p_reason: text(req.body.reason) },
          req.token,
        ),
      ),
    ),
  );
  app.post(
    "/api/orders/:id/location",
    role("rider"),
    run(async (req, res) => {
      if (!validPoint(req.body) || !Number.isFinite(req.body.accuracy))
        throw new ApiError(400, "Invalid GPS location.");
      await db.rpc(
        "share_location",
        {
          p_order: uuid(req.params.id),
          p_lat: req.body.latitude,
          p_lng: req.body.longitude,
          p_accuracy: req.body.accuracy,
        },
        req.token,
      );
      res.json({ ok: true });
    }),
  );
  app.delete(
    "/api/orders/:id/location",
    role("rider"),
    run(async (req, res) => {
      await db.rpc(
        "stop_location",
        { p_order: uuid(req.params.id) },
        req.token,
      );
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/restaurant-owner/restaurants",
    role("restaurant_owner"),
    run(async (req, res) =>
      res.json(
        await db.rows(
          "restaurants",
          "owner_id=eq." + req.user.id + "&select=*",
          req.token,
        ),
      ),
    ),
  );
  app.get(
    "/api/restaurant-owner/menu",
    role("restaurant_owner"),
    run(async (req, res) =>
      res.json(
        await db.rows(
          "menu_items",
          "select=*,restaurants!inner(owner_id)&restaurants.owner_id=eq." +
            req.user.id +
            "&order=name",
          req.token,
        ),
      ),
    ),
  );
  app.put(
    "/api/restaurant-owner/availability",
    role("restaurant_owner"),
    run(async (req, res) => {
      if (typeof req.body.available !== "boolean")
        throw new ApiError(400, "Availability is required.");
      await db.rpc(
        "set_restaurant_availability",
        {
          p_restaurant: uuid(req.body.restaurantId),
          p_available: req.body.available,
        },
        req.token,
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/restaurant-owner/menu",
    role("restaurant_owner"),
    run(async (req, res) => {
      const b = req.body;
      res.json(
        await db.rpc(
          "save_menu",
          {
            p_id: b.id ? uuid(b.id) : null,
            p_restaurant: uuid(b.restaurantId),
            p_name: text(b.name, 100),
            p_category: text(b.category, 80),
            p_description: b.description || "",
            p_image: text(b.image, 2000),
            p_price: integer(b.price, 1, 10000000),
            p_available: b.available === true,
          },
          req.token,
        ),
      );
    }),
  );
  app.get(
    "/api/notifications",
    run(async (req, res) =>
      res.json(
        await db.rows(
          "notifications",
          "select=*&order=created_at.desc&limit=50",
          req.token,
        ),
      ),
    ),
  );
  app.post(
    "/api/payments/:provider",
    run(async () => {
      throw new ApiError(
        503,
        "Live payments are disabled pending provider approval and security tests.",
      );
    }),
  );
  const adminTables = new Set([
    "admin_audit",
    "profiles",
    "restaurants",
    "menu_items",
    "orders",
    "payments",
    "refunds",
    "delivery_zones",
  ]);
  app.get(
    "/api/admin/:table",
    role("admin"),
    run(async (req, res) => {
      if (!adminTables.has(req.params.table))
        throw new ApiError(404, "Resource not found.");
      res.json(
        await db.rows(req.params.table, "select=*&limit=500", req.token),
      );
    }),
  );
  app.post(
    "/api/admin/actions",
    role("admin"),
    run(async (req, res) =>
      res.json(
        await db.rpc(
          "admin_action",
          {
            p_action: text(req.body.action, 40),
            p_id: req.body.id ? uuid(req.body.id) : null,
            p_data: req.body.data || {},
          },
          req.token,
        ),
      ),
    ),
  );
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    res.status(status).json({
      message:
        status === 500
          ? "Request could not be completed."
          : error.type === "entity.parse.failed"
            ? "Invalid JSON request."
            : error.message,
    });
  });
  return app;
}
module.exports = { createApp };
