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
    window.FaminaLoading = { start };
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
    let navigationDone;
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const url = new URL(link.href, location.href);
        if (!/^https?:$/.test(url.protocol) || (url.pathname === location.pathname && url.search === location.search)) return;
        navigationDone?.();
        navigationDone = start();
    });
    window.addEventListener('pageshow', () => { navigationDone?.(); navigationDone = null; });
})();
