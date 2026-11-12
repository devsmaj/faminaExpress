// Cart management functionality with API integration
(function () {

const CART_API_BASE = 'http://localhost:3001/api';

// Get cart from API
async function getCart() {
    try {
        const response = await fetch(`${CART_API_BASE}/cart`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const cart = await response.json();
        return response.ok ? cart : [];
    } catch (error) {
        console.error('Error fetching cart:', error);
        window.FaminaNotifications.show('Network error', 'error');
        return [];
    }
}

// Add item to cart
async function addToCart(itemId, quantity = 1) {
    try {
        const response = await fetch(`${CART_API_BASE}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ itemId, quantity })
        });
        if (response.ok) {
            updateCartCount();
            renderCartItems();
            showNotification(`${quantity} item(s) added to cart!`);
        } else {
            showNotification('Failed to add item to cart', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Remove item from cart
async function removeFromCart(itemId) {
    try {
        const response = await fetch(`${CART_API_BASE}/cart/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            updateCartCount();
            renderCartItems();
            showNotification('Item removed from cart!');
        } else {
            showNotification('Failed to remove item', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Update item quantity in cart
async function updateCartItemQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(itemId);
        return;
    }

    try {
        const response = await fetch(`${CART_API_BASE}/cart/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ quantity: newQuantity })
        });
        if (response.ok) {
            updateCartCount();
            renderCartItems();
        } else {
            showNotification('Failed to update quantity', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Calculate cart total
async function calculateCartTotal() {
    const cart = await getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Clear cart (not implemented in API yet)
function clearCart() {
    showNotification('Clear cart not implemented yet');
}

// Get cart item count
async function getCartItemCount() {
    const cart = await getCart();
    return cart.reduce((total, item) => total + item.quantity, 0);
}

// Update cart count in header (if main.js is loaded)
async function updateCartCount() {
    const count = await getCartItemCount();
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = count;
    }
}

// Render cart items (for cart.html)
async function renderCartItems() {
    const cart = await getCart();
    const cartContainer = document.getElementById('cart-items');

    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is empty.</p>';
        updateCartTotal();
        return;
    }

    cartContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
                <h3>${item.name}</h3>
                <p>${formatPrice(item.price)}</p>
                <div class="quantity-controls">
                    <button onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                </div>
                <button class="remove-item" onclick="removeFromCart(${item.id})">Remove</button>
            </div>
        </div>
    `).join('');

    updateCartTotal();
}

// Update cart total display
async function updateCartTotal() {
    const total = await calculateCartTotal();
    const totalElement = document.getElementById('cart-total');
    if (totalElement) {
        totalElement.textContent = `Total: ${formatPrice(total)}`;
    }
}

// Initialize cart on page load (for cart.html)
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('cart-items')) {
        renderCartItems();
    }
    updateCartCount(); // Update count on load
});

// Helper functions (fallback if not loaded from utils)
if (typeof formatPrice === 'undefined') {
    function formatPrice(price) {
        return `$${price.toFixed(2)}`;
    }
}

if (typeof showNotification === 'undefined') {
    function showNotification(message, type = 'info') {
        window.FaminaNotifications.show(message, typeof type === 'string' ? type : 'info');
    }
}

// Make functions globally available
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.clearCart = clearCart;
window.getCartItemCount = getCartItemCount;
window.calculateCartTotal = calculateCartTotal;
window.updateCartCount = updateCartCount;
window.getCart = getCart;

})();
