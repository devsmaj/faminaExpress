(function () {
  const F = window.Famina;
  let watch = null,
    sharing = null,
    lastSent = 0,
    posting = false,
    stopped = false;
  let locationButtonDone = () => {};
  function stop() {
    locationButtonDone();
    locationButtonDone = () => {};
    const previous = sharing;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    sharing = null;
    lastSent = 0;
    if (previous)
      F.api("/orders/" + previous + "/location", { method: "DELETE" }).catch(
        () => {},
      );
    document.getElementById("stop-gps").hidden = true;
  }
  async function load() {
    const orders = await F.api("/orders");
    if (
      sharing &&
      !orders.some(
        (o) =>
          o.id === sharing && !["delivered", "cancelled"].includes(o.status),
      )
    )
      stop();
    document.getElementById("rider-orders").innerHTML = orders.length
      ? orders
          .map(
            (o) =>
              F.orderCard(o, "rider") +
              (!["delivered", "cancelled"].includes(o.status)
                ? `<button class="btn-secondary" data-share="${o.id}">${F.t("Share location for this order")}</button>`
                : ""),
          )
          .join("")
      : `<p>${F.t("No delivery assignments yet.")}</p>`;
  }
  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await F.require("rider"))) return;
    document.getElementById("stop-gps").onclick = stop;
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-share]");
      if (!b) return;
      if (!navigator.geolocation) {
        F.notify("GPS is unavailable.", "error");
        return;
      }
      stop();
      locationButtonDone = window.FaminaLoading.button(b);
      sharing = b.dataset.share;
      stopped = false;
      document.getElementById("stop-gps").hidden = false;
      watch = navigator.geolocation.watchPosition(
        async (position) => {
          if (stopped || posting || Date.now() - lastSent < 10000 || !sharing)
            return;
          posting = true;
          lastSent = Date.now();
          try {
            await F.api("/orders/" + sharing + "/location", {
              method: "POST",
              body: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
              },
            });
          } catch (error) {
            F.notify(error.message, "error");
            if ([401, 403].includes(error.status)) {
              stopped = true;
              stop();
            }
          } finally {
            posting = false;
            locationButtonDone();
          }
        },
        () => {
          stop();
          F.notify("Location permission denied or unavailable.", "error");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    });
    try {
      await load();
      const unsubscribe = await F.subscribe(
        "orders",
        "rider_id=eq." + F.user.id,
        () => load().catch((e) => F.notify(e.message, "error")),
        (state) =>
          (document.getElementById("rider-connection").textContent = F.t(
            state === "SUBSCRIBED"
              ? "Live order updates connected."
              : "Live updates disconnected. Use Refresh Tracking.",
          )),
      );
      window.addEventListener("pagehide", unsubscribe, { once: true });
      document.addEventListener("ordersupdated", () =>
        load().catch((e) => F.notify(e.message, "error")),
      );
    } catch (error) {
      F.notify(error.message, "error");
    }
  });
  window.addEventListener("pagehide", () => {
    stopped = true;
    stop();
  });
  window.addEventListener("famina-signed-out", () => {
    stopped = true;
    stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopped = true;
      stop();
    }
  });
})();
