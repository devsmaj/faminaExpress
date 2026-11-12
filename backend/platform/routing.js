const { ApiError } = require("./supabase");
const validPoint = (p) =>
  p &&
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;
async function roadRoute(
  origin,
  destination,
  env = process.env,
  request = fetch,
) {
  if (!validPoint(origin) || !validPoint(destination))
    throw new ApiError(400, "Valid map coordinates are required.");
  if (!env.ROUTING_BASE_URL)
    throw new ApiError(503, "Road routing is not configured.");
  const base = new URL(env.ROUTING_BASE_URL);
  if (
    base.protocol !== "https:" &&
    !(
      env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(base.hostname)
    )
  )
    throw new ApiError(503, "Secure routing configuration required.");
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  let data;
  try {
    const response = await request(
      `${base.href.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&radiuses=100;100`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw Error();
    data = await response.json();
  } catch {
    throw new ApiError(503, "Road route unavailable. Please try again.");
  }
  const route = data?.routes?.[0];
  if (
    data.code !== "Ok" ||
    !route ||
    !Number.isFinite(route.distance) ||
    route.distance < 0 ||
    route.distance > 100000 ||
    !Number.isFinite(route.duration) ||
    route.duration < 0 ||
    route.geometry?.type !== "LineString" ||
    !Array.isArray(route.geometry.coordinates) ||
    route.geometry.coordinates.length < 2 ||
    route.geometry.coordinates.length > 50000 ||
    route.geometry.coordinates.some(
      (p) =>
        !Array.isArray(p) || !validPoint({ longitude: p[0], latitude: p[1] }),
    )
  )
    throw new ApiError(422, "No supported road route found.");
  return {
    distance: Math.ceil(route.distance),
    duration: Math.ceil(route.duration),
    geometry: route.geometry,
  };
}
module.exports = { roadRoute, validPoint };
