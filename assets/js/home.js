document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("categories-grid");
  if (grid)
    grid.innerHTML = categories
      .map(
        (c) =>
          `<a class="category-card" href="menu.html?category=${c.id}"><img src="${c.image}" alt="${c.name}"><h3>${c.name}</h3></a>`,
      )
      .join("");
});
