const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
for (const [from, to] of [
  ["@supabase/supabase-js/dist/umd/supabase.js", "supabase.js"],
  ["@supabase/supabase-js/LICENSE", "SUPABASE-LICENSE"],
  ["leaflet/dist/leaflet.js", "leaflet/leaflet.js"],
  ["leaflet/dist/leaflet.css", "leaflet/leaflet.css"],
  ["leaflet/LICENSE", "leaflet/LICENSE"],
  ["chart.js/dist/chart.umd.js", "chart.js"],
  ["chart.js/LICENSE.md", "CHART-LICENSE.md"],
]) {
  const dest = path.join(root, "assets/vendor", to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, "backend/node_modules", from), dest);
}
fs.cpSync(
  path.join(root, "backend/node_modules/leaflet/dist/images"),
  path.join(root, "assets/vendor/leaflet/images"),
  { recursive: true },
);
