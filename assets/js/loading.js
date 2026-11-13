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
    let requests = 0, authReady = false, domReady = false, initial = true;
    const main = document.querySelector('main');
    const busyChildren = [];
    const bars = '<span class="skeleton-bar skeleton-title"></span><span class="skeleton-bar"></span><span class="skeleton-bar skeleton-short"></span>';
    const skeleton = document.createElement('div');
    skeleton.className = 'page-skeleton';
    skeleton.setAttribute('role', 'status');
    skeleton.setAttribute('aria-label', 'Loading');
    skeleton.innerHTML = '<div class="skeleton-heading" aria-hidden="true">'+bars+'</div><div class="skeleton-grid" aria-hidden="true">'+Array.from({length:3},()=>'<div class="skeleton-card"><div class="skeleton-image"></div>'+bars+'</div>').join('')+'</div>';
    const headerSkeleton = document.createElement('div');
    headerSkeleton.className = 'header-skeleton';
    headerSkeleton.setAttribute('aria-hidden', 'true');
    headerSkeleton.innerHTML = '<span class="skeleton-bar"></span><span class="skeleton-bar"></span><span class="skeleton-bar"></span>';
    const header = document.getElementById('header');
    if (header) {
        document.documentElement.classList.add('header-loading');
        header.before(headerSkeleton);
    }
    function beginPage() {
        if (!main || main.contains(skeleton)) return;
        document.documentElement.classList.add('page-loading');
        main.setAttribute('aria-busy', 'true');
        for (const child of main.children) {
            if (!child.inert) { child.inert = true; busyChildren.push(child); }
        }
        main.prepend(skeleton);
    }
    function endPage() {
        document.documentElement.classList.remove('page-loading');
        main?.removeAttribute('aria-busy');
        skeleton.remove();
        busyChildren.splice(0).forEach(child => child.inert = false);
    }
    function revealHeader() {
        if (authReady && header?.querySelector('.header')) {
            headerSkeleton.remove();
            document.documentElement.classList.remove('header-loading');
        }
    }
    const staticPage = /\/(about|contact|faq|privacy|terms|404)\.html$/.test(location.pathname);
    function settle() {
        revealHeader();
        // One event-loop turn lets existing page handlers render their results.
        // There is no artificial minimum display time or wait for images/video.
        setTimeout(() => {
            if (initial && domReady && (staticPage || (authReady && !requests))) {
                initial = false;
                endPage();
            }
        }, 0);
    }
    function request() {
        if (!initial) return () => {};
        requests++;
        let finished = false;
        return () => { if (!finished) { finished = true; requests--; settle(); } };
    }
    beginPage();
    document.addEventListener('DOMContentLoaded', () => { domReady = true; settle(); });
    document.addEventListener('componentloaded', revealHeader);
    window.FaminaLoading = {
        start, button, request,
        ready() { authReady = true; settle(); },
        componentFailed(id) {
            if (id !== 'header' || !header) return;
            headerSkeleton.remove();
            document.documentElement.classList.remove('header-loading');
            const error = document.createElement('div');
            error.className = 'header-component-error';
            error.setAttribute('role', 'alert');
            const message = 'Could not load this page section. Please refresh and try again.';
            error.textContent = window.i18n?.translateText(message) || message;
            header.replaceChildren(error);
        }
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
    let navigationButtonDone;
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const url = new URL(link.href, location.href);
        if (!/^https?:$/.test(url.protocol) || (url.pathname === location.pathname && url.search === location.search)) return;
        navigationButtonDone?.();
        if (url.origin === location.origin) beginPage();
        navigationButtonDone = button(link);
    });
    window.addEventListener('pageshow', event => {
        navigationButtonDone?.(); navigationButtonDone = null;
        if (event.persisted) endPage();
    });
})();
