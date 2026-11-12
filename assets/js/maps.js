(function () {
  const F = window.Famina;
  F.makeMap = (id) => {
    const map = L.map(id).setView([13.829, 20.832], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    return map;
  };
  F.showRoute = (map, route, restaurant, address, location) => {
    if (!map) return;
    if (map.businessLayer) map.removeLayer(map.businessLayer);
    const layer = L.featureGroup().addTo(map);
    map.businessLayer = layer;
    for (const [point, label] of [
      [restaurant, "Restaurant"],
      [address, "Delivery Address"],
      [location, "Rider GPS"],
    ])
      if (
        point &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude)
      ) {
        L.circleMarker([point.latitude, point.longitude], {
          radius: 8,
          color: label === "Rider GPS" ? "#168753" : "#ff6b35",
        })
          .bindTooltip(F.t(label))
          .addTo(layer);
      }
    if (route?.type === "LineString")
      L.geoJSON(route, { style: { color: "#ff6b35", weight: 4 } }).addTo(layer);
    if (layer.getLayers().length)
      map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 16 });
  };
})();
