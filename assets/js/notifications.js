(function () {
    const duration = 5000;
    const active = new Map();
    let stack;
    const translate = text => window.i18n ? window.i18n.translateText(String(text)) : String(text);
    function show(message, type = 'info') {
        type = ['error', 'success', 'warning', 'info'].includes(type) ? type : 'info';
        const key = type + ':' + String(message);
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            document.body.append(stack);
        }
        if (active.has(key)) { active.get(key).restart(); return; }
        if (active.size >= 4) active.values().next().value.close();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-atomic', 'true');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3h.01"/>';
        const text = document.createElement('p');
        text.textContent = translate(message);
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'toast-close';
        dismiss.setAttribute('aria-label', translate('Dismiss notification'));
        dismiss.textContent = '\u00d7';
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        progress.setAttribute('aria-hidden', 'true');
        toast.append(icon, text, dismiss, progress);
        stack.append(toast);
        let timer;
        const entry = {
            close() { clearTimeout(timer); toast.remove(); active.delete(key); },
            restart() { clearTimeout(timer); timer = setTimeout(entry.close, duration); }
        };
        dismiss.addEventListener('click', entry.close);
        // Give keyboard and pointer users time to read or dismiss the notification.
        toast.addEventListener('pointerenter', () => clearTimeout(timer));
        toast.addEventListener('pointerleave', entry.restart);
        toast.addEventListener('focusin', () => clearTimeout(timer));
        toast.addEventListener('focusout', entry.restart);
        active.set(key, entry);
        entry.restart();
    }
    window.FaminaNotifications = { show };
    window.showNotification = show;
    window.alert = message => show(message, 'info');
    window.addEventListener('famina-storage-error', () => show('Your browser could not save your preferences. Please check your browser settings.', 'error'));
    window.addEventListener('error', event => {
        if (event.error && !event.defaultPrevented) show('Something went wrong. Please try again.', 'error');
    });
    window.addEventListener('unhandledrejection', event => {
        if (!event.defaultPrevented) show('Something went wrong. Please try again.', 'error');
    });
    let lastInvalidAt = 0;
    document.addEventListener('invalid', event => {
        event.preventDefault();
        if (Date.now() - lastInvalidAt < 100) return;
        lastInvalidAt = Date.now();
        const field = event.target;
        let message = 'Please complete the required fields.';
        if (field.validity.typeMismatch) message = field.type === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid value.';
        else if (field.validity.patternMismatch) message = field.id === 'auth-code' ? 'Please enter the six-digit verification code.' : 'Please enter a valid value.';
        else if (!field.validity.valueMissing) message = 'Please enter a valid value.';
        field.setAttribute('aria-invalid', 'true');
        field.focus();
        show(message, 'error');
    }, true);
    document.addEventListener('input', event => event.target.removeAttribute('aria-invalid'));
})();
