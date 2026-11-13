(function () {
  const F = window.Famina,
    panel = document.getElementById("firebase-auth");
  let sentPhone = "",
    resendAt = 0,
    busy = false;
  const action = (fn, button) => {
    if (busy) return;
    busy = true;
    return F.busy(button, async () => {
      panel.setAttribute("aria-busy", "true");
      panel.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await F.ready;
        if (!F.client) throw Error("Authentication setup is incomplete.");
        await fn();
      } finally {
        busy = false;
        panel.removeAttribute("aria-busy");
        panel.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    });
  };
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
      location.href = F.user?.role === "customer" && /\/(index\.html)?$/.test(target.pathname) ? "customer-home.html" : destination;
    }
  };
  document.getElementById("google-continue").addEventListener("click", () =>
    action(async () => {
      const { error } = await F.client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("login.html", location.href).href },
      });
      if (error) throw error;
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
