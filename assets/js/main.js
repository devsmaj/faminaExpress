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
    if (document.getElementById('footer')) loadComponent('footer', 'components/footer.html');
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

    // Content appears immediately when its real data is ready; no entrance delay.

});

// Update cart count in header
function updateCartCount() {
    if(window.getCart && window.updateCartCount && window.updateCartCount!==updateCartCount)window.updateCartCount();
}

// Update authentication status in header
function updateAuthStatus() { window.Famina.Navigation?.render(); }

// Confirm before contacting Supabase. Cancel and Escape leave the session intact.
let signingOut = false;
async function logout() {
    if (signingOut) return;
    signingOut = true;
    const F = window.Famina, t = value => F.t(value);
    F.Navigation?.close();
    const dialog = document.createElement('dialog');
    dialog.className = 'sign-out-dialog';
    dialog.setAttribute('aria-labelledby', 'sign-out-title');
    dialog.setAttribute('aria-describedby', 'sign-out-description');
    dialog.innerHTML = '<h2 id="sign-out-title"></h2><p id="sign-out-description"></p><div class="sign-out-dialog-actions"><button type="button" class="btn-secondary" data-cancel-sign-out></button><button type="button" class="btn" data-confirm-sign-out></button></div>';
    dialog.querySelector('h2').textContent = t('Sign out');
    dialog.querySelector('p').textContent = t('Are you sure you want to sign out?');
    const no = dialog.querySelector('[data-cancel-sign-out]'), yes = dialog.querySelector('[data-confirm-sign-out]');
    no.textContent = t('No'); yes.textContent = t('Yes');
    document.body.append(dialog);
    let pending = false, buttonDone = () => {};
    try {
        const confirmed = await new Promise(resolve => {
            no.onclick = () => resolve(false);
            yes.onclick = () => resolve(true);
            dialog.addEventListener('cancel', event => { event.preventDefault(); if (!pending) resolve(false); });
            dialog.showModal();
            no.focus();
        });
        if (!confirmed) return;
        pending = true;
        no.disabled = true;
        buttonDone = window.FaminaLoading.button(yes);
        await F.ready;
        if (!F.client) throw Error('Authentication setup is incomplete.');
        const { error } = await F.client.auth.signOut();
        if (error) throw error;
        await F.refreshUser(null);
    } catch (error) {
        window.FaminaNotifications.show('Could not sign out. Please try again.', 'error');
    } finally {
        buttonDone();
        dialog.close(); dialog.remove();
        signingOut = false;
        const focus = document.querySelector('[data-sign-out],#auth-links a');
        (focus?.getClientRects().length ? focus : document.querySelector('.hamburger'))?.focus();
    }
}

// Shared component loading is provided by utils.js on every page.

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
