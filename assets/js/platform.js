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
  F.api = async (path, options = {}) => {
    await F.ready;
    const session = F.client
      ? (await F.client.auth.getSession()).data.session
      : null;
    return request(
      path,
      {
        ...options,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      session?.access_token,
    );
  };
  F.require = async (role) => {
    await F.ready;
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
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    try {
      return await action();
    } catch (error) {
      F.notify(error.message, "error");
    } finally {
      done();
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  };
  F.refreshUser = async (session) => {
    if (!session) {
      F.user = null;
      window.FaminaSession.clear();
      window.updateAuthStatus?.();
      return;
    }
    const data = await request("/auth/me", {}, session.access_token);
    F.user = data.user;
    window.FaminaSession.save(session.access_token, data.user, "supabase");
    window.updateAuthStatus?.();
  };
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
      const { data, error } = await F.client.auth.getSession();
      if (error) throw error;
      await F.refreshUser(data.session);
      F.client.auth.onAuthStateChange((event, session) => {
        setTimeout(
          () =>
            F.refreshUser(session).catch((error) => {
              F.user = null;
              window.FaminaSession.clear();
              F.notify(error.message, "error");
            }),
          0,
        );
      });
    } catch (error) {
      window.FaminaSession.clear();
      F.setupError = error;
    }
  })();
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
