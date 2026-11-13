(function () {
  const F = (window.Famina = { client: null, user: null, config: null });
  F.escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  F.t = (message) => window.i18n?.translateText(message) || message;
  F.money = (amount) =>
    new Intl.NumberFormat(window.i18n?.currentLanguage || "fr-TD", {
      style: "currency",
      currency: "XAF",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  F.notify = (message, type = "info") =>
    window.FaminaNotifications.show(message, type);
  F.safeImage = (url) => (/^https:\/\//.test(url || "") ? F.escape(url) : "");
  async function request(path, options = {}, token) {
    const response = await fetch(window.FAMINA_API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(20000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        data.message || "Service unavailable. Please try again.",
      );
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const apiRequest = async (path, options = {}) => {
    await F.ready;
    const session = F.client
      ? (await F.client.auth.getSession()).data.session
      : null;
    try {
      return await request(
        path,
        {
          ...options,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
        },
        session?.access_token,
      );
    } catch (error) {
      if (error.status === 401 && F.user) await F.refreshUser(null);
      throw error;
    }
  };
  F.api = (path, options) => {
    const finished = window.FaminaLoading?.request?.() || (() => {});
    return apiRequest(path, options).finally(finished);
  };
  F.require = async (role) => {
    await F.ready;
    if (F.Navigation && !(await F.Navigation.protect())) return false;
    if (!F.user) {
      window.FaminaSession.rememberPage();
      window.FaminaSession.gate(
        document.querySelector("main .container") ||
          document.querySelector("main"),
        "Please login to continue.",
      );
      return false;
    }
    if (role && F.user.role !== role) {
      F.notify("Access denied.", "error");
      return false;
    }
    return true;
  };
  F.busy = async (button, action) => {
    if (button?.disabled) return;
    const done = window.FaminaLoading.start();
    const buttonDone = window.FaminaLoading.button(button);
    try {
      return await action();
    } catch (error) {
      F.notify(error.message, "error");
    } finally {
      done();
      buttonDone();
    }
  };
  let identityRevision = 0;
  F.refreshUser = async (session) => {
    const revision = ++identityRevision;
    if (!session) {
      const signedIn = Boolean(F.user);
      F.user = null;
      window.FaminaSession.clear();
      window.updateAuthStatus?.();
      window.dispatchEvent(new Event("famina-auth-updated"));
      if (signedIn) window.dispatchEvent(new Event("famina-signed-out"));
      return;
    }
    let data;
    try {
      data = await request("/auth/me", {}, session.access_token);
    } catch (error) {
      if (revision !== identityRevision) return;
      throw error;
    }
    if (revision !== identityRevision) return;
    F.authError = null;
    F.user = data.user;
    window.FaminaSession.save(session.access_token, data.user, "supabase");
    window.updateAuthStatus?.();
    window.dispatchEvent(new Event("famina-auth-updated"));
  };
  let retryTimer = null, retryAttempts = 0;
  async function restoreSession() {
    if (!F.client) return;
    try {
      const { data, error } = await F.client.auth.getSession();
      if (error) throw error;
      await F.refreshUser(data.session);
      F.authError = null;
      retryAttempts = 0;
      clearTimeout(retryTimer);
    } catch (error) {
      F.authError = error;
      if (error.status === 401 || error.status === 403) {
        await F.refreshUser(null);
      } else if (retryAttempts < 3) {
        // A network/Render outage is not a sign-out. Keep the SDK session so it
        // can refresh and verify again; never trust a cached profile as identity.
        clearTimeout(retryTimer);
        retryTimer = setTimeout(restoreSession, [5000, 15000, 30000][retryAttempts++]);
      }
    }
  }
  window.addEventListener("online", () => { retryAttempts = 0; restoreSession(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && F.authError) { retryAttempts = 0; restoreSession(); }
  });
  F.ready = (async () => {
    try {
      F.config = await request("/config");
      if (!F.config.configured) {
        window.FaminaSession.clear();
        return;
      }
      F.client = window.supabase.createClient(
        F.config.supabaseUrl,
        F.config.supabaseAnonKey,
        {
          auth: {
            flowType: "pkce",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      );
      // Install the listener before contacting the API, so a cold server cannot
      // prevent future token refreshes or sign-in events from being handled.
      F.client.auth.onAuthStateChange(() => {
        setTimeout(() => restoreSession(), 0);
      });
      await restoreSession();
    } catch (error) {
      window.FaminaSession.clear();
      F.setupError = error;
    }
  })();
  F.ready.then(() => window.FaminaLoading?.ready?.());
  F.subscribe = async (table, filter, callback, status) => {
    await F.ready;
    if (!F.client) return () => {};
    const channel = F.client
      .channel(table + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        callback,
      )
      .subscribe((state) => status?.(state));
    return () => F.client.removeChannel(channel);
  };
  async function showLoginSuccess() {
    await F.ready;
    if (!F.user || /\/(login|register)\.html$/.test(location.pathname)) return;
    try {
      const receipt = JSON.parse(sessionStorage.getItem("famina-login-success") || "null");
      sessionStorage.removeItem("famina-login-success");
      if (receipt?.userId === F.user.id && Date.now() - receipt.at >= 0 && Date.now() - receipt.at < 60000)
        F.notify("Login successful.", "success");
    } catch (_) { /* A blocked storage area must not interrupt authentication. */ }
  }
  document.addEventListener("DOMContentLoaded", showLoginSuccess);
  window.addEventListener("famina-auth-updated", showLoginSuccess);
  window.addEventListener("famina-signed-out", () => {
    F.user = null;
  });
  document.addEventListener("DOMContentLoaded", async () => {
    await F.ready;
    if (!F.user) return;
    const stop = await F.subscribe(
      "notifications",
      "user_id=eq." + F.user.id,
      (event) => {
        if (event.eventType === "INSERT") F.notify("Order updated.");
      },
    );
    window.addEventListener("pagehide", stop, { once: true });
  });
})();
