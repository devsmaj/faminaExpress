(function () {
  const F = window.Famina;
  if (F.Navigation) return;
  const media = matchMedia("(max-width: 1279px)");
  const privateRoutes = {
    "customer-home.html": ["customer"],
    "checkout.html": ["customer"],
    "orders.html": ["customer"],
    "profile.html": ["customer"],
    "delivery-tracking.html": [
      "customer",
      "restaurant_owner",
      "rider",
      "admin",
    ],
    "restaurant-owner-dashboard.html": ["restaurant_owner"],
    "rider-dashboard.html": ["rider"],
    "admin-dashboard.html": ["admin"],
  };
  const dashboards = {
    restaurant_owner: "restaurant-owner-dashboard.html",
    rider: "rider-dashboard.html",
    admin: "admin-dashboard.html",
  };
  const links = {
    home: ["index.html", "Home", "nav.home", "M3 10 12 3l9 7v11h-6v-7H9v7H3Z"],
    explore: [
      "menu.html",
      "Explore Food",
      "nav.explore",
      "M5 3v8m-3-8v5q0 3 3 3t3-3V3M5 11v10M18 3q-5 6 0 9v9M18 3v9",
    ],
    restaurants: [
      "restaurant.html",
      "Restaurants",
      "nav.restaurants",
      "M3 9h18l-2-6H5ZM4 10v11h16V10M9 21v-7h6v7",
    ],
    about: [
      "about.html",
      "About Us",
      "nav.about",
      "M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    ],
    cart: [
      "cart.html",
      "Cart",
      "nav.cart",
      "m2 3 3 1 3 12h11l3-9H6M9 21h1m8 0h1",
    ],
    orders: [
      "orders.html",
      "My Orders",
      "nav.my_orders",
      "m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10",
    ],
    track: [
      "delivery-tracking.html",
      "Track Order",
      "nav.track",
      "M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    ],
    profile: [
      "profile.html",
      "My Profile",
      "nav.my_profile",
      "M20 21v-3a8 8 0 0 0-16 0v3M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    ],
  };
  let open = false,
    returnFocus = null,
    routeContent = null,
    renderingRole = null,
    routeIdentity = null;
  const page = () => location.pathname.split("/").pop() || "index.html";
  function visibleControls() {
    return [
      ...document.querySelectorAll(
        ".header .nav a,.header .nav button,.header .nav select",
      ),
    ].filter(
      (el) =>
        !el.disabled &&
        el.getClientRects().length &&
        getComputedStyle(el).visibility !== "hidden" &&
        !el.closest("[hidden]"),
    );
  }
  function toggle(show, restore = true) {
    const nav = document.querySelector(".header .nav"),
      button = document.querySelector(".hamburger"),
      backdrop = document.querySelector(".nav-backdrop");
    if (!nav || !button) return;
    open = Boolean(show && media.matches);
    nav.classList.toggle("active", open);
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", String(open));
    if (backdrop) backdrop.hidden = !open;
    document.body.classList.toggle("mobile-nav-open", open);
    nav.inert = media.matches && !open;
    const modal = media.matches && open;
    if (modal) {
      nav.setAttribute("role", "dialog");
      nav.setAttribute("aria-modal", "true");
    } else {
      nav.removeAttribute("role");
      nav.removeAttribute("aria-modal");
    }
    for (const el of [...document.body.children]) {
      if (
        el.id === "header" ||
        el.matches("script,link,.toast-stack,.loading-indicator")
      )
        continue;
      if (modal && !el.hasAttribute("inert")) {
        el.dataset.navInert = "true";
        el.inert = true;
      } else if (!modal && el.dataset.navInert) {
        el.inert = false;
        delete el.dataset.navInert;
      }
    }
    if (open) {
      returnFocus = document.activeElement;
      visibleControls()[0]?.focus();
    } else if (restore && returnFocus?.isConnected) {
      (returnFocus.getClientRects().length
        ? returnFocus
        : document.querySelector(".header .logo a")
      )?.focus();
      returnFocus = null;
    }
  }
  function render() {
    const nav = document.querySelector(".header .nav");
    if (!nav) return;
    const user = F.user,
      role = user?.role || "public";
    const keys =
      role === "customer"
        ? [
            "home",
            "explore",
            "restaurants",
            "cart",
            "orders",
            "track",
            "profile",
          ]
        : role === "public"
          ? ["home", "explore", "restaurants", "about", "cart"]
          : ["home", "explore", "restaurants"];
    if (
      renderingRole !== role ||
      !nav.querySelector("[data-navigation-link]")
    ) {
      const list = nav.querySelector(".nav-list");
      list.innerHTML = keys
        .map((key) => {
          const [defaultUrl, label, i18n, path] = links[key];
          const url = key === "home" && role === "customer" ? "customer-home.html" : defaultUrl;
          return `<li><a href="${url}" data-navigation-link="${key}" ${page() === url ? 'aria-current="page"' : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg><span data-i18n="${i18n}">${label}</span>${key === "cart" ? '<span id="cart-count" aria-live="polite" data-no-translate>0</span>' : ""}</a></li>`;
        })
        .join("");
      if (dashboards[role])
        list.insertAdjacentHTML(
          "beforeend",
          `<li><a href="${dashboards[role]}" data-navigation-link="dashboard"><span data-i18n="nav.dashboard">Dashboard</span></a></li>`,
        );
      document.getElementById("auth-links").innerHTML = user
        ? '<button type="button" class="nav-sign-out" data-sign-out data-i18n="nav.sign_out">Sign out</button>'
        : '<a href="login.html" data-i18n="nav.access">Login / Sign up</a>';
      renderingRole = role;
      F.Cart?.refreshBadge();
      if (open) nav.querySelector(".close-menu")?.focus();
    }
    document.querySelectorAll('.header .logo a,.header .mobile-menu-brand').forEach((link) => {
      link.href = role === "customer" ? "customer-home.html" : "index.html";
    });
    const name = nav.querySelector(".mobile-language-name");
    if (name)
      name.textContent = {
        "fr-TD": "Français",
        "ar-TD": "العربية",
        en: "English",
      }[window.i18n?.currentLanguage || "fr-TD"];
    window.i18n?.updatePageTranslations();
    if (!open) toggle(false, false);
  }
  async function protect() {
    await F.ready;
    const required = privateRoutes[page()];
    if (!required) return true;
    const main = document.querySelector("main");
    if (!main) return false;
    if (F.user && required.includes(F.user.role)) {
      const identity = F.user.id + ":" + F.user.role;
      if (!routeContent && (!routeIdentity || routeIdentity === identity)) {
        routeIdentity = identity;
        return true;
      }
    }
    if (!routeContent) {
      routeContent = document.createDocumentFragment();
      while (main.firstChild) routeContent.append(main.firstChild);
    }
    const allowed = F.user && required.includes(F.user.role);
    const unavailable = !F.user && F.authState === "error";
    const guest = !F.user && !unavailable;
    const guard = unavailable ? "error" : allowed ? "continue:"+F.user.id+":"+F.user.role : F.user ? F.user.id+":"+F.user.role : "public";
    if (main.dataset.navigationGuard === guard) return false;
    main.dataset.navigationGuard = guard;
    if (guest) window.FaminaSession.rememberPage();
    const heading = unavailable ? "Sign-in verification is temporarily unavailable." : allowed ? "Session updated. Open this page to continue." : guest ? "Please login to continue." : "Access denied.";
    const message = unavailable ? "Please try again." : allowed ? "" : guest ? "Sign in to access this page." : "This page is reserved for another account role.";
    const href = allowed ? location.href : guest ? "login.html" : dashboards[F.user?.role] || "index.html";
    const label = allowed ? "Continue" : guest ? "Login / Sign up" : dashboards[F.user?.role] ? "Dashboard" : "Home";
    main.innerHTML = '<section class="form-section"><div class="container"><h2>'+F.t(heading)+'</h2><p>'+F.t(message)+'</p>' +
      (unavailable ? '<button class="btn" data-retry-auth>'+F.t("Retry")+'</button>' : '<a class="btn" href="'+F.escape(href)+'">'+F.t(label)+'</a>') + '</div></section>';
    window.FaminaLoading?.resolveGuard?.();
    window.i18n?.updatePageTranslations();
    return false;
  }
  F.Navigation = { render, protect, close: () => toggle(false) };
  window.updateAuthStatus = render;
  document.addEventListener("componentloaded", render);
  document.addEventListener("languagechange", render);
  window.addEventListener("famina-auth-updated", () => {
    render();
    protect();
  });
  document.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-retry-auth]");
    if (retry) { F.busy(retry, async () => { await F.retryAuth(); await protect(); }); return; }
    if (event.target.closest(".hamburger")) {
      toggle(!open);
      return;
    }
    if (event.target.closest(".close-menu,.nav-backdrop")) {
      toggle(false);
      return;
    }
    if (event.target.closest("[data-sign-out]")) {
      window.logout();
      return;
    }
    if (event.target.closest(".header .nav a")) toggle(false, false);
  });
  document.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") {
      if (event.defaultPrevented) return;
      event.preventDefault();
      toggle(false);
      return;
    }
    if (event.key !== "Tab") return;
    const controls = visibleControls(),
      first = controls[0],
      last = controls.at(-1);
    if (
      !document.querySelector(".header .nav")?.contains(document.activeElement)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  media.addEventListener("change", () => {
    toggle(false);
    render();
  });
  async function init() {
    await F.ready;
    render();
    await protect();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
  render();
})();
