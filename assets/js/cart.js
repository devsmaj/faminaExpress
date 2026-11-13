(function () {
  const F = window.Famina;
  if (F.cartControllerInitialized) return;
  F.cartControllerInitialized = true;
  let renderRevision = 0;
  async function getCart() {
    return F.Cart.get();
  }
  async function updateCartCount() {
    await F.Cart.refreshBadge();
  }
  async function renderCartItems() {
    const el = document.getElementById("cart-items");
    if (!el) return;
    const revision = ++renderRevision;
    try {
      const items = await getCart();
      if (revision !== renderRevision) return;
      let notice = document.getElementById("guest-cart-import");
      if (F.user?.role === "customer" && F.Cart.hasGuestItems()) {
        if (!notice) {
          notice = document.createElement("div");
          notice.id = "guest-cart-import";
          notice.className = "platform-note";
          el.before(notice);
        }
        notice.innerHTML = `<p>${F.t("Your guest cart is saved. Resolve unavailable or conflicting items, then retry the import.")}</p><button type="button" class="btn-secondary" data-retry-cart>${F.t("Retry saved cart")}</button>`;
      } else notice?.remove();
      el.innerHTML = items.length
        ? items
            .map(
              (i) =>
                `<div class="cart-item">${i.image ? `<img src="${F.safeImage(i.image)}" alt="${F.escape(i.name)}">` : ""}<div class="cart-item-info"><h3 data-no-translate>${F.escape(i.name)}</h3><p>${i.price === null ? F.t("Unavailable") : F.money(i.price)}</p><div class="quantity-controls"><button data-item="${i.id}" data-quantity="${i.quantity - 1}" aria-label="${F.t("Decrease quantity")}" ${!i.available ? "disabled" : ""}>-</button><span>${i.quantity}</span><button data-item="${i.id}" data-quantity="${i.quantity + 1}" aria-label="${F.t("Increase quantity")}" ${i.quantity >= 50 || !i.available ? "disabled" : ""}>+</button></div><button class="remove-item" data-item="${i.id}" data-quantity="0">${F.t("Remove")}</button></div></div>`,
            )
            .join("")
        : `<p>${F.t("Your cart is empty.")}</p>`;
      const total = document.getElementById("cart-total");
      if (total)
        total.textContent = items.some((i) => !i.available)
          ? F.t("Remove unavailable items before checkout.")
          : F.t("Subtotal") +
            ": " +
            F.money(items.reduce((s, i) => s + i.price * i.quantity, 0));
    } catch (e) {
      if (revision !== renderRevision) return;
      el.textContent = F.t("Cart is temporarily unavailable.");
    }
  }
  window.addToCart = async (itemId, quantity = 1) => {
    await F.Cart.add(itemId, quantity);
    await updateCartCount();
    F.notify("Item added to cart.");
  };
  window.getCart = getCart;
  window.updateCartCount = updateCartCount;
  window.renderCartItems = renderCartItems;
  window.calculateCartTotal = async () =>
    (await getCart()).reduce((s, i) => s + i.price * i.quantity, 0);
  document.addEventListener("click", (e) => {
    const retry = e.target.closest("[data-retry-cart]");
    if (retry) {
      F.busy(retry, () => F.Cart.merge().then(renderCartItems));
      return;
    }
    const b = e.target.closest("[data-quantity]");
    if (!b) return;
    F.busy(b, async () => {
      const quantity = Number(b.dataset.quantity);
      await F.Cart.set(b.dataset.item, quantity);
      await renderCartItems();
      await updateCartCount();
    });
  });
  document.addEventListener("DOMContentLoaded", () => {
    renderCartItems();
  });
  window.addEventListener("famina-cart-change", renderCartItems);
  window.addEventListener("famina-auth-updated", renderCartItems);
})();
