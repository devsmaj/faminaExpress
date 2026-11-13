(function () {
  const F = window.Famina;
  let quote = null,
    revision = 0,
    expiryTimer,
    map;
  let checkoutKey = null;
  function invalidate() {
    quote = null;
    checkoutKey = null;
    revision++;
    clearTimeout(expiryTimer);
    const button = document.querySelector("#checkout-form [type=submit]");
    if (button) button.disabled = true;
    const summary = document.getElementById("order-summary");
    if (summary)
      summary.textContent = F.t(
        "Request a delivery quote to see the confirmed total.",
      );
  }
  function quoteSummary(q) {
    const summary = document.getElementById("order-summary");
    summary.innerHTML = `<h3>${F.t("Order Summary")}</h3>${q.items.map((i) => `<div class="order-item"><span data-no-translate>${F.escape(i.name)} × ${i.quantity}</span><span data-no-translate>${F.money(i.price * i.quantity)}</span></div>`).join("")}<div class="order-item"><span>${F.t("Subtotal")}</span><span data-no-translate>${F.money(q.subtotal)}</span></div><div class="order-item"><span>${F.t("Delivery Fee")}</span><span data-no-translate>${F.money(q.delivery_fee)}</span></div><div class="order-total"><span>${F.t("Total")}</span><span data-no-translate>${F.money(q.total)}</span></div><p>${F.t("Road distance")}: ${(q.distance_m / 1000).toFixed(1)} km</p><p>${F.t("Estimated delivery time")}: ${Math.ceil(q.duration_s / 60)} min</p><p>${F.t("Quote valid for five minutes. Payment is due on delivery.")}</p>`;
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("checkout-form");
    if (form) {
      if (!(await F.require("customer"))) return;
      map = F.makeMap("checkout-map");
      invalidate();
      const select = document.getElementById("saved-address");
      document.addEventListener("addressesloaded", (e) => {
        const previous = select.value;
        select.innerHTML =
          `<option value="">${F.t("Choose a saved address")}</option>` +
          e.detail
            .map(
              (a) =>
                `<option value="${a.id}">${F.escape(a.label)} — ${F.escape(a.address)}</option>`,
            )
            .join("");
        select.value = e.detail.some((a) => a.id === previous) ? previous : "";
        invalidate();
      });
      select.addEventListener("change", invalidate);
      document.getElementById("request-quote").onclick = () =>
        F.busy(document.getElementById("request-quote"), async () => {
          invalidate();
          const requestRevision = revision;
          if (!select.value) throw Error("Choose a saved address");
          const q = await F.api("/quotes", {
            method: "POST",
            body: { addressId: select.value },
          });
          if (revision !== requestRevision) return;
          quote = q;
          checkoutKey = crypto.randomUUID();
          quoteSummary(q);
          const restaurants = await F.api("/restaurants");
          F.showRoute(
            map,
            q.route,
            restaurants.find((r) => r.id === q.restaurant_id),
            q.address,
          );
          form.querySelector("[type=submit]").disabled = false;
          expiryTimer = setTimeout(
            invalidate,
            Math.max(0, new Date(q.expires_at) - Date.now()),
          );
        });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        F.busy(form.querySelector("[type=submit]"), async () => {
          if (!quote || new Date(quote.expires_at) <= new Date())
            throw Error("Quote expired. Request a new quote.");
          const order = await F.api("/orders", {
            method: "POST",
            headers: { "Idempotency-Key": checkoutKey },
            body: {
              quoteId: quote.id,
              paymentMethod: form.elements.paymentMethod.value,
            },
          });
          F.notify("Order placed successfully!");
          location.href =
            "delivery-tracking.html?order=" + encodeURIComponent(order.id);
        });
      });
      try {
        await F.loadAddresses();
      } catch (e) {
        F.notify(e.message, "error");
      }
    }
    const container = document.getElementById("orders-container");
    if (container) {
      if (!(await F.require("customer"))) return;
      async function load() {
        try {
          const rows = await F.api("/orders");
          container.innerHTML = rows.length
            ? rows.map((o) => F.orderCard(o, "customer")).join("")
            : `<p>${F.t("No orders yet.")}</p>`;
        } catch (e) {
          container.textContent = F.t("Orders are temporarily unavailable.");
        }
      }
      await load();
      if (!F.user || !container.isConnected) return;
      document.addEventListener("ordersupdated", load);
      const stop = await F.subscribe(
        "orders",
        "customer_id=eq." + F.user.id,
        load,
      );
      window.addEventListener("pagehide", stop, { once: true });
    }
  });
  F.orderCard = (o, role) => {
    let next =
      role === "restaurant_owner"
        ? { pending: "accepted", accepted: "preparing", preparing: "ready" }[
            o.status
          ]
        : role === "rider"
          ? { ready: "picked_up", picked_up: "delivered" }[o.status]
          : null;
    const nextLabel = {
      accepted: "Accept Order",
      preparing: "Start preparation",
      ready: "Ready for pickup",
      picked_up: "Confirm pickup",
      delivered: "Confirm delivery",
    }[next];
    return `<div class="order-card"><h3>${F.t("Order")} #${F.escape(o.id.slice(0, 8))}</h3><p class="platform-status">${F.t(o.status)}</p><p data-no-translate>${F.money(o.total)}</p><ul>${(o.order_items || []).map((i) => `<li data-no-translate>${F.escape(i.name)} × ${i.quantity}</li>`).join("")}</ul><a href="delivery-tracking.html?order=${o.id}" class="btn-secondary">${F.t("Track Order")}</a>${next ? `<button class="btn" data-order="${o.id}" data-status="${next}">${F.t(nextLabel)}</button>` : ""}${(role === "customer" && o.status === "pending") || (role === "restaurant_owner" && ["pending", "accepted", "preparing", "ready"].includes(o.status)) ? `<button class="btn-secondary" data-order="${o.id}" data-status="cancelled">${F.t("Cancel Order")}</button>` : ""}${role === "customer" && ["delivered", "cancelled"].includes(o.status) ? `<button class="btn-secondary" data-refund="${o.id}">${F.t("Request Refund")}</button>` : ""}</div>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-order][data-status], [data-refund]");
    if (!b) return;
    F.busy(b, async () => {
      if (b.dataset.refund) {
        const reason = prompt(F.t("Refund reason"));
        if (!reason) return;
        await F.api("/orders/" + b.dataset.refund + "/refund", {
          method: "POST",
          body: { reason },
        });
        F.notify("Refund requested. No money has been returned yet.");
        return;
      }
      const status = b.dataset.status;
      const reason =
        status === "cancelled" ? prompt(F.t("Cancellation reason")) : "";
      if (status === "cancelled" && !reason) return;
      const code =
        status === "delivered"
          ? prompt(F.t("Enter the customer delivery code"))
          : "";
      if (status === "delivered" && !code) return;
      const cashCollected =
        status === "delivered" &&
        confirm(F.t("Confirm delivery and cash collection?"));
      if (status === "delivered" && !cashCollected) return;
      await F.api("/orders/" + b.dataset.order + "/status", {
        method: "POST",
        body: { status, reason, code, cashCollected },
      });
      document.dispatchEvent(new Event("ordersupdated"));
      F.notify("Order updated.");
    });
  });
})();
