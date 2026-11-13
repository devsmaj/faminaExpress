(function () {
    let pending = 0, indicator;
    function start() {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'loading-indicator';
            indicator.setAttribute('role', 'status');
            indicator.setAttribute('aria-label', 'Loading');
            indicator.innerHTML = '<span class="loading-ring" aria-hidden="true"></span>';
            document.body.append(indicator);
        }
        pending++;
        indicator.hidden = false;
        let finished = false;
        return () => {
            if (finished) return;
            finished = true;
            pending = Math.max(0, pending - 1);
            indicator.hidden = !pending;
        };
    }
    const buttons = new WeakMap();
    function button(element) {
        if (!element) return () => {};
        if (buttons.has(element)) return buttons.get(element);
        const disabled = element.disabled, busy = element.getAttribute('aria-busy');
        const ring = document.createElement('span');
        ring.className = 'button-loading-ring';
        ring.setAttribute('aria-hidden', 'true');
        element.append(ring);
        element.classList.add('button-loading');
        element.setAttribute('aria-busy', 'true');
        if ('disabled' in element) element.disabled = true;
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            ring.remove();
            element.classList.remove('button-loading');
            if (busy === null) element.removeAttribute('aria-busy');
            else element.setAttribute('aria-busy', busy);
            if ('disabled' in element) element.disabled = disabled;
            buttons.delete(element);
        };
        buttons.set(element, done);
        return done;
    }
    window.FaminaLoading = { start, button };
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const done = start();
        try { return await originalFetch.apply(this, args); }
        finally { done(); }
    };
    function watch(image) {
        if (image.dataset.loadingWatched) return;
        image.dataset.loadingWatched = 'true';
        const update = () => image.classList.toggle('image-loading', !image.complete);
        image.addEventListener('load', update);
        image.addEventListener('error', update);
        update();
    }
    function scan(node) {
        if (node.nodeType !== 1) return;
        if (node.matches('img')) watch(node);
        node.querySelectorAll('img').forEach(watch);
    }
    scan(document.body);
    new MutationObserver(records => records.forEach(record => {
        if (record.type === 'attributes') {
            record.target.classList.toggle('image-loading', !record.target.complete);
        } else record.addedNodes.forEach(scan);
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
    let navigationDone, navigationButtonDone;
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const url = new URL(link.href, location.href);
        if (!/^https?:$/.test(url.protocol) || (url.pathname === location.pathname && url.search === location.search)) return;
        navigationDone?.();
        navigationButtonDone?.();
        navigationDone = start();
        navigationButtonDone = button(link);
    });
    window.addEventListener('pageshow', () => { navigationDone?.(); navigationButtonDone?.(); navigationDone = navigationButtonDone = null; });
})();
