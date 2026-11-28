/* FAMIPAY loading utilities: no page, header, or image skeletons. */
(function () {
  if (window.FaminaLoading) return;
  document.documentElement.classList.remove('page-loading', 'header-loading');
  const buttons = new WeakMap();
  const eligible = Boolean(
    document.body?.classList.contains('fp-app') ||
    document.body?.classList.contains('fp-verification-page') ||
    document.body?.dataset.authPage
  );
  // Private pages use the compact transparent loader; auth retains its own feedback.
  const allowGlobalOverlay = !document.body?.dataset.authPage;
  let active = 0;
  let showTimer = 0;
  let loader = null;
  function getLoader() {
    if (loader || !eligible || !allowGlobalOverlay) return loader;
    loader = document.createElement('div');
    loader.className = 'fp-global-loader';
    loader.hidden = true;
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.setAttribute('aria-label', 'Loading FAMIPAY');
    const ring = document.createElement('span');
    ring.className = 'fp-global-loader-ring';
    ring.setAttribute('aria-hidden', 'true');
    const logoWindow = document.createElement('span');
    logoWindow.className = 'fp-global-loader-logo-window';
    const logo = document.createElement('img');
    logo.src = new URL('assets/branding/famipay-mark.svg', document.baseURI).href;
    logo.alt = '';
    logoWindow.append(logo);
    loader.append(ring, logoWindow);
    document.body.append(loader);
    return loader;
  }
  function show() {
    showTimer = 0;
    if (active > 0 && allowGlobalOverlay) {
      const current = getLoader();
      if (current) current.hidden = false;
    }
  }
  function start() {
    if (!eligible) return () => {};
    active++;
    if (allowGlobalOverlay && !showTimer && loader?.hidden !== false)
      showTimer = window.setTimeout(show, 100);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      active = Math.max(0, active - 1);
      if (!active) {
        if (showTimer) {
          window.clearTimeout(showTimer);
          showTimer = 0;
        }
        if (loader) loader.hidden = true;
      }
    };
  }
  function request() { return start(); }
  function transition() {
    const done = start();
    show();
    // Allow the newly rendered page to paint beneath the same brief native-style ring.
    window.setTimeout(done, 320);
  }
  function button(element) {
    if (!element) return () => {};
    if (buttons.has(element)) return buttons.get(element);
    const loadingDone = start();
    const ring = document.createElement('span');
    ring.className = 'button-loading-ring';
    ring.setAttribute('aria-hidden', 'true');
    element.append(ring);
    const disabled = element.disabled;
    const busy = element.getAttribute('aria-busy');
    element.classList.add('button-loading');
    element.setAttribute('aria-busy', 'true');
    if ('disabled' in element) element.disabled = true;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      loadingDone();
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
  function reveal() { document.documentElement.classList.remove('page-loading', 'header-loading'); }
  window.FaminaLoading = {
    start, button, request, transition,
    resolveGuard: reveal,
    ready: reveal,
    componentFailed(id) {
      if (id !== 'header') return;
      reveal();
      const header = document.getElementById('header');
      if (!header) return;
      const error = document.createElement('div');
      error.className = 'header-component-error';
      error.setAttribute('role', 'alert');
      const message = 'Could not load this page section. Please refresh and try again.';
      error.textContent = window.i18n?.translateText(message) || message;
      header.replaceChildren(error);
    }
  };
  document.addEventListener('DOMContentLoaded', reveal);
  window.addEventListener('pageshow', reveal);
})();
