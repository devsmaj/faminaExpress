// Restaurant Owner Dashboard JavaScript
(function () {
const OWNER_API_BASE = 'http://localhost:3001/api';

let currentRestaurant = null;
let currentTab = 'overview';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    setupEventListeners();
    loadDashboard();
});

// Check if user is authenticated as restaurant owner
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = window.FaminaSession.user();

    if (!token || !user || user.role !== 'restaurant_owner') {
        const container = document.querySelector('main');
        container.querySelectorAll('button,input,select,textarea').forEach(field => field.disabled = true);
        window.FaminaSession.rememberPage();
        window.FaminaSession.gate(container, 'Sign in with a restaurant owner account to access this dashboard.');
        showNotification('Sign in with a restaurant owner account to access this dashboard.', 'error');
        return false;
    }

    currentRestaurant = user.restaurant;
    updateRestaurantInfo();
    return true;
}

window.addEventListener('famina-signed-out', () => {
    currentRestaurant = null;
    const main = document.querySelector('main');
    main.querySelectorAll('.tab-panel').forEach(panel => panel.hidden = true);
    checkAuth();
});

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Menu management
    document.getElementById('add-menu-item-btn')?.addEventListener('click', showAddMenuItemModal);

    // Modal events
    document.querySelector('.modal-close')?.addEventListener('click', hideModal);
    document.getElementById('cancel-btn')?.addEventListener('click', hideModal);
    document.getElementById('menu-item-form')?.addEventListener('submit', handleMenuItemSubmit);

    // Settings form
    document.getElementById('restaurant-settings-form')?.addEventListener('submit', handleSettingsSubmit);

    // Order status filter
    document.getElementById('order-status-filter')?.addEventListener('change', loadOrders);
}

// Update restaurant info in header
function updateRestaurantInfo() {
    if (currentRestaurant) {
        document.getElementById('restaurant-name').textContent = currentRestaurant.name;
        document.getElementById('restaurant-cuisine').textContent = currentRestaurant.cuisine;

        // Populate settings form
        document.getElementById('restaurant-name-input').value = currentRestaurant.name;
        document.getElementById('restaurant-cuisine-input').value = currentRestaurant.cuisine;
        document.getElementById('restaurant-description-input').value = currentRestaurant.description || '';
        document.getElementById('restaurant-delivery-time-input').value = currentRestaurant.deliveryTime || '';
    }
}

// Switch between tabs
function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update active tab content
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabName}-tab`);
    });

    currentTab = tabName;

    // Load tab-specific data
    switch (tabName) {
        case 'overview':
            loadDashboard();
            break;
        case 'menu':
            loadMenuItems();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Load dashboard overview
async function loadDashboard() {
    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/dashboard`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const data = await response.json();

            // Update stats
            document.getElementById('total-orders').textContent = data.stats.totalOrders;
            document.getElementById('today-orders').textContent = data.stats.todayOrders;
            document.getElementById('total-revenue').textContent = formatPrice(data.stats.totalRevenue);
            document.getElementById('pending-orders').textContent = data.stats.pendingOrders;

            // Load charts
            loadCharts();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        window.FaminaNotifications.show('Network error', 'error');
    }
}

// Load and display charts
function loadCharts() {
    // Revenue chart (mock data for demo)
    const revenueCtx = document.getElementById('revenue-chart');
    if (revenueCtx) {
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Revenue ($)',
                    data: [120, 150, 180, 200, 170, 220, 190],
                    borderColor: '#ff6b35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Status chart (mock data for demo)
    const statusCtx = document.getElementById('status-chart');
    if (statusCtx) {
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Delivered', 'Pending', 'Preparing', 'Ready'],
                datasets: [{
                    data: [45, 12, 8, 5],
                    backgroundColor: ['#28a745', '#ffc107', '#ff6b35', '#007bff']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

// Load menu items
async function loadMenuItems() {
    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/menu`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const menuItems = await response.json();
            displayMenuItems(menuItems);
        }
    } catch (error) {
        console.error('Error loading menu items:', error);
        window.FaminaNotifications.show('Network error', 'error');
    }
}

// Display menu items
function displayMenuItems(items) {
    const container = document.getElementById('menu-items-list');
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="menu-item-card" data-id="${item.id}">
            <img src="${item.image}" alt="${item.name}" class="menu-item-image">
            <div class="menu-item-details">
                <h4>${item.name}</h4>
                <p class="category">${item.category}</p>
                <p class="description">${item.description}</p>
                <p class="price">${formatPrice(item.price)}</p>
            </div>
            <div class="menu-item-actions">
                <button class="btn-secondary edit-btn" onclick="editMenuItem(${item.id})">Edit</button>
                <button class="btn-danger delete-btn" onclick="deleteMenuItem(${item.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Load orders
async function loadOrders() {
    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/orders`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const orders = await response.json();
            const statusFilter = document.getElementById('order-status-filter').value;

            const filteredOrders = statusFilter === 'all'
                ? orders
                : orders.filter(order => order.status === statusFilter);

            displayOrders(filteredOrders);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        window.FaminaNotifications.show('Network error', 'error');
    }
}

// Display orders
function displayOrders(orders) {
    const container = document.getElementById('orders-list');
    if (!container) return;

    container.innerHTML = orders.map(order => `
        <div class="order-card" data-id="${order.id}">
            <div class="order-header">
                <h4>Order #${order.id}</h4>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
            <div class="order-details">
                <p><strong>Customer:</strong> ${order.customerName}</p>
                <p><strong>Items:</strong> ${order.items.length} item(s)</p>
                <p><strong>Total:</strong> ${formatPrice(order.total)}</p>
                <p><strong>Time:</strong> <time datetime="${order.createdAt}" data-localized-date="datetime" data-no-translate></time></p>
            </div>
            <div class="order-items">
                ${order.items.map(item => `<span class="order-item">${item.name} x${item.quantity}</span>`).join('')}
            </div>
            <div class="order-actions">
                <select onchange="updateOrderStatus(${order.id}, this.value)" class="status-select">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready for Pickup</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                </select>
            </div>
        </div>
    `).join('');
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/analytics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            const data = await response.json();

            document.getElementById('avg-order-value').textContent = formatPrice(data.avgOrderValue);
            document.getElementById('weekly-orders').textContent = data.weeklyOrders;
            document.getElementById('weekly-revenue').textContent = formatPrice(data.weeklyRevenue);
            document.getElementById('satisfaction').textContent = `${data.satisfaction} ⭐`;

            // Display popular items
            const popularContainer = document.getElementById('popular-items-list');
            if (popularContainer) {
                popularContainer.innerHTML = data.popularItems.map(item => `
                    <div class="popular-item">
                        <span>${item.name}</span>
                        <span>${item.count} orders</span>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
        window.FaminaNotifications.show('Network error', 'error');
    }
}

// Menu item management
function showAddMenuItemModal() {
    document.getElementById('modal-title').textContent = 'Add Menu Item';
    document.getElementById('menu-item-form').reset();
    document.getElementById('menu-item-modal').style.display = 'block';
}

function hideModal() {
    document.getElementById('menu-item-modal').style.display = 'none';
}

async function handleMenuItemSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const itemData = {
        name: formData.get('item-name'),
        category: formData.get('item-category'),
        price: formData.get('item-price'),
        description: formData.get('item-description'),
        image: formData.get('item-image')
    };

    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(itemData)
        });

        if (response.ok) {
            hideModal();
            loadMenuItems();
            showNotification('Menu item added successfully!');
        } else {
            showNotification('Failed to add menu item', 'error');
        }
    } catch (error) {
        console.error('Error adding menu item:', error);
        showNotification('Network error', 'error');
    }
}

async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/menu/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.ok) {
            loadMenuItems();
            showNotification('Menu item deleted successfully!');
        } else {
            showNotification('Failed to delete menu item', 'error');
        }
    } catch (error) {
        console.error('Error deleting menu item:', error);
        showNotification('Network error', 'error');
    }
}

// Update order status
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showNotification('Order status updated successfully!');
            loadOrders();
        } else {
            showNotification('Failed to update order status', 'error');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Network error', 'error');
    }
}

// Handle settings form submission
async function handleSettingsSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const settingsData = {
        name: formData.get('restaurant-name-input'),
        cuisine: formData.get('restaurant-cuisine-input'),
        description: formData.get('restaurant-description-input'),
        deliveryTime: formData.get('restaurant-delivery-time-input')
    };

    try {
        const response = await fetch(`${OWNER_API_BASE}/restaurant-owner/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(settingsData)
        });

        if (response.ok) {
            const updatedRestaurant = await response.json();
            currentRestaurant = updatedRestaurant;
            updateRestaurantInfo();
            showNotification('Settings updated successfully!');
        } else {
            showNotification('Failed to update settings', 'error');
        }
    } catch (error) {
        console.error('Error updating settings:', error);
        showNotification('Network error', 'error');
    }
}

// Utility functions
function formatPrice(price) {
    return `$${parseFloat(price).toFixed(2)}`;
}

function showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
        window.showNotification(message, type);
    } else {
        window.FaminaNotifications.show(message, typeof type === 'string' ? type : 'info');
    }
}

// Make functions globally available
window.editMenuItem = (id) => {
    // TODO: Implement edit functionality
    showNotification('Edit functionality coming soon!');
};

window.deleteMenuItem = deleteMenuItem;
window.updateOrderStatus = updateOrderStatus;

})();
