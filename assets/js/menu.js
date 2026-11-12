// Menu filtering and display functionality with API integration
(function () {

const MENU_API_BASE = 'http://localhost:3001/api';

let categories = [];
let restaurants = [];
let menuItems = [];
let filteredItems = [];
let menuPageItems = [];
let currentFilters = {
    search: '',
    category: 'all',
    priceRange: 'all',
    restaurant: 'all',
    sortBy: 'name',
    dietary: []
};

// Load data from API
async function loadData() {
    try {
        const [categoriesRes, restaurantsRes, menuRes] = await Promise.all([
            fetch(`${MENU_API_BASE}/menu`), // We'll use menu endpoint to get categories
            fetch(`${MENU_API_BASE}/restaurants`),
            fetch(`${MENU_API_BASE}/menu`)
        ]);

        if (categoriesRes.ok) {
            const menuData = await categoriesRes.json();
            // Extract unique categories from menu items
            categories = [...new Set(menuData.map(item => item.category))].map(name => ({ name }));
            categories.unshift({ name: 'all' }); // Add 'all' category
        }

        if (restaurantsRes.ok) {
            restaurants = await restaurantsRes.json();
        }

        if (menuRes.ok) {
            menuItems = await menuRes.json();
            // Add dietary tags to menu items (mock data for now)
            menuItems.forEach(item => {
                item.dietary = [];
                if (item.name.toLowerCase().includes('salad') || item.name.toLowerCase().includes('vegetable')) {
                    item.dietary.push('vegetarian');
                }
                if (item.name.toLowerCase().includes('vegan')) {
                    item.dietary.push('vegan');
                }
                if (item.name.toLowerCase().includes('gluten')) {
                    item.dietary.push('gluten-free');
                }
                if (item.name.toLowerCase().includes('spicy') || item.name.toLowerCase().includes('hot')) {
                    item.dietary.push('spicy');
                }
            });
        }

        filteredItems = [...menuItems];
    } catch (error) {
        console.error('Error loading data:', error);
        window.FaminaNotifications.show('Network error', 'error');
    }
}

// Render categories for filtering
function renderCategories() {
    const categoriesContainer = document.getElementById('categories-filter');
    if (!categoriesContainer) return;

    categoriesContainer.innerHTML = categories.map(category => `
        <button class="filter-btn ${category.name === 'all' ? 'active' : ''}" data-category="${category.name}">${category.name === 'all' ? 'All' : category.name}</button>
    `).join('');

    // Add event listeners
    const filterButtons = categoriesContainer.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Filter menu items
            filterMenuItems(this.dataset.category);
        });
    });
}

// Filter and render menu items
function filterMenuItems(category) {
    const menuContainer = document.getElementById('menu-items');
    if (!menuContainer) return;

    let filteredItems = menuItems;

    if (category !== 'all') {
        filteredItems = menuItems.filter(item => item.category === category);
    }

    renderMenuItems(filteredItems);
}

// Render menu items
function renderMenuItems(items) {
    const menuContainer = document.getElementById('menu-items');
    if (!menuContainer) return;

    menuContainer.innerHTML = items.map(item => `
        <div class="menu-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="menu-item-info">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <p class="price">${formatPrice(item.price)}</p>
                <button class="add-to-cart" onclick="addToCart(${item.id})">Add to Cart</button>
            </div>
        </div>
    `).join('');
}

function renderMenuCategoryPills(items) {
    const categoriesContainer = document.getElementById('menu-categories');
    if (!categoriesContainer) return;

    const uniqueCategories = [...new Set(items.map(item => item.category))];
    categoriesContainer.innerHTML = ['All', ...uniqueCategories]
        .map(category => `<button type="button" class="menu-pill ${category === 'All' ? 'active' : ''}" data-category="${category}">${category}</button>`)
        .join('');

    categoriesContainer.querySelectorAll('.menu-pill').forEach(button => {
        button.addEventListener('click', function () {
            const selectedCategory = this.dataset.category;
            const itemsToShow = selectedCategory === 'All'
                ? menuPageItems
                : menuPageItems.filter(item => item.category === selectedCategory);

            categoriesContainer.querySelectorAll('.menu-pill').forEach(pill => pill.classList.remove('active'));
            this.classList.add('active');
            renderMenuItems(itemsToShow);
            updateResultsCount(itemsToShow.length);
        });
    });
}

// Render restaurants list
function renderRestaurants() {
    const restaurantsContainer = document.getElementById('restaurants-list');
    if (!restaurantsContainer) return;

    restaurantsContainer.innerHTML = restaurants.map(restaurant => `
        <div class="restaurant-card">
            <img src="${restaurant.image || 'assets/images/Italian Delight.jpeg'}" alt="${restaurant.name}" onerror="this.src='assets/images/Italian Delight.jpeg'">
            <div class="restaurant-info">
                <h3>${restaurant.name}</h3>
                <p>${restaurant.cuisine}</p>
                <p class="rating">⭐ ${restaurant.rating}</p>
                <p>${restaurant.deliveryTime}</p>
                <p>${restaurant.description}</p>
                <a href="menu.html?restaurant=${restaurant.id}" class="btn">View Menu</a>
            </div>
        </div>
    `).join('');
}

// Initialize advanced filters
function initializeAdvancedFilters() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const priceRange = document.getElementById('price-range');
    const restaurantFilter = document.getElementById('restaurant-filter');
    const sortBy = document.getElementById('sort-by');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const dietaryCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');

    // Populate restaurant filter options
    if (restaurantFilter) {
        restaurantFilter.innerHTML = '<option value="all">All Restaurants</option>' +
            restaurants.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }

    // Search functionality
    if (searchInput && searchBtn) {
        const performSearch = () => {
            currentFilters.search = searchInput.value.toLowerCase().trim();
            applyFilters();
        };

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        // Debounced search
        searchInput.addEventListener('input', debounce(() => {
            currentFilters.search = searchInput.value.toLowerCase().trim();
            applyFilters();
        }, 300));
    }

    // Price range filter
    if (priceRange) {
        priceRange.addEventListener('change', () => {
            currentFilters.priceRange = priceRange.value;
            applyFilters();
        });
    }

    // Restaurant filter
    if (restaurantFilter) {
        restaurantFilter.addEventListener('change', () => {
            currentFilters.restaurant = restaurantFilter.value;
            applyFilters();
        });
    }

    // Sort by
    if (sortBy) {
        sortBy.addEventListener('change', () => {
            currentFilters.sortBy = sortBy.value;
            applyFilters();
        });
    }

    // Dietary checkboxes
    dietaryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            currentFilters.dietary = Array.from(dietaryCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            applyFilters();
        });
    });

    // Clear filters
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
}

// Apply all filters
function applyFilters() {
    let filtered = [...menuItems];

    // Search filter
    if (currentFilters.search) {
        filtered = filtered.filter(item =>
            (window.i18n?.translateText(item.name) || item.name).toLowerCase().includes(currentFilters.search) || item.name.toLowerCase().includes(currentFilters.search) ||
            (window.i18n?.translateText(item.description) || item.description).toLowerCase().includes(currentFilters.search) || item.description.toLowerCase().includes(currentFilters.search) ||
            item.category.toLowerCase().includes(currentFilters.search) ||
            restaurants.find(r => r.id === item.restaurantId)?.name.toLowerCase().includes(currentFilters.search)
        );
    }

    // Category filter
    if (currentFilters.category !== 'all') {
        filtered = filtered.filter(item => item.category === currentFilters.category);
    }

    // Price range filter
    if (currentFilters.priceRange !== 'all') {
        filtered = filtered.filter(item => {
            const price = item.price;
            switch (currentFilters.priceRange) {
                case '0-10': return price >= 0 && price <= 10;
                case '10-20': return price > 10 && price <= 20;
                case '20-30': return price > 20 && price <= 30;
                case '30+': return price > 30;
                default: return true;
            }
        });
    }

    // Restaurant filter
    if (currentFilters.restaurant !== 'all') {
        filtered = filtered.filter(item => item.restaurantId == currentFilters.restaurant);
    }

    // Dietary filter
    if (currentFilters.dietary.length > 0) {
        filtered = filtered.filter(item =>
            currentFilters.dietary.some(diet => item.dietary.includes(diet))
        );
    }

    // Sort items
    filtered = sortItems(filtered, currentFilters.sortBy);

    filteredItems = filtered;
    renderMenuItems(filtered);
    updateResultsCount(filtered.length);
}

// Sort items
function sortItems(items, sortBy) {
    return items.sort((a, b) => {
        switch (sortBy) {
            case 'price-low':
                return a.price - b.price;
            case 'price-high':
                return b.price - a.price;
            case 'rating':
                const aRating = restaurants.find(r => r.id === a.restaurantId)?.rating || 0;
                const bRating = restaurants.find(r => r.id === b.restaurantId)?.rating || 0;
                return bRating - aRating;
            case 'name':
            default:
                return a.name.localeCompare(b.name);
        }
    });
}

// Update results count
function updateResultsCount(count) {
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        resultsCount.textContent = `${count} item${count !== 1 ? 's' : ''} found`;
    }
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        search: '',
        category: 'all',
        priceRange: 'all',
        restaurant: 'all',
        sortBy: 'name',
        dietary: []
    };

    // Reset form elements
    const searchInput = document.getElementById('search-input');
    const priceRange = document.getElementById('price-range');
    const restaurantFilter = document.getElementById('restaurant-filter');
    const sortBy = document.getElementById('sort-by');
    const dietaryCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');

    if (searchInput) searchInput.value = '';
    if (priceRange) priceRange.value = 'all';
    if (restaurantFilter) restaurantFilter.value = 'all';
    if (sortBy) sortBy.value = 'name';
    dietaryCheckboxes.forEach(cb => cb.checked = false);

    // Reset category buttons
    const categoryButtons = document.querySelectorAll('#categories-filter .filter-btn');
    categoryButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === 'all');
    });

    applyFilters();
}

// Initialize menu page
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();

    const menuContainer = document.getElementById('menu-items');
    const hasMenuPage = !!menuContainer;

    // Render restaurants on restaurant.html
    if (document.getElementById('restaurants-list')) {
        renderRestaurants();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const restaurantId = urlParams.get('restaurant');
    if (hasMenuPage) {
        let itemsToRender = [...menuItems];

        if (restaurantId) {
            itemsToRender = itemsToRender.filter(item => item.restaurantId == restaurantId);
            const restaurant = restaurants.find(r => r.id == restaurantId);
            if (restaurant) {
                document.title = `${restaurant.name} Menu - FA-MINNA Express`;
            }
        }

        menuPageItems = itemsToRender;
        renderMenuCategoryPills(itemsToRender);
        renderMenuItems(itemsToRender);
        updateResultsCount(itemsToRender.length);
    }
});

// Helper functions (fallback if not loaded from utils/cart)
if (typeof formatPrice === 'undefined') {
    function formatPrice(price) {
        return `$${price.toFixed(2)}`;
    }
}

if (typeof addToCart === 'undefined') {
    async function addToCart(itemId, quantity = 1) {
        try {
            const response = await fetch(`${MENU_API_BASE}/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ itemId, quantity })
            });
            if (response.ok) {
                if (typeof updateCartCount !== 'undefined') updateCartCount();
                if (typeof showNotification !== 'undefined') showNotification(`${quantity} item(s) added to cart!`);
            } else {
                if (typeof showNotification !== 'undefined') showNotification('Failed to add to cart', 'error');
            }
        } catch (error) {
            if (typeof showNotification !== 'undefined') showNotification('Network error', 'error');
        }
    }
}

// Make functions globally available
window.renderCategories = renderCategories;
window.filterMenuItems = filterMenuItems;
window.renderMenuItems = renderMenuItems;
window.renderRestaurants = renderRestaurants;

})();
