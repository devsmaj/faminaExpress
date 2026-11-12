(function () {
  const F = window.Famina;
  let restaurants = [],
    menu = [],
    orders = [],
    selected = "",
    editing = null,
    charts = [];
  const el = (id) => document.getElementById(id);
  const set = (id, text) => {
    if (el(id)) el(id).textContent = text;
  };
  function renderStats() {
    const total = orders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + o.subtotal - o.commission, 0);
    set("total-orders", orders.length);
    set(
      "today-orders",
      orders.filter(
        (o) =>
          new Date(o.created_at).toDateString() === new Date().toDateString(),
      ).length,
    );
    set("total-revenue", F.money(total));
    set(
      "pending-orders",
      orders.filter((o) => !["delivered", "cancelled"].includes(o.status))
        .length,
    );
    set(
      "avg-order-value",
      F.money(
        orders.length
          ? Math.round(
              orders.reduce((s, o) => s + o.subtotal, 0) / orders.length,
            )
          : 0,
      ),
    );
    const week = orders.filter(
      (o) => Date.now() - new Date(o.created_at) < 7 * 86400000,
    );
    set("weekly-orders", week.length);
    set(
      "weekly-revenue",
      F.money(
        week
          .filter((o) => o.status === "delivered")
          .reduce((s, o) => s + o.subtotal - o.commission, 0),
      ),
    );
    set("satisfaction", F.t("Not available"));
    if (window.Chart) {
      charts.forEach((c) => c.destroy());
      charts = [];
      const statuses = [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "picked_up",
        "delivered",
        "cancelled",
      ];
      const values = statuses.map(
        (s) => orders.filter((o) => o.status === s).length,
      );
      charts.push(
        new Chart(el("status-chart"), {
          type: "doughnut",
          data: {
            labels: statuses.map(F.t),
            datasets: [
              {
                data: values,
                backgroundColor: [
                  "#ffc107",
                  "#007bff",
                  "#ff6b35",
                  "#168753",
                  "#6034a4",
                  "#28a745",
                  "#c33",
                ],
              },
            ],
          },
          options: { responsive: true },
        }),
      );
      const dates = Array.from({ length: 7 }, (_, i) =>
        new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
      );
      charts.push(
        new Chart(el("revenue-chart"), {
          type: "line",
          data: {
            labels: dates,
            datasets: [
              {
                label: "XAF",
                data: dates.map((d) =>
                  orders
                    .filter(
                      (o) =>
                        o.status === "delivered" &&
                        o.delivered_at?.startsWith(d),
                    )
                    .reduce((s, o) => s + o.subtotal - o.commission, 0),
                ),
                borderColor: "#ff6b35",
              },
            ],
          },
          options: { responsive: true },
        }),
      );
    }
  }
  async function load() {
    const all = await F.api("/orders");
    orders = all.filter((o) => o.restaurant_id === selected);
    renderStats();
    renderOrders();
    const rows = await F.api("/restaurant-owner/menu");
    menu = rows.filter((m) => m.restaurant_id === selected);
    el("menu-items-list").innerHTML = menu.length
      ? menu
          .map(
            (m) =>
              `<div class="menu-item-card"><img class="menu-item-image" src="${F.safeImage(m.image)}" alt="${F.escape(m.name)}"><div class="menu-item-details"><h4 data-no-translate>${F.escape(m.name)}</h4><p data-no-translate>${F.money(m.price)}</p><p>${F.t(m.verified ? "Verified" : "Pending verification")} · ${F.t(m.available ? "Available" : "Unavailable")}</p><button class="btn-secondary" data-edit-menu="${m.id}">${F.t("Edit")}</button></div></div>`,
          )
          .join("")
      : `<p>${F.t("No menu items yet.")}</p>`;
    const restaurant = restaurants.find((r) => r.id === selected);
    const cuisine = document.getElementById("restaurant-cuisine");
    if (cuisine) {
      delete cuisine.dataset.i18n;
      cuisine.textContent = restaurant?.cuisine || "";
    }
    delete document.getElementById("restaurant-name").dataset.i18n;
    set("restaurant-name", restaurant?.name || F.t("No restaurant assigned."));
  }
  function renderOrders() {
    const status = el("order-status-filter").value;
    el("orders-list").innerHTML =
      orders
        .filter((o) => status === "all" || o.status === status)
        .map((o) => F.orderCard(o, "restaurant_owner"))
        .join("") || `<p>${F.t("No orders yet.")}</p>`;
  }
  function open(item) {
    editing = item?.id || null;
    const form = el("menu-item-form");
    form.reset();
    for (const key of ["name", "category", "price", "description", "image"])
      el("item-" + key).value = item?.[key] ?? "";
    el("item-available").checked = item?.available ?? true;
    el("menu-item-modal").style.display = "block";
  }
  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await F.require("restaurant_owner"))) return;
    try {
      restaurants = await F.api("/restaurant-owner/restaurants");
      selected = restaurants[0]?.id || "";
      const title = document.querySelector(".dashboard-header");
      title.insertAdjacentHTML(
        "beforeend",
        `<select id="owner-restaurant" aria-label="${F.t("Restaurant")}">${restaurants.map((r) => `<option value="${r.id}">${F.escape(r.name)}</option>`).join("")}</select>`,
      );
      el("owner-restaurant").onchange = async (e) => {
        selected = e.target.value;
        await load();
      };
      el("menu-item-form").insertAdjacentHTML(
        "beforeend",
        `<label><input type="checkbox" id="item-available"> ${F.t("Available")}</label>`,
      );
      document.querySelectorAll(".tab-btn").forEach(
        (b) =>
          (b.onclick = () => {
            document
              .querySelectorAll(".tab-btn")
              .forEach((x) => x.classList.toggle("active", x === b));
            document
              .querySelectorAll(".tab-panel")
              .forEach((p) =>
                p.classList.toggle("active", p.id === b.dataset.tab + "-tab"),
              );
          }),
      );
      el("add-menu-item-btn").onclick = () => open();
      document.querySelector(".modal-close").onclick = () =>
        (el("menu-item-modal").style.display = "none");
      el("cancel-btn").onclick = () =>
        (el("menu-item-modal").style.display = "none");
      el("order-status-filter").onchange = renderOrders;
      document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-edit-menu]");
        if (b) open(menu.find((m) => m.id === b.dataset.editMenu));
      });
      el("menu-item-form").onsubmit = (e) => {
        e.preventDefault();
        F.busy(e.target.querySelector("[type=submit]"), async () => {
          if (!selected) throw Error("No restaurant assigned.");
          const body = { id: editing, restaurantId: selected };
          for (const key of ["name", "category", "description", "image"])
            body[key] = el("item-" + key).value;
          body.price = Number(el("item-price").value);
          body.available = el("item-available").checked;
          await F.api("/restaurant-owner/menu", { method: "POST", body });
          el("menu-item-modal").style.display = "none";
          await load();
          F.notify(
            "Menu saved. Content and price changes require admin verification.",
          );
        });
      };
      const settings = el("restaurant-settings-form");
      settings.innerHTML = `<p>${F.t("Contact admin to update verified restaurant details.")}</p><button type="button" class="btn" id="toggle-restaurant">${F.t("Toggle restaurant availability")}</button>`;
      el("toggle-restaurant").onclick = () =>
        F.busy(el("toggle-restaurant"), async () => {
          const r = restaurants.find((r) => r.id === selected);
          if (!r) throw Error("No restaurant assigned.");
          await F.api("/restaurant-owner/availability", {
            method: "PUT",
            body: { restaurantId: r.id, available: !r.available },
          });
          r.available = !r.available;
          F.notify(r.available ? "Available" : "Unavailable");
        });
      await load();
      const stop = await F.subscribe("orders", null, () =>
        load().catch((e) => F.notify(e.message, "error")),
      );
      window.addEventListener("pagehide", stop, { once: true });
      document.addEventListener("ordersupdated", () => load());
    } catch (e) {
      F.notify(e.message, "error");
    }
  });
})();
