// Delivery Tracking with Google Maps
(function () {
const TRACKING_API_BASE = 'http://localhost:3001/api';

let map;
let driverMarker;
let customerMarker;
let routePath;
let currentOrderId;
let trackingInterval;

// Initialize delivery tracking
document.addEventListener('DOMContentLoaded', function() {
    // Get order ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentOrderId = urlParams.get('order');

    if (!currentOrderId) {
        showNotification('No order ID provided', 'error');
        return;
    }

    initializeMap();
    loadOrderDetails();
    startTrackingUpdates();

    // Refresh tracking button
    document.getElementById('refresh-tracking').addEventListener('click', () => {
        loadOrderDetails();
        updateMap();
    });

    // Contact driver buttons
    document.getElementById('call-driver').addEventListener('click', callDriver);
    document.getElementById('message-driver').addEventListener('click', messageDriver);
});

// Initialize Google Maps
function initializeMap() {
    // Default center (New York City)
    const defaultCenter = { lat: 40.7589, lng: -73.9851 };

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 14,
        center: defaultCenter,
        styles: [
            {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
}

// Load order details and tracking information
async function loadOrderDetails() {
    try {
        // Load order details
        const orderResponse = await fetch(`${TRACKING_API_BASE}/orders/${currentOrderId}`);
        if (!orderResponse.ok) {
            throw new Error('Order not found');
        }
        const order = await orderResponse.json();

        // Display order items
        displayOrderItems(order);

        // Load tracking information
        const trackingResponse = await fetch(`${TRACKING_API_BASE}/orders/${currentOrderId}/tracking`);
        if (trackingResponse.ok) {
            const tracking = await trackingResponse.json();
            displayTrackingInfo(tracking);
            updateMap(tracking);
        } else {
            // If no tracking info, show order status
            displayOrderStatus(order);
        }

    } catch (error) {
        console.error('Error loading order details:', error);
        showNotification('Failed to load order details', 'error');
    }
}

// Display order items
function displayOrderItems(order) {
    const container = document.getElementById('order-items');
    const totalElement = document.getElementById('order-total');

    container.innerHTML = order.items.map(item => `
        <div class="order-item">
            <span>${item.name} x${item.quantity}</span>
            <span>$${item.price.toFixed(2)}</span>
        </div>
    `).join('');

    totalElement.textContent = order.total.toFixed(2);
}

// Display tracking information
function displayTrackingInfo(tracking) {
    // Update ETA
    const etaElement = document.getElementById('eta-info');
    const eta = new Date(tracking.eta);
    const now = new Date();
    const diffMinutes = Math.ceil((eta - now) / (1000 * 60));

    if (diffMinutes > 0) {
        etaElement.textContent = `Estimated delivery: ${diffMinutes} minutes`;
    } else {
        etaElement.textContent = 'Your order is arriving soon!';
    }

    // Display driver information
    if (tracking.driver) {
        const driverInfo = document.getElementById('driver-info');
        const driverName = document.getElementById('driver-name');
        const driverPhone = document.getElementById('driver-phone');
        const driverVehicle = document.getElementById('driver-vehicle');

        driverName.textContent = tracking.driver.name;
        driverPhone.textContent = tracking.driver.phone;
        driverVehicle.textContent = tracking.driver.vehicle;

        driverInfo.style.display = 'block';

        // Show contact buttons
        document.getElementById('call-driver').style.display = 'inline-block';
        document.getElementById('message-driver').style.display = 'inline-block';
    }

    // Update status timeline
    updateStatusTimeline(tracking.status);
}

// Display order status when no tracking info available
function displayOrderStatus(order) {
    const etaElement = document.getElementById('eta-info');
    etaElement.textContent = `Order Status: ${order.status.replaceAll('_', ' ').toUpperCase()}`;

    updateStatusTimeline(order.status);
}

// Update status timeline
function updateStatusTimeline(currentStatus) {
    const timeline = document.getElementById('status-timeline');
    const statuses = [
        { key: 'confirmed', label: 'Order Confirmed', icon: '✓' },
        { key: 'preparing', label: 'Preparing Food', icon: '👨‍🍳' },
        { key: 'ready', label: 'Ready for Pickup', icon: '📦' },
        { key: 'picked_up', label: 'Picked Up', icon: '🚴' },
        { key: 'on_the_way', label: 'On the Way', icon: '🚚' },
        { key: 'delivered', label: 'Delivered', icon: '✅' }
    ];

    const currentIndex = statuses.findIndex(s => s.key === currentStatus);

    timeline.innerHTML = statuses.map((status, index) => `
        <div class="status-step ${index <= currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}">
            <div class="status-content">
                <strong>${status.label}</strong>
                ${index === currentIndex ? '<br><small>Current Status</small>' : ''}
            </div>
        </div>
    `).join('');
}

// Update map with driver and customer locations
function updateMap(tracking) {
    if (!map || !tracking) return;

    const driverLocation = tracking.driverLocation;
    const customerLocation = tracking.customerLocation;

    // Clear existing markers and routes
    if (driverMarker) driverMarker.setMap(null);
    if (customerMarker) customerMarker.setMap(null);
    if (routePath) routePath.setMap(null);

    // Add driver marker
    driverMarker = new google.maps.Marker({
        position: driverLocation,
        map: map,
        title: 'Your Delivery Driver',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#ff6b35" stroke="white" stroke-width="3"/>
                    <text x="20" y="25" text-anchor="middle" fill="white" font-size="16" font-weight="bold">🚴</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(40, 40)
        }
    });

    // Add customer marker
    customerMarker = new google.maps.Marker({
        position: customerLocation,
        map: map,
        title: 'Delivery Address',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#28a745" stroke="white" stroke-width="3"/>
                    <text x="20" y="25" text-anchor="middle" fill="white" font-size="16" font-weight="bold">🏠</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(40, 40)
        }
    });

    // Draw route between driver and customer
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#ff6b35',
            strokeWeight: 4,
            strokeOpacity: 0.8
        }
    });

    directionsRenderer.setMap(map);

    const request = {
        origin: driverLocation,
        destination: customerLocation,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
        }
    });

    // Fit map to show both markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(driverLocation);
    bounds.extend(customerLocation);
    map.fitBounds(bounds);

    // Add some padding
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
        if (map.getZoom() > 16) {
            map.setZoom(16);
        }
    });
}

// Start real-time tracking updates
function startTrackingUpdates() {
    // Update every 30 seconds
    trackingInterval = setInterval(() => {
        loadOrderDetails();
    }, 30000);
}

// Stop tracking updates
function stopTrackingUpdates() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
    }
}

// Contact driver functions
function callDriver() {
    const driverPhone = document.getElementById('driver-phone').textContent;
    if (driverPhone) {
        window.location.href = `tel:${driverPhone}`;
    }
}

function messageDriver() {
    const driverPhone = document.getElementById('driver-phone').textContent;
    if (driverPhone) {
        const message = encodeURIComponent(window.i18n.translateText('Hi! I\'m tracking my FA-MINNA Express delivery. How\'s everything going?'));
        window.location.href = `sms:${driverPhone}?body=${message}`;
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
        alert(message);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', stopTrackingUpdates);

})();
