(function () {
  const F = window.Famina;
  let tab = "orders",
    rows = [],
    profiles = [],
    editing = null;
  const tabs = {
    orders: "Orders",
    restaurants: "Restaurants",
    menu_items: "Menu Items",
    profiles: "Customers and Riders",
    payments: "Payments",
    refunds: "Refunds",
    delivery_zones: "Delivery Zones",
    admin_audit: "Audit Log",
  };
  const fields = {
    restaurants: [
      ["name", "Name", "text"],
      ["owner_id", "Restaurant owner", "owner"],
      ["cuisine", "Cuisine", "text"],
      ["description", "Description", "text"],
      ["image", "Image URL", "url"],
      ["latitude", "Latitude", "number"],
      ["longitude", "Longitude", "number"],
      ["preparation_minutes", "Preparation time (minutes)", "number"],
      ["commission_bps", "Commission (basis points)", "number"],
      ["approved", "Approved", "checkbox"],
      ["available", "Available", "checkbox"],
    ],
    delivery_zones: [
      ["name", "Name", "text"],
      ["min_lat", "Minimum latitude", "number"],
      ["max_lat", "Maximum latitude", "number"],
      ["min_lng", "Minimum longitude", "number"],
      ["max_lng", "Maximum longitude", "number"],
      ["base_fee", "Base delivery fee (XAF)", "number"],
      ["per_km", "Delivery fee per km (XAF)", "number"],
      ["max_distance_m", "Maximum road distance (metres)", "number"],
      ["active", "Active", "checkbox"],
    ],
  };
  const button = (text, action, id) =>
    `<button type="button" class="btn-secondary" data-admin-action="${action}" data-id="${id}">${F.t(text)}</button>`;
  function form(row = {}) {
    editing = row.id || null;
    return `<form id="admin-form"><div class="platform-fields">${fields[tab]
      .map(
        ([key, label, type]) =>
          `<div class="form-group"><label for="admin-${key}">${F.t(label)}</label>${
            type === "owner"
              ? `<select id="admin-${key}" name="${key}" required>${profiles
                  .filter((p) => p.role === "restaurant_owner" && p.active)
                  .map(
                    (p) =>
                      `<option value="${p.id}" ${row[key] === p.id ? "selected" : ""}>${F.escape(p.name || p.id)}</option>`,
                  )
                  .join("")}</select>`
              : `<input id="admin-${key}" name="${key}" type="${type}" ${type === "checkbox" ? (row[key] ? "checked" : "") : `value="${F.escape(row[key] ?? "")}" required`} ${type === "number" ? 'step="any"' : ""}>`
          }</div>`,
      )
      .join(
        "",
      )}</div><button type="submit" class="btn">${F.t("Save")}</button></form>`;
  }
  function card(row) {
    let content = "";
    if (tab === "profiles")
      content = `<strong data-no-translate>${F.escape(row.name || row.id)}</strong><p data-no-translate>${F.escape(row.id)}</p><select data-role-id="${row.id}">${["customer", "restaurant_owner", "rider", "admin"].map((role) => `<option ${role === row.role ? "selected" : ""}>${role}</option>`).join("")}</select>${button("Save role", "role", row.id)}${button(row.active ? "Disable account" : "Enable account", "active", row.id)}`;
    if (tab === "restaurants" || tab === "delivery_zones")
      content = `<strong data-no-translate>${F.escape(row.name)}</strong><p>${F.t(tab === "restaurants" ? (row.approved ? "Approved" : "Pending verification") : row.active ? "Active" : "Inactive")}</p>${tab === "restaurants" ? `<p>${F.t("Commission (basis points)")}: ${row.commission_bps}</p>` : `<p data-no-translate>${F.money(row.base_fee)} + ${F.money(row.per_km)}/km</p>`}${button("Edit", "edit", row.id)}`;
    if (tab === "menu_items")
      content = `<img width="100" height="80" src="${F.safeImage(row.image)}" alt="${F.escape(row.name)}"><strong data-no-translate>${F.escape(row.name)}</strong><p data-no-translate>${F.escape(row.description)} · ${F.money(row.price)}</p><p data-no-translate>${F.escape(row.restaurant_id)}</p>${button(row.verified ? "Remove verification" : "Verify menu item", "verify", row.id)}`;
    if (tab === "orders")
      content = `${F.orderCard({ ...row, order_items: [] }, "admin")}<select data-rider-id="${row.id}"><option value="">${F.t("Choose rider")}</option>${profiles
        .filter((p) => p.role === "rider" && p.active)
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === row.rider_id ? "selected" : ""}>${F.escape(p.name || p.id)}</option>`,
        )
        .join(
          "",
        )}</select>${button("Assign rider", "assign", row.id)}${["pending", "accepted", "preparing", "ready"].includes(row.status) ? `<button class="btn-secondary" data-order="${row.id}" data-status="cancelled">${F.t("Cancel Order")}</button>` : ""}`;
    if (tab === "orders" && row.status === "picked_up")
      content += button("Reset delivery code", "reset_code", row.id);
    if (tab === "admin_audit")
      content = `<strong data-no-translate>${F.escape(row.action)}</strong><p data-no-translate>${F.escape(row.actor_id)} · ${F.escape(row.target_id || "")}</p><time data-no-translate>${F.escape(row.created_at)}</time>`;
    if (tab === "payments")
      content = `<p data-no-translate>${F.escape(row.order_id)} · ${F.money(row.amount)}</p><p>${F.t(row.method)} · ${F.t(row.status)}</p>${row.status === "collected" ? button("Reconcile received cash", "reconcile", row.id) : ""}`;
    if (tab === "refunds")
      content = `<p data-no-translate>${F.escape(row.order_id)} · ${F.money(row.amount)}</p><p data-no-translate>${F.escape(row.reason)}</p><p>${F.t(row.status)}</p>${row.status === "requested" ? button("Review refund", "review", row.id) + button("Reject refund", "reject", row.id) : ""}${row.status === "reviewed" ? button("Record completed cash refund", "cash_refund", row.id) : ""}`;
    return `<div class="platform-card">${content}</div>`;
  }
  async function load() {
    rows = await F.api("/admin/" + tab);
    profiles = await F.api("/admin/profiles");
    document.getElementById("admin-content").innerHTML =
      `${fields[tab] ? form() : ""}<div class="platform-list">${rows.map(card).join("") || `<p>${F.t("No records yet.")}</p>`}</div>`;
    document.getElementById("admin-state").textContent = F.t(
      "Showing up to 500 records.",
    );
  }
  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await F.require("admin"))) return;
    document.getElementById("admin-tabs").innerHTML = Object.entries(tabs)
      .map(
        ([key, label]) =>
          `<button class="tab-btn" data-admin-tab="${key}">${F.t(label)}</button>`,
      )
      .join("");
    document.getElementById("admin-tabs").onclick = (e) => {
      const b = e.target.closest("[data-admin-tab]");
      if (b)
        F.busy(b, async () => {
          tab = b.dataset.adminTab;
          await load();
        });
    };
    document.addEventListener("submit", (e) => {
      if (e.target.id !== "admin-form") return;
      e.preventDefault();
      F.busy(e.target.querySelector("[type=submit]"), async () => {
        const data = {};
        for (const [key, label, type] of fields[tab])
          data[key] =
            type === "checkbox"
              ? e.target.elements[key].checked
              : type === "number"
                ? Number(e.target.elements[key].value)
                : e.target.elements[key].value;
        await F.api("/admin/actions", {
          method: "POST",
          body: {
            action: tab === "restaurants" ? "restaurant" : "zone",
            id: editing,
            data,
          },
        });
        await load();
        F.notify("Saved.");
      });
    });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-admin-action]");
      if (!b) return;
      F.busy(b, async () => {
        const row = rows.find((r) => r.id === b.dataset.id),
          action = b.dataset.adminAction;
        if (action === "edit") {
          document.getElementById("admin-form").outerHTML = form(row);
          document.getElementById("admin-form").scrollIntoView();
          return;
        }
        let type,
          data = {},
          id = row.id;
        if (action === "role") {
          type = "profile";
          data = {
            role: document.querySelector('[data-role-id="' + id + '"]').value,
          };
          if (!confirm(F.t("Confirm account role change?"))) return;
        }
        if (action === "active") {
          type = "profile";
          data = { active: !row.active };
        }
        if (action === "verify") {
          type = "verify_menu";
          data = { verified: !row.verified };
        }
        if (action === "assign") {
          type = "assign_rider";
          data = {
            rider_id: document.querySelector('[data-rider-id="' + id + '"]')
              .value,
          };
        }
        if (action === "reconcile") {
          if (!confirm(F.t("Confirm the cash has been received and counted?")))
            return;
          type = "reconcile_cash";
          id = row.order_id;
        }
        if (["review", "reject"].includes(action)) {
          type = "review_refund";
          data = { status: action === "reject" ? "rejected" : "reviewed" };
        }
        if (action === "cash_refund") {
          const reference = prompt(
            F.t("Receipt reference for money already returned to the customer"),
          );
          if (!reference) return;
          type = "record_cash_refund";
          data = { reference };
        }
        if (action === "reset_code") {
          type = "reset_delivery_code";
        }
        await F.api("/admin/actions", {
          method: "POST",
          body: { action: type, id, data },
        });
        await load();
        F.notify("Saved.");
      });
    });
    try {
      await load();
      document.addEventListener("ordersupdated", () => {
        if (tab === "orders")
          load().catch((error) => F.notify(error.message, "error"));
      });
    } catch (error) {
      F.notify(error.message, "error");
    }
  });
})();
