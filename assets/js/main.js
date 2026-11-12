// Main JavaScript file for general functionality
(function () {

document.addEventListener('DOMContentLoaded', function() {
    function refreshHeaderUI() {
        // Header is injected asynchronously; retry a few times until nodes exist.
        let attempts = 0;
        const maxAttempts = 20;
        const timer = setInterval(() => {
            attempts += 1;
            const hasAuth = !!document.getElementById('auth-links');
            const hasCart = !!document.getElementById('cart-count');

            if (hasAuth || hasCart) {
                updateCartCount();
                updateAuthStatus();
            }

            if ((hasAuth && hasCart) || attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 100);
    }

    // Load i18n first
    const i18nScript = document.createElement('script');
    i18nScript.src = 'assets/js/i18n.js';
    i18nScript.onload = function() {
        // Load header and footer components after i18n is loaded
        loadComponent('header', 'components/header.html');
        loadComponent('footer', 'components/footer.html');
        refreshHeaderUI();
    };
    document.head.appendChild(i18nScript);

    // Initialize cart count
    updateCartCount();

    // Initialize auth status
    updateAuthStatus();

    // Hamburger menu toggle (event delegation works with async-loaded header)
    document.addEventListener('click', function(e) {
        const hamburger = e.target.closest('.hamburger');
        const closeMenu = e.target.closest('.close-menu');
        const navLink = e.target.closest('.nav-list a');
        const nav = document.querySelector('.nav');
        const activeHamburger = document.querySelector('.hamburger');

        if (hamburger && nav) {
            nav.classList.toggle('active');
            hamburger.classList.toggle('active');
            return;
        }

        if ((closeMenu || navLink) && nav && activeHamburger) {
            nav.classList.remove('active');
            activeHamburger.classList.remove('active');
        }
    });

    // Newsletter form submission (delegated for async-loaded footer on all pages)
    document.addEventListener('submit', function(e) {
        const newsletterForm = e.target.closest('.newsletter-form');
        if (!newsletterForm) return;

        e.preventDefault();
        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const email = emailInput ? emailInput.value.trim() : '';

        if (validateEmail(email)) {
            showNotification('Thank you for subscribing!');
            newsletterForm.reset();
        } else {
            showNotification('Please enter a valid email address.', 'error');
            if (emailInput) emailInput.focus();
        }
    });

    // Push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        registerServiceWorker();
        initializePushNotifications();
        setupNotificationButton();
    }

    // Page load animation: fade-in and slide down for main content
    // This applies to all pages with a <main> element
    const main = document.querySelector('main');
    if (main) {
        // Start with hidden state
        main.style.opacity = '0';
        main.style.transform = 'translateY(20px)';
        main.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        // Trigger animation after a short delay to ensure rendering
        setTimeout(() => {
            main.style.opacity = '1';
            main.style.transform = 'translateY(0)';
        }, 100);
    }

    // Add fade-in animation on scroll for sections
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    // Observe sections
    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });
});

// Update cart count in header
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = cartCount;
    }
}

// Update authentication status in header
function updateAuthStatus() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const authLinks = document.getElementById('auth-links');

    if (authLinks) {
        if (user) {
            authLinks.innerHTML = `
                <a href="#" onclick="logout()" data-i18n="nav.logout">Logout</a>
            `;
        } else {
            authLinks.innerHTML = `
                <a href="login.html" data-i18n="nav.login">Login</a>
                <a href="register.html" data-i18n="nav.register">Register</a>
            `;
        }
    }
    if (window.i18n) window.i18n.updatePageTranslations();
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('faminaAuthProvider');
    localStorage.removeItem('currentUser');
    showNotification('Logged out successfully!');
    updateAuthStatus();
    window.location.href = 'index.html';
}

// Load component function (if not available from utils)
if (typeof loadComponent === 'undefined') {
    function loadComponent(elementId, componentPath) {
        fetch(componentPath)
            .then(response => response.text())
            .then(data => {
                document.getElementById(elementId).innerHTML = data;
                document.dispatchEvent(new CustomEvent('componentloaded'));
            })
            .catch(error => console.error('Error loading component:', error));
    }
}

// Validate email function (if not available from utils)
if (typeof validateEmail === 'undefined') {
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

// Theme toggle function
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle');

    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.classList.add('dark');
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.classList.remove('dark');
    }
}

window.logout = logout;
window.toggleTheme = toggleTheme;
window.updateAuthStatus = updateAuthStatus;

// Load saved theme
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.querySelector('.theme-toggle');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.classList.add('dark');
    }
});

// Show notification function (if not available from utils)
if (typeof showNotification === 'undefined') {
    function showNotification(message, type = 'info') {
        alert(message);
    }
}

// Register service worker for push notifications
async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('sw.js');
        console.log('Service Worker registered successfully:', registration);
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
    }
}

// Initialize push notifications
async function initializePushNotifications() {
    try {
        const registration = await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Request permission and subscribe
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY') // Replace with your VAPID public key
                });

                // Get VAPID public key from backend
                const vapidResponse = await fetch('http://localhost:3001/api/notifications/public-key');
                const { publicKey } = await vapidResponse.json();

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

                // Send subscription to backend
                await fetch('http://localhost:3001/api/notifications/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ subscription })
                });

                showNotification('Push notifications enabled!');
            }
        }
    } catch (error) {
        console.error('Push notification initialization failed:', error);
    }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Setup notification button
async function setupNotificationButton() {
    const notificationBtn = document.getElementById('notification-btn');
    if (!notificationBtn) return;

    // Check if already subscribed
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        notificationBtn.classList.add('enabled');
        notificationBtn.title = 'Notifications Enabled';
    }

    notificationBtn.addEventListener('click', async () => {
        if (subscription) {
            // Unsubscribe
            await subscription.unsubscribe();
            notificationBtn.classList.remove('enabled');
            notificationBtn.title = 'Enable Notifications';
            showNotification('Push notifications disabled');
        } else {
            // Subscribe
            await initializePushNotifications();
            notificationBtn.classList.add('enabled');
            notificationBtn.title = 'Notifications Enabled';
        }
    });
}

})();
