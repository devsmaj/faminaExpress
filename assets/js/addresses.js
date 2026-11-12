(function () {
  const F = window.Famina;
  F.loadAddresses = async () => {
    const rows = await F.api("/addresses");
    document.dispatchEvent(
      new CustomEvent("addressesloaded", { detail: rows }),
    );
    return rows;
  };
  document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("address-manager");
    if (!root) return;
    if (!(await F.require("customer"))) return;
    const fields = [
      ["label", "Address label", "text"],
      ["address", "Delivery Address", "text"],
      ["phone", "Phone Number", "tel"],
      ["latitude", "Latitude", "number"],
      ["longitude", "Longitude", "number"],
    ];
    root.innerHTML = `<h3>${F.t("Delivery Addresses")}</h3><div id="saved-addresses" class="platform-list"></div><form id="address-form"><div class="platform-fields">${fields.map(([name, label, type]) => `<div class="form-group"><label for="address-${name}">${F.t(label)}</label><input id="address-${name}" name="${name}" type="${type}" ${type === "number" ? 'step="any"' : ""} ${name === "phone" ? 'placeholder="+23566123456" pattern="\\+235[0-9]{8}"' : ""} required></div>`).join("")}</div><div class="form-group"><label for="address-instructions">${F.t("Delivery Instructions (Optional)")}</label><textarea id="address-instructions" name="instructions" maxlength="1000"></textarea></div><p>${F.t("Choose your delivery point on the map or enter its coordinates.")}</p><button type="button" class="btn-secondary" id="address-gps">${F.t("Use my location")}</button><div id="address-map" class="platform-map"></div><button type="submit" class="submit-btn">${F.t("Save Address")}</button></form>`;
    const form = document.getElementById("address-form"),
      map = F.makeMap("address-map");
    let marker;
    const place = (lat, lng) => {
      form.elements.latitude.value = lat.toFixed(6);
      form.elements.longitude.value = lng.toFixed(6);
      if (marker) map.removeLayer(marker);
      marker = L.circleMarker([lat, lng], { color: "#ff6b35" }).addTo(map);
      map.setView([lat, lng], 16);
    };
    map.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
    document.getElementById("address-gps").onclick = () =>
      F.busy(
        document.getElementById("address-gps"),
        () =>
          new Promise((resolve, reject) => {
            if (!navigator.geolocation)
              return reject(Error("GPS is unavailable."));
            navigator.geolocation.getCurrentPosition(
              (p) => {
                place(p.coords.latitude, p.coords.longitude);
                resolve();
              },
              () => reject(Error("Location permission denied or unavailable.")),
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
          }),
      );
    async function render() {
      const rows = await F.loadAddresses();
      document.getElementById("saved-addresses").innerHTML = rows
        .map(
          (a) =>
            `<div class="platform-card"><strong data-no-translate>${F.escape(a.label)}</strong><p data-no-translate>${F.escape(a.address)}</p><button type="button" class="btn-secondary" data-delete-address="${a.id}">${F.t("Remove")}</button></div>`,
        )
        .join("");
    }
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-delete-address]");
      if (b)
        F.busy(b, async () => {
          await F.api("/addresses/" + b.dataset.deleteAddress, {
            method: "DELETE",
          });
          await render();
        });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      F.busy(form.querySelector("[type=submit]"), async () => {
        const b = Object.fromEntries(new FormData(form));
        b.latitude = Number(b.latitude);
        b.longitude = Number(b.longitude);
        await F.api("/addresses", { method: "POST", body: b });
        F.notify("Address saved.");
        await render();
      });
    });
    try {
      await render();
    } catch (e) {
      F.notify(e.message, "error");
    }
  });
})();
