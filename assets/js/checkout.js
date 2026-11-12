// Checkout functionality with API integration
(function () {

const CHECKOUT_API_BASE = 'http://localhost:3001/api';

async function getCartData() {
    if (typeof window.getCart === 'function') {
        return window.getCart();
    }
    try {
        const response = await fetch(`${CHECKOUT_API_BASE}/cart`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        return response.ok ? await response.json() : [];
    } catch (_) {
        return [];
    }
}

async function calculateTotal() {
    if (typeof window.calculateCartTotal === 'function') {
        return window.calculateCartTotal();
    }
    const cart = await getCartData();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function isUserLoggedIn() {
    return !!localStorage.getItem('token');
}

// Render order summary
async function renderOrderSummary() {
    const cart = await getCartData();
    const orderSummary = document.getElementById('order-summary');

    if (!orderSummary) return;

    if (cart.length === 0) {
        orderSummary.innerHTML = '<p>Your cart is empty. <a href="menu.html">Browse menu</a></p>';
        return;
    }

    const subtotal = await calculateTotal();
    const deliveryFee = subtotal > 25 ? 0 : 2.99; // Free delivery over $25
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + deliveryFee + tax;

    orderSummary.innerHTML = `
        <h3>Order Summary</h3>
        ${cart.map(item => `
            <div class="order-item">
                <span>${item.name} x${item.quantity}</span>
                <span>${formatPrice(item.price * item.quantity)}</span>
            </div>
        `).join('')}
        <div class="order-item">
            <span>Subtotal</span>
            <span>${formatPrice(subtotal)}</span>
        </div>
        <div class="order-item">
            <span>Delivery Fee</span>
            <span>${formatPrice(deliveryFee)}</span>
        </div>
        <div class="order-item">
            <span>Tax</span>
            <span>${formatPrice(tax)}</span>
        </div>
        <div class="order-total">
            <span>Total</span>
            <span>${formatPrice(total)}</span>
        </div>
    `;

    // Store total for checkout
    localStorage.setItem('orderTotal', total);
}

// Handle checkout form submission
async function handleCheckout(e) {
    e.preventDefault();

    const cart = await getCartData();
    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }

    if (!isUserLoggedIn()) {
        showNotification('Please login to place an order.', 'error');
        window.FaminaSession.rememberPage();
        window.FaminaSession.gate(e.target.parentElement, 'Please login to place an order.');
        return;
    }

    // Get form data
    const formData = new FormData(e.target);
    const deliveryInfo = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        city: formData.get('city'),
        zipCode: formData.get('zipCode'),
        instructions: formData.get('instructions')
    };

    // Validate required fields
    const requiredFields = ['name', 'email', 'phone', 'address', 'city', 'zipCode'];
    const missingFields = requiredFields.filter(field => !deliveryInfo[field]);

    if (missingFields.length > 0) {
        showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }

    if (!validateEmail(deliveryInfo.email)) {
        showNotification('Please enter a valid email address.', 'error');
        return;
    }

    // Calculate total
    const subtotal = await calculateTotal();
    const deliveryFee = subtotal > 25 ? 0 : 2.99;
    const tax = subtotal * 0.08;
    const total = subtotal + deliveryFee + tax;

    try {
        // Create order via API
        const response = await fetch(`${CHECKOUT_API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                items: cart,
                total: total,
                paymentMethod: 'card' // Default for now
            })
        });

        if (response.ok) {
            const order = await response.json();
            // Clear cart
            // Note: Cart clearing would be handled by the API in a real implementation
            showNotification('Order placed successfully!');
            window.location.href = 'orders.html';
        } else {
            showNotification('Failed to place order', 'error');
        }
    } catch (error) {
        showNotification('Network error', 'error');
    }
}

// Render orders history
async function renderOrdersHistory() {
    try {
        const response = await fetch(`${CHECKOUT_API_BASE}/orders`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const orders = response.ok ? await response.json() : [];
        const ordersContainer = document.getElementById('orders-container');

        if (!ordersContainer) return;

        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p>You haven\'t placed any orders yet.</p>';
            return;
        }

        ordersContainer.innerHTML = orders.reverse().map(order => `
            <div class="order-card">
                <h3>Order #${order.id}</h3>
                <p><strong>Date:</strong> <time datetime="${order.createdAt}" data-localized-date="date" data-no-translate></time></p>
                <p><strong>Status:</strong> ${capitalize(order.status)}</p>
                <p><strong>Total:</strong> ${formatPrice(order.total)}</p>
                <p><strong>Items:</strong></p>
                <ul>
                    ${order.items.map(item => `<li>${item.name} x${item.quantity}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching orders:', error);
        window.FaminaNotifications.show('Network error', 'error');
        const ordersContainer = document.getElementById('orders-container');
        if (ordersContainer) {
            ordersContainer.innerHTML = '<p>Error loading orders.</p>';
        }
    }
}

// Initialize checkout functionality
document.addEventListener('DOMContentLoaded', function() {
    // Render order summary on checkout page
    if (document.getElementById('order-summary')) {
        renderOrderSummary();
    }

    // Handle checkout form
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleCheckout);
    }

    // Render orders on orders page
    if (document.getElementById('orders-container')) {
        renderOrdersHistory();
    }
});

// Helper functions (fallback if not loaded from utils/cart/auth)
if (typeof getCart === 'undefined') {
    async function getCart() {
        try {
            const response = await fetch(`${CHECKOUT_API_BASE}/cart`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            return response.ok ? await response.json() : [];
        } catch (error) {
            return [];
        }
    }
}

if (typeof calculateCartTotal === 'undefined') {
    async function calculateCartTotal() {
        const cart = await getCart();
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
}

if (typeof clearCart === 'undefined') {
    function clearCart() {
        // Cart clearing via API not implemented yet
        showNotification('Clear cart not implemented yet');
    }
}

if (typeof isLoggedIn === 'undefined') {
    function isLoggedIn() {
        return !!localStorage.getItem('token');
    }
}

if (typeof formatPrice === 'undefined') {
    function formatPrice(price) {
        return `$${price.toFixed(2)}`;
    }
}

if (typeof validateEmail === 'undefined') {
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

if (typeof capitalize === 'undefined') {
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

if (typeof showNotification === 'undefined') {
    function showNotification(message, type = 'info') {
        window.FaminaNotifications.show(message, typeof type === 'string' ? type : 'info');
    }
}

// Initialize Stripe
let stripe, elements;

async function initializeStripe() {
    // Load Stripe.js
    if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => {
            stripe = window.Stripe('pk_test_your_publishable_key_here'); // Replace with your publishable key
            elements = stripe.elements();
            setupPaymentForm();
        };
        document.head.appendChild(script);
    } else {
        stripe = window.Stripe('pk_test_your_publishable_key_here'); // Replace with your publishable key
        elements = stripe.elements();
        setupPaymentForm();
    }
}

// Setup Stripe payment form
function setupPaymentForm() {
    if (!stripe || !elements) return;

    const cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        }
    });

    const cardElementContainer = document.getElementById('card-element');
    if (cardElementContainer) {
        cardElement.mount('#card-element');
    }

    const form = document.getElementById('checkout-form');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const submitButton = form.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';

            try {
                // Calculate total
                const subtotal = await calculateTotal();
                const deliveryFee = subtotal > 25 ? 0 : 2.99;
                const tax = subtotal * 0.08;
                const total = subtotal + deliveryFee + tax;

                // Create payment intent
                const response = await fetch(`${CHECKOUT_API_BASE}/payments/create-payment-intent`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ amount: Math.round(total * 100) }) // Amount in cents
                });

                if (!response.ok) {
                    throw new Error('Failed to create payment intent');
                }

                const { clientSecret } = await response.json();

                // Confirm payment
                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: document.getElementById('name').value,
                            email: document.getElementById('email').value,
                        }
                    }
                });

                if (error) {
                    showNotification(error.message, 'error');
                } else if (paymentIntent.status === 'succeeded') {
                    // Payment succeeded, proceed with order creation
                    await handleCheckout(event);
                } else {
                    showNotification('Payment failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Payment error:', error);
                showNotification('Payment processing failed. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
}

// Make functions globally available
window.renderOrderSummary = renderOrderSummary;
window.handleCheckout = handleCheckout;
window.renderOrdersHistory = renderOrdersHistory;

})();
