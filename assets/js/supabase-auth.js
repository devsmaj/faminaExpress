(function () {
  const F = window.Famina,
    panel = document.getElementById("firebase-auth");
  let sentPhone = "",
    resendAt = 0,
    busy = false;
  let leaving = false, releaseAction = () => {};
  const action = async (fn, button) => {
    if (busy || button?.disabled) return;
    busy = true;
    const original = [...panel.querySelectorAll("button")].map(b => [b, b.disabled]);
    const buttonDone = window.FaminaLoading.button(button);
    panel.setAttribute("aria-busy", "true");
    original.forEach(([b]) => b.disabled = true);
    releaseAction = () => {
      original.forEach(([b, disabled]) => b.disabled = disabled);
      buttonDone();
      panel.removeAttribute("aria-busy");
      busy = false;
      leaving = false;
    };
    try {
      await F.ready;
      if (!F.client) throw Error("Authentication setup is incomplete.");
      await fn();
    } catch (error) {
      leaving = false;
      F.notify(error.message, "error");
    } finally {
      if (!leaving) releaseAction();
    }
  };
  window.addEventListener("pageshow", event => {
    if (event.persisted) releaseAction();
  });
  const finish = async () => {
    const { data } = await F.client.auth.getSession();
    if (!data.session) throw Error("Please sign in again.");
    if (data.session) {
      await F.refreshUser(data.session);
      if (!F.user) throw Error("Please sign in again.");
      await F.Cart?.merge();
      try { sessionStorage.setItem("famina-login-success", JSON.stringify({userId:F.user.id,at:Date.now()})); } catch (_) { F.notify("Login successful.", "success"); }
      const fallback =
        {
          restaurant_owner: "restaurant-owner-dashboard.html",
          rider: "rider-dashboard.html",
          admin: "admin-dashboard.html",
        }[F.user?.role] || "customer-home.html";
      const destination = window.FaminaSession.returnUrl(fallback);
      const target = new URL(destination, location.href);
      leaving = true;
      location.href = F.user?.role === "customer" && /\/(index\.html)?$/.test(target.pathname) ? "customer-home.html" : destination;
    }
  };
  document.getElementById("google-continue").addEventListener("click", () =>
    action(async () => {
      const { data, error } = await F.client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("login.html", location.href).href, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw Error("Google sign-in is unavailable. Please try again.");
      const destination = new URL(data.url);
      if (!["https:", "http:"].includes(destination.protocol)) throw Error("Invalid sign-in address.");
      leaving = true;
      // Let the button paint, then retain its spinner through the browser handoff.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      location.assign(destination.href);
    }, document.getElementById("google-continue")),
  );
  document.getElementById("phone-continue").addEventListener("click", () => {
    document.getElementById("phone-form").hidden = false;
    document.getElementById("auth-phone").focus();
  });
  async function send() {
    if (Date.now() < resendAt)
      throw Error("Please wait before requesting another code.");
    const phone = document.getElementById("auth-phone").value.trim();
    if (!/^\+235\d{8}$/.test(phone))
      throw Error("Use a Chad phone number starting with +235.");
    const { error } = await F.client.auth.signInWithOtp({ phone });
    if (error) throw error;
    sentPhone = phone;
    resendAt = Date.now() + 60000;
    document.getElementById("phone-code-form").hidden = false;
    F.notify("Verification code sent.");
  }
  document.getElementById("phone-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(send, e.submitter || e.target.querySelector("[type=submit]"));
  });
  document
    .getElementById("resend-code")
    .addEventListener("click", e => action(send, e.currentTarget));
  document.getElementById("phone-code-form").addEventListener("submit", (e) => {
    e.preventDefault();
    action(async () => {
      const { error } = await F.client.auth.verifyOtp({
        phone: sentPhone,
        token: document.getElementById("auth-code").value.trim(),
        type: "sms",
      });
      if (error) throw error;
      await finish();
    }, e.submitter || e.target.querySelector("[type=submit]"));
  });
  if (new URLSearchParams(location.search).has("code"))
    F.ready.then(() => {
      if (F.client) action(finish, document.getElementById("google-continue"));
    });
})();
