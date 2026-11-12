// Register service worker for offline functionality
if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").then(
            function (registration) {
                console.log("ServiceWorker registration successful with scope: ", registration.scope);
            },
            function (err) {
                console.log("ServiceWorker registration failed: ", err);
            }
        );
    });
}

// Render categories and restaurants on homepage
document.addEventListener("DOMContentLoaded", function () {
    const categoriesGrid = document.getElementById("categories-grid");
    const restaurantsGrid = document.getElementById("restaurants-grid");

    if (categoriesGrid) {
        categoriesGrid.innerHTML = categories
            .map(
                (category) => `
                    <a class="category-card" href="menu.html?category=${category.id}">
                        <img src="${category.image}" alt="${category.name}">
                        <h3>${category.name}</h3>
                    </a>
                `
            )
            .join("");
    }

    if (restaurantsGrid) {
        restaurantsGrid.innerHTML = restaurants
            .map(
                (restaurant) => `
                    <div class="restaurant-card">
                        <img src="${restaurant.image}" alt="${restaurant.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"200\" viewBox=\"0 0 300 200\"%3E%3Crect width=\"300\" height=\"200\" fill=\"#ddd\"/%3E%3Ctext x=\"150\" y=\"110\" font-size=\"24\" fill=\"#999\" text-anchor=\"middle\"%3E${restaurant.name}%3C/text%3E%3C/svg%3E'">
                        <div class="restaurant-info">
                            <h3>${restaurant.name}</h3>
                            <p>${restaurant.cuisine}</p>
                            <p class="rating">${restaurant.rating}</p>
                            <p>${restaurant.deliveryTime}</p>
                            <a href="menu.html?restaurant=${restaurant.id}" class="btn">View Menu</a>
                        </div>
                    </div>
                `
            )
            .join("");
    }
});
