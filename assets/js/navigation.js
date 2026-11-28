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
    services: ["services.html", "Services", "nav.services", "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
    support: ["contact.html", "Support", "footer.support", "M12 3a9 9 0 0 0-9 9v5h4v-5H3m18 0v5h-4v-5h4a9 9 0 0 0-9-9"],
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
  const unifiedPublicPages = new Set(["index.html","login.html","register.html","about.html","services.html","contact.html","faq.html","privacy.html","terms.html","photo-credits.html","restaurant.html","menu.html","cart.html","404.html"]);
  const isUnifiedPublicPage = () => unifiedPublicPages.has(page());
  const homeMenus = {
    products: ["Products", [
      ["↗", "Send money", "Transfers · In development", "services.html"],
      ["↓", "Receive money", "Receive funds · In development", "services.html"],
      ["◉", "Mobile money", "Mobile payments · In development", "services.html"],
      ["⌁", "Airtime & data", "Stay connected · In development", "services.html"],
      ["▤", "Bill payments", "Pay bills · In development", "services.html"],
      ["▣", "Merchant payments", "For businesses · In development", "services.html"],
      ["◫", "FAMIPAY account", "Explore your dashboard", "famipay-app.html"],
      ["◌", "All products", "Explore all services", "services.html"],
    ]],
    explore: ["Explore", [
      ["♧", "Food delivery", "Discover local restaurants", "restaurant.html"],
      ["✿", "Agriculture", "Local produce · Coming soon", "services.html"],
      ["▣", "Online shop", "Everyday products · Coming soon", "services.html"],
      ["◌", "All services", "Explore everything in one place", "services.html"],
    ]],
    company: ["Company", [
      ["▦", "About us", "Our mission and vision", "about.html"],
      ["◇", "Business & merchants", "Opportunities for businesses", "contact.html"],
      ["♧", "Help & support", "Contact our team", "contact.html"],
      ["?", "FAQ", "Answers to common questions", "faq.html"],
      ["♢", "Privacy policy", "How information is handled", "privacy.html"],
      ["⚖", "Terms & conditions", "Conditions of use", "terms.html"],
    ]],
    download: ["Download", [["↓", "FAMIPAY app", "Download for Android", "https://github.com/devsmaj/Famipay/releases/download/famipay-preview/FAMIPAY.apk"]]],
  };
  const menuIcons = {
    "Send money": '<path d="M22 2 15 22l-4-9-9-4 20-7ZM22 2 11 13"/>',
    "Receive money": '<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
    "Mobile money": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4M8 6h8"/>',
    "Airtime & data": '<path d="M3 8a14 14 0 0 1 18 0M6 11a9 9 0 0 1 12 0M9 14a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="18" r="1"/>',
    "Bill payments": '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 8h8M8 12h8"/>',
    "Merchant payments": '<path d="M3 9h18l-2-6H5L3 9ZM4 10v11h16V10M9 21v-7h6v7"/>',
    "FAMIPAY account": '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-5 5h2"/>',
    "All products": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "Food delivery": '<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M20 3c-3 2-4 5-4 9h4m0-9v18"/>',
    "Agriculture": '<path d="M12 21V11M12 16C6 16 4 13 4 8c5 0 8 3 8 8ZM12 11c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    "Online shop": '<path d="M4 8h16l1 13H3L4 8ZM8 9V6a4 4 0 0 1 8 0v3"/>',
    "All services": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "About us": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    "Business & merchants": '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1m-4 7v-4h2v4"/>',
    "Help & support": '<path d="M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v5H5a1 1 0 0 1-1-1v-4Zm16 0h-3v5h2a1 1 0 0 0 1-1v-4ZM17 19c-1 1-2 2-5 2"/>',
    "FAQ": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .8-1.7 1.2-1.7 2.7m0 3h.01"/>',
    "Privacy policy": '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    "Terms & conditions": '<path d="M12 3v18M5 7h14M6 7 3 13h6L6 7Zm12 0-3 6h6l-3-6ZM8 21h8"/>',
    "FAMIPAY app": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 18h4m2-10-4 4-4-4m4 4V5"/>',
  };
  function homeNavigation() {
    return Object.entries(homeMenus).map(([id, [title, items]]) => id === 'download'
      ? `<li class="home-menu-item"><a class="home-menu-toggle" data-navigation-link="download" href="${items[0][3]}" download="FAMIPAY.apk" aria-label="Download FAMIPAY APK for Android">${title}</a></li>`
      :
      `<li class="home-menu-item"><button type="button" class="home-menu-toggle" data-navigation-link="${id}" data-home-menu="${id}" aria-expanded="false" aria-controls="home-menu-${id}"><span>${title}</span>${id === 'download' ? '' : '<span aria-hidden="true" class="home-chevron">⌄</span>'}</button><div id="home-menu-${id}" class="home-mega-menu" hidden>${items.map(([_icon, label, description, href]) => `<${href ? 'a' : 'div'} class="home-menu-entry" ${href ? 'href="' + href + '"' : ''}><span class="home-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${menuIcons[label]}</svg></span><span><strong>${label}</strong><small>${description}</small></span></${href ? 'a' : 'div'}>`).join('')}</div></li>`
    ).join('');
  }
  function closeHomeMenus(focus = false) {
    document.querySelectorAll('[data-home-menu]').forEach(button => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', 'false');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) panel.hidden = true;
      if (expanded && focus) button.focus();
    });
  }
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
    const keys = ["services", "about", "support"];
    if (
      renderingRole !== role ||
      !nav.querySelector("[data-navigation-link]")
    ) {
      const list = nav.querySelector(".nav-list");
      list.innerHTML = isUnifiedPublicPage() ? homeNavigation() : keys
        .map((key) => {
          const [defaultUrl, label, i18n, path] = links[key];
          const url = key === "home" && role === "customer" ? "customer-home.html" : defaultUrl;
          return `<li><a href="${url}" data-navigation-link="${key}" ${page() === url ? 'aria-current="page"' : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg><span data-i18n="${i18n}">${label}</span>${key === "cart" ? '<span id="cart-count" aria-live="polite" data-no-translate>0</span>' : ""}</a></li>`;
        })
        .join("");
      document.getElementById("auth-links").innerHTML = user
        ? '<button type="button" class="nav-sign-out" data-sign-out data-i18n="nav.sign_out">Sign out</button>'
        : isUnifiedPublicPage()
          ? '<a class="home-sign-in" href="login.html" data-i18n="nav.login">Sign in</a><a class="home-sign-up" href="register.html">Create free account</a>'
          : '<a href="login.html" data-i18n="nav.access">Login / Sign up</a>';
      renderingRole = role;
      F.Cart?.refreshBadge();
      if (open) nav.querySelector(".close-menu")?.focus();
    }
    document.querySelectorAll('.header .logo a,.header .mobile-menu-brand').forEach((link) => {
      link.href = "index.html";
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
    const menuButton = event.target.closest('[data-home-menu]');
    if (menuButton) {
      const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
      closeHomeMenus();
      if (!wasOpen) {
        menuButton.setAttribute('aria-expanded', 'true');
        document.getElementById(menuButton.getAttribute('aria-controls')).hidden = false;
      }
      return;
    }
    if (!event.target.closest('.home-menu-item')) closeHomeMenus();
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
    if (event.key === "Escape" && document.querySelector('[data-home-menu][aria-expanded="true"]')) {
      event.preventDefault();
      closeHomeMenus(true);
      return;
    }
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
  if (page() === "index.html") {
    const updateHeader = () => document.querySelector('.header')?.classList.toggle('home-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', updateHeader, {passive:true});
    document.addEventListener('componentloaded', updateHeader);
    updateHeader();
  }
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
