(function () {
  const F = window.Famina;
  window.renderRestaurants = async function () {
    const container =
      document.getElementById("restaurants-list") ||
      document.getElementById("restaurants-grid");
    if (!container) return;
    try {
      const rows = await F.api("/restaurants");
      container.innerHTML = rows.length
        ? rows
            .map(
              (r) =>
                `<div class="restaurant-card"><img src="${F.safeImage(r.image)}" alt="${F.escape(r.name)}"><div class="restaurant-info"><h3 data-no-translate>${F.escape(r.name)}</h3><p data-no-translate>${F.escape(r.cuisine)}</p><p data-no-translate>${F.escape(r.description)}</p><p>${F.t(r.available ? "Available" : "Unavailable")}</p><a class="btn" href="menu.html?restaurant=${encodeURIComponent(r.id)}">${F.t("View Menu")}</a></div></div>`,
            )
            .join("")
        : `<p>${F.t("No approved restaurants yet.")}</p>`;
    } catch (e) {
      container.textContent = F.t(
        "Restaurant directory is temporarily unavailable.",
      );
    }
  };
  let menu = [];
  function render(items) {
    const container = document.getElementById("menu-items");
    if (!container) return;
    container.innerHTML = items.length
      ? items
          .map(
            (m) =>
              `<div class="menu-item"><img src="${F.safeImage(m.image)}" alt="${F.escape(m.name)}"><div class="menu-item-info"><h3 data-no-translate>${F.escape(m.name)}</h3><p data-no-translate>${F.escape(m.description)}</p><p class="price" data-no-translate>${F.money(m.price)}</p><button class="add-to-cart" data-add-item="${m.id}" ${!m.available || !m.restaurants?.available ? "disabled" : ""}>${F.t(m.available && m.restaurants?.available ? "Add to Cart" : "Unavailable")}</button></div></div>`,
          )
          .join("")
      : `<p>${F.t("No verified menu items available.")}</p>`;
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-item]");
    if (button) F.busy(button, () => window.addToCart(button.dataset.addItem));
  });
  document.addEventListener("DOMContentLoaded", async () => {
    await renderRestaurants();
    if (!document.getElementById("menu-items")) return;
    try {
      menu = await F.api("/menu");
      const params = new URLSearchParams(location.search);
      if (params.has("restaurant"))
        menu = menu.filter((m) => m.restaurant_id === params.get("restaurant"));
      const category = categories.find(
        (c) => String(c.id) === params.get("category"),
      );
      if (category)
        menu = menu.filter(
          (m) => m.category.toLowerCase() === category.name.toLowerCase(),
        );
      render(menu);
      const pills = document.getElementById("menu-categories");
      if (pills) {
        pills.innerHTML = ["All", ...new Set(menu.map((m) => m.category))]
          .map(
            (name) =>
              `<button class="menu-pill" data-category="${F.escape(name)}">${F.escape(name === "All" ? F.t(name) : name)}</button>`,
          )
          .join("");
        pills.addEventListener("click", (e) => {
          const b = e.target.closest("[data-category]");
          if (b)
            render(
              b.dataset.category === "All"
                ? menu
                : menu.filter((m) => m.category === b.dataset.category),
            );
        });
      }
    } catch (e) {
      document.getElementById("menu-items").textContent = F.t(
        "Menu is temporarily unavailable.",
      );
    }
  });
})();
