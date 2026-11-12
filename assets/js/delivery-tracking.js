(function () {
  const F = window.Famina;
  let map,
    order,
    stops = [],
    timer;
  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await F.require())) return;
    const id = new URLSearchParams(location.search).get("order");
    if (!id) {
      F.notify("Choose an order to track.", "error");
      return;
    }
    map = F.makeMap("map");
    const info = document.getElementById("eta-info");
    info.insertAdjacentHTML(
      "afterend",
      '<p id="tracking-connection" role="status"></p><p id="gps-state"></p><p id="delivery-code" class="platform-code" data-no-translate></p>',
    );
    function render() {
      if (!order) return;
      document.getElementById("order-items").innerHTML = order.order_items
        .map(
          (i) =>
            `<div class="order-item"><span data-no-translate>${F.escape(i.name)} × ${i.quantity}</span><span data-no-translate>${F.money(i.price * i.quantity)}</span></div>`,
        )
        .join("");
      document.getElementById("order-total").textContent = F.money(order.total);
      info.textContent =
        F.t(order.status) +
        " · " +
        F.t("Road distance") +
        ": " +
        (order.distance_m / 1000).toFixed(1) +
        " km · " +
        F.t("Initial delivery estimate") +
        ": " +
        Math.ceil(order.duration_s / 60) +
        " min";
      document.getElementById("delivery-code").textContent = order.delivery_code
        ? F.t("Delivery code") + ": " + order.delivery_code
        : "";
      const fresh =
        order.location &&
        Date.now() - new Date(order.location.recorded_at) < 60000;
      document.getElementById("gps-state").textContent = F.t(
        fresh ? "Live rider location" : "Rider location unavailable or stale.",
      );
      F.showRoute(
        map,
        order.route,
        order.restaurants,
        order.address,
        fresh ? order.location : null,
      );
      document.getElementById("status-timeline").innerHTML = order.order_events
        .sort((a, b) => a.id - b.id)
        .map(
          (e) =>
            `<div class="status-step active"><div class="status-content"><strong>${F.t(e.status)}</strong><p>${F.escape(new Date(e.created_at).toLocaleString(document.documentElement.lang))}</p>${e.note ? `<p data-no-translate>${F.escape(e.note)}</p>` : ""}</div></div>`,
        )
        .join("");
    }
    async function load() {
      try {
        order = await F.api("/orders/" + encodeURIComponent(id));
        render();
      } catch (e) {
        F.notify(e.message, "error");
      }
    }
    await load();
    document.getElementById("refresh-tracking").onclick = () =>
      F.busy(document.getElementById("refresh-tracking"), load);
    const state = (value) => {
      document.getElementById("tracking-connection").textContent = F.t(
        value === "SUBSCRIBED"
          ? "Live order updates connected."
          : "Live updates disconnected. Use Refresh Tracking.",
      );
    };
    stops.push(
      await F.subscribe("orders", "id=eq." + id, load, state),
      await F.subscribe("order_events", "order_id=eq." + id, load),
      await F.subscribe("rider_locations", "order_id=eq." + id, load),
    );
    timer = setInterval(render, 15000);
  });
  function stop() {
    stops.forEach((fn) => fn());
    clearInterval(timer);
  }
  window.addEventListener("pagehide", stop);
  window.addEventListener("famina-signed-out", stop);
})();
