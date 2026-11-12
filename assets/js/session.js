(function () {
    const base = new URL('.', location.href);
    const cookieName = 'faminna_preferences';
    const allowed = new Set(['index.html','menu.html','restaurant.html','about.html','cart.html','checkout.html','orders.html','profile.html','contact.html','faq.html','privacy.html','terms.html','delivery-tracking.html','restaurant-owner-dashboard.html']);
    function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    function write(key, value) {
        try { localStorage.setItem(key, value); return true; }
        catch (_) { setTimeout(() => window.dispatchEvent(new Event('famina-storage-error')), 0); return false; }
    }
    function readCookie() {
        try {
            const cookie = document.cookie.split('; ').find(value => value.startsWith(cookieName + '='));
            return cookie ? JSON.parse(decodeURIComponent(cookie.slice(cookieName.length + 1))) : {};
        } catch (_) { return {}; }
    }
    function setPreference(key, value) {
        if (!['language','theme'].includes(key)) return;
        const valid = key === 'language' ? ['en','fr-TD','ar-TD'].includes(value) : ['light','dark'].includes(value);
        if (!valid) return;
        write(key, value);
        const preferences = {};
        for (const field of ['language','theme']) if (read(field)) preferences[field] = read(field);
        try {
            document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(preferences))}; Max-Age=31536000; Path=${base.pathname}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        } catch (_) { window.dispatchEvent(new Event('famina-storage-error')); }
    }
    const saved = readCookie();
    for (const key of ['language','theme']) {
        const valid = key === 'language' ? ['en','fr-TD','ar-TD'].includes(saved[key]) : ['light','dark'].includes(saved[key]);
        if (!read(key) && valid) write(key, saved[key]);
    }
    function clear() {
        for (const key of ['token','currentUser','faminaAuthProvider']) { try { localStorage.removeItem(key); } catch (_) {} }
        window.dispatchEvent(new Event('famina-session-change'));
    }
    function user() {
        try {
            const token = read('token');
            const data = JSON.parse(read('currentUser') || 'null');
            if (!token || !data) return null;
            if (token.split('.').length === 3) {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.exp && payload.exp * 1000 <= Date.now()) { clear(); return null; }
            }
            return data;
        } catch (_) { clear(); return null; }
    }
    function rememberPage() {
        if (!allowed.has(location.pathname.split('/').pop() || 'index.html')) return;
        try { sessionStorage.setItem('faminna_return_to', location.href); } catch (_) {}
    }
    function returnUrl(fallback = 'profile.html') {
        try {
            const value = sessionStorage.getItem('faminna_return_to');
            sessionStorage.removeItem('faminna_return_to');
            if (!value) return fallback;
            const target = new URL(value, base);
            if (target.origin === base.origin && target.pathname.startsWith(base.pathname) && allowed.has(target.pathname.slice(base.pathname.length))) return target.href;
        } catch (_) {}
        return fallback;
    }
    function save(token, data, provider) {
        if (typeof token !== 'string' || !data || typeof data !== 'object') throw new Error('Invalid session');
        if (!write('token', token) || !write('currentUser', JSON.stringify(data))) {
            clear(); throw new Error('Your browser could not save your preferences. Please check your browser settings.');
        }
        if (provider) write('faminaAuthProvider', provider);
        else { try { localStorage.removeItem('faminaAuthProvider'); } catch (_) {} }
        window.dispatchEvent(new Event('famina-session-change'));
    }
    function gate(container, message) {
        if (!container || container.querySelector('.page-auth-notice')) return;
        const notice = document.createElement('p');
        notice.className = 'page-auth-notice';
        const label = document.createElement('span'); label.textContent = message;
        const link = document.createElement('a'); link.href = 'login.html'; link.dataset.i18n = 'nav.access'; link.textContent = 'Login / Sign up';
        notice.append(label, link); container.prepend(notice);
    }
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link) return;
        const target = new URL(link.href, location.href);
        if (target.origin === base.origin && /\/(login|register)\.html$/.test(target.pathname)) rememberPage();
    });
    window.FaminaSession = { save, clear, user, rememberPage, returnUrl, gate, setPreference, getPreference: key => read(key) || readCookie()[key] || null };
    // Restore before page handlers run; refreshing never chooses a new destination.
    user();
})();
