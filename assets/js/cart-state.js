(function () {
  const F = window.Famina,
    key = "famina_guest_cart_v1";
  if (F.Cart) return;
  let merging = null,
    badgeRevision = 0;
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("famina-cart-updates")
      : null;
  const validId = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (!data || !validId(data.key) || !Array.isArray(data.items))
        return null;
      return {
        ...data,
        items: data.items
          .filter(
            (i) =>
              validId(i.itemId) &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0 &&
              i.quantity <= 50,
          )
          .slice(0, 20),
      };
    } catch {
      return null;
    }
  }
  function save(items) {
    try {
      if (items.length)
        localStorage.setItem(
          key,
          JSON.stringify({ key: crypto.randomUUID(), items }),
        );
      else localStorage.removeItem(key);
    } catch {
      throw Error("Your browser could not save your cart.");
    }
    changed();
  }
  function changed(broadcast = true) {
    window.dispatchEvent(new Event("famina-cart-change"));
    if (broadcast) channel?.postMessage({ userId: F.user?.id || null });
  }
  if (channel)
    channel.onmessage = (event) => {
      if (event.data?.userId === (F.user?.id || null)) changed(false);
    };
  const locked = (fn) =>
    navigator.locks ? navigator.locks.request("famina-guest-cart", fn) : fn();
  async function guestItems() {
    const draft = read();
    if (!draft?.items.length) return [];
    const menu = await F.api("/menu");
    return draft.items.map((row) => {
      const item = menu.find((m) => m.id === row.itemId);
      return {
        id: row.itemId,
        name: item?.name || F.t("Unavailable item"),
        price: item?.price ?? null,
        image: item?.image || null,
        quantity: row.quantity,
        restaurant_id: item?.restaurant_id,
        available: Boolean(item?.available && item?.restaurants?.available),
      };
    });
  }
  async function get() {
    await F.ready;
    if (F.user?.role === "customer") return F.api("/cart");
    if (F.user) return [];
    return guestItems();
  }
  async function add(itemId, quantity = 1) {
    await F.ready;
    if (
      !validId(itemId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    )
      throw Error("Invalid quantity or amount.");
    if (F.user) {
      if (F.user.role !== "customer") throw Error("Customer access required");
      await F.api("/cart", { method: "POST", body: { itemId, quantity } });
      changed();
      return;
    }
    await locked(async () => {
      const menu = await F.api("/menu"),
        item = menu.find((i) => i.id === itemId);
      if (!item?.available || !item.restaurants?.available)
        throw Error("Item unavailable");
      const items = read()?.items || [];
      const existing = items.find((i) => i.itemId === itemId);
      if (
        items.some(
          (i) =>
            menu.find((m) => m.id === i.itemId)?.restaurant_id !==
            item.restaurant_id,
        )
      )
        throw Error("One restaurant per order");
      if (
        (existing?.quantity || 0) + quantity > 50 ||
        (!existing && items.length >= 20)
      )
        throw Error("Quantity limit exceeded");
      if (existing) existing.quantity += quantity;
      else items.push({ itemId, quantity });
      save(items);
    });
  }
  async function set(itemId, quantity) {
    await F.ready;
    if (
      !validId(itemId) ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 50
    )
      throw Error("Invalid quantity or amount.");
    if (F.user) {
      if (F.user.role !== "customer") throw Error("Customer access required");
      await F.api("/cart/" + itemId, {
        method: quantity ? "PUT" : "DELETE",
        ...(quantity ? { body: { quantity } } : {}),
      });
      changed();
      return;
    }
    await locked(() => {
      const items = read()?.items || [];
      save(
        items
          .map((i) => (i.itemId === itemId ? { ...i, quantity } : i))
          .filter((i) => i.quantity),
      );
    });
  }
  async function merge() {
    await F.ready;
    if (F.user?.role !== "customer" || !read()?.items.length) return true;
    if (merging) return merging;
    merging = locked(async () => {
      const draft = read();
      if (!draft?.items.length) return true;
      try {
        await F.api("/cart/merge", {
          method: "POST",
          body: { importKey: draft.key, items: draft.items },
        });
        if (read()?.key === draft.key) localStorage.removeItem(key);
        changed();
        return true;
      } catch (error) {
        F.notify(
          "Your guest cart is saved. Resolve unavailable or conflicting items, then retry the import.",
          "warning",
        );
        return false;
      }
    }).finally(() => {
      merging = null;
    });
    return merging;
  }
  async function refreshBadge() {
    const revision = ++badgeRevision;
    await F.ready;
    let count;
    try {
      count =
        F.user?.role === "customer"
          ? (await F.api("/cart", {background:true})).reduce((s, i) => s + i.quantity, 0)
          : F.user
            ? 0
            : (read()?.items || []).reduce((s, i) => s + i.quantity, 0);
    } catch {
      count = null;
    }
    if (revision !== badgeRevision) return;
    const el = document.getElementById("cart-count");
    if (el) {
      el.textContent = count === null ? "—" : String(count);
      el.setAttribute(
        "aria-label",
        F.t(count === null ? "Cart quantity unavailable" : "Cart quantity") +
          (count === null ? "" : ": " + count),
      );
    }
  }
  F.Cart = {
    get,
    add,
    set,
    merge,
    refreshBadge,
    hasGuestItems: () => Boolean(read()?.items.length),
  };
  window.addEventListener("famina-cart-change", refreshBadge);
  window.addEventListener("famina-auth-updated", () => {
    merge().then(refreshBadge);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      changed();
    }
  });
  window.addEventListener("pageshow", () => {
    merge().then(refreshBadge);
  });
  document.addEventListener("componentloaded", refreshBadge);
  document.addEventListener("languagechange", refreshBadge);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshBadge();
  });
  F.ready.then(() => merge().then(refreshBadge));
})();
