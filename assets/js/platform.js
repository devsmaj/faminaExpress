(function () {
  if (window.Famina?.ready) return;
  const F = (window.Famina = { client: null, user: null, config: null, authState: "checking" });
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
  function sessionWithTimeout() {
    let timer;
    return Promise.race([
      F.client.auth.getSession(),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(Error("Service unavailable. Please try again.")), 15000); })
    ]).finally(() => clearTimeout(timer));
  }
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
    if ((options.method || "GET") === "GET" && /^\/(menu|restaurants)(\?|$)/.test(path)) return request(path, options);
    await F.ready;
    if (!F.user) { const error = F.authError || F.setupError || new Error("Please sign in again."); error.status ||= 401; throw error; }
    const session = F.client
      ? (await sessionWithTimeout()).data.session
      : null;
    if (!session) {
      await F.refreshUser(null);
      const error = new Error("Please sign in again."); error.status = 401; throw error;
    }
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
      if (error.status === 401 && F.user && verifiedToken === session?.access_token) {
        rejectedToken = session.access_token;
        await F.refreshUser(null);
      }
      throw error;
    }
  };
  F.api = (path, options = {}) => {
    const { background, ...requestOptions } = options;
    const finished = !background && window.FaminaLoading?.request?.() || (() => {});
    return apiRequest(path, requestOptions).finally(finished);
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
    const buttonDone = window.FaminaLoading.button(button);
    try {
      return await action();
    } catch (error) {
      F.notify(error.message, "error");
    } finally {
      buttonDone();
    }
  };
  let identityRevision = 0, verifiedToken = null, rejectedToken = null;
  let verification = null, restoring = null, initializing = false, authEventVersion = 0;
  const emitAuth = () => {
    window.updateAuthStatus?.();
    window.dispatchEvent(new Event("famina-auth-updated"));
  };
  F.refreshUser = (session, { force = true } = {}) => {
    if (!session) {
      identityRevision++;
      verifiedToken = null;
      verification = null;
      const changed = F.user || F.authState !== "unauthenticated";
      const signedIn = Boolean(F.user);
      F.user = null;
      F.authState = "unauthenticated";
      F.authError = null;
      if (changed) { window.FaminaSession.clear(); emitAuth(); }
      if (signedIn) window.dispatchEvent(new Event("famina-signed-out"));
      return Promise.resolve();
    }
    const token = session.access_token;
    if (verification?.token === token) return verification.promise;
    if (!force && verifiedToken === token && F.user) return Promise.resolve();
    if (!force && rejectedToken === token) return Promise.resolve();
    if (F.user && session.user?.id && F.user.id !== session.user.id) F.refreshUser(null);
    const revision = ++identityRevision;
    const operation = (async () => {
      try {
        const data = await request("/auth/me", {}, token);
        if (revision !== identityRevision) return;
        if (!data.user?.id) throw Error("Service unavailable. Please try again.");
        const previous = F.user;
        window.FaminaSession.save(token, data.user, "supabase");
        F.user = data.user;
        F.authState = "authenticated";
        F.authError = null;
        verifiedToken = token;
        rejectedToken = null;
        if (previous && previous.id !== data.user.id) window.dispatchEvent(new Event("famina-signed-out"));
        if (JSON.stringify(previous) !== JSON.stringify(data.user)) emitAuth();
      } catch (error) {
        if (revision !== identityRevision) return;
        if ([401,403].includes(error.status)) {
          rejectedToken = token;
          await F.refreshUser(null);
        } else {
          F.authError = error;
          F.authState = F.user ? "authenticated" : "error";
          emitAuth();
        }
        throw error;
      } finally {
        if (verification?.promise === operation) verification = null;
      }
    })();
    verification = {token, promise: operation};
    return operation;
  };
  function restoreSession({force = false} = {}) {
    if (restoring) return restoring;
    restoring = (async () => {
      let version;
      do {
        version = authEventVersion;
        const { data, error } = await sessionWithTimeout();
        if (error) throw error;
        if (version !== authEventVersion) continue;
        await F.refreshUser(data.session, {force});
      } while (version !== authEventVersion);
    })().catch(error => {
      if (F.authState !== "unauthenticated") {
        F.authError = error;
        F.authState = F.user ? "authenticated" : "error";
      }
    }).finally(() => { restoring = null; });
    return restoring;
  }
  let booting = null, queuedAuth = false, queuedForce = false, observedToken;
  function initialize() {
    if (booting) return booting;
    booting = (async () => {
      initializing = true;
      try {
        if (!F.client) {
          F.config = await request("/config");
          if (!F.config.configured) throw Error("Authentication setup is incomplete.");
          F.client = window.supabase.createClient(F.config.supabaseUrl, F.config.supabaseAnonKey, {
            auth: {flowType:"pkce", persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}
          });
          F.client.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION" && initializing) return;
            const token = session?.access_token || null;
            if (event !== "USER_UPDATED" && (token === observedToken || (token === verifiedToken && F.user))) return;
            observedToken = token;
            authEventVersion++;
            if (event === "SIGNED_OUT") F.refreshUser(null);
            queuedForce ||= event === "USER_UPDATED";
            if (queuedAuth) return;
            queuedAuth = true;
            setTimeout(() => {
              queuedAuth = false;
              const force = queuedForce;
              queuedForce = false;
              restoreSession({force});
            }, 0);
          });
        }
        F.setupError = null;
        await restoreSession();
      } catch (error) {
        F.setupError = error;
        F.authError = error;
        F.authState = F.user ? "authenticated" : "error";
        emitAuth();
      } finally { initializing = false; }
    })().finally(() => { booting = null; });
    return booting;
  }
  F.retryAuth = () => F.client ? restoreSession({force:true}) : initialize();
  window.addEventListener("online", () => {
    if (F.authState === "error") return F.retryAuth();
  });
  F.ready = initialize();
  F.ready.then(() => window.FaminaLoading?.ready?.());
  F.subscribe = async (table, filter, callback, status) => {
    await F.ready;
    if (!F.client || !F.user) return () => {};
    let active = true;
    const userId = F.user.id;
    const channel = F.client
      .channel(table + ":" + crypto.randomUUID())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (event) => { if (active && F.user?.id === userId) callback(event); },
      )
      .subscribe((state) => { if (active && F.user?.id === userId) status?.(state); });
    const stop = () => {
      if (!active) return;
      active = false;
      window.removeEventListener("famina-signed-out", stop);
      window.removeEventListener("pagehide", stop);
      F.client.removeChannel(channel);
    };
    window.addEventListener("famina-signed-out", stop, {once:true});
    window.addEventListener("pagehide", stop, {once:true});
    return stop;
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
