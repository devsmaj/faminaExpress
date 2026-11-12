// Main JavaScript file for general functionality
(function () {

document.addEventListener('DOMContentLoaded', function() {
    if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});
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

    // Locale catalogs are loaded before page scripts on every page.
    loadComponent('header', 'components/header.html');
    loadComponent('footer', 'components/footer.html');
    refreshHeaderUI();

    // Initialize cart count
    updateCartCount();

    // Initialize auth status
    updateAuthStatus();

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
    if(window.getCart && window.updateCartCount && window.updateCartCount!==updateCartCount)window.updateCartCount();
}

// Update authentication status in header
function updateAuthStatus() { window.Famina.Navigation?.render(); }

// Logout function
let signingOut = false;
async function logout() {
    if (signingOut) return;
    signingOut = true;
    const done = window.FaminaLoading.start();
    const button = document.querySelector('[data-sign-out]');
    if (button) button.disabled = true;
    try {
        await window.Famina.ready;
        if (window.Famina.client) {
            const { error } = await window.Famina.client.auth.signOut();
            if (error) throw error;
        }
        await window.Famina.refreshUser(null);
        window.Famina.Navigation?.close();
    } catch (error) {
        window.FaminaNotifications.show('Could not sign out. Please try again.', 'error');
    } finally {
        signingOut = false;
        done();
        if (button?.isConnected) button.disabled = false;
    }
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
            .catch(error => { console.error('Error loading component:', error); window.FaminaNotifications.show('Could not load this page section. Please refresh and try again.', 'error'); });
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
        window.FaminaSession.setPreference('theme', 'dark');
        themeToggle?.classList.add('dark');
    } else {
        window.FaminaSession.setPreference('theme', 'light');
        themeToggle?.classList.remove('dark');
    }
}

window.logout = logout;
window.toggleTheme = toggleTheme;
window.updateAuthStatus = updateAuthStatus;

// Load saved theme
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = window.FaminaSession.getPreference('theme');
    const themeToggle = document.querySelector('.theme-toggle');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.classList.add('dark');
    }
});

// Show notification function (if not available from utils)
if (typeof showNotification === 'undefined') {
    function showNotification(message, type = 'info') {
        window.FaminaNotifications.show(message, typeof type === 'string' ? type : 'info');
    }
}


})();
