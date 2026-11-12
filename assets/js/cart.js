(function () {
  const F = window.Famina;
  async function getCart() {
    await F.ready;
    return F.user ? F.api("/cart") : [];
  }
  async function updateCartCount() {
    try {
      const items = await getCart();
      const el = document.getElementById("cart-count");
      if (el) el.textContent = items.reduce((sum, i) => sum + i.quantity, 0);
    } catch {}
  }
  async function renderCartItems() {
    const el = document.getElementById("cart-items");
    if (!el) return;
    try {
      const items = await getCart();
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
      el.textContent = F.t("Cart is temporarily unavailable.");
    }
  }
  window.addToCart = async (itemId, quantity = 1) => {
    if (!(await F.require("customer"))) return;
    await F.api("/cart", { method: "POST", body: { itemId, quantity } });
    await updateCartCount();
    F.notify("Item added to cart.");
  };
  window.getCart = getCart;
  window.updateCartCount = updateCartCount;
  window.renderCartItems = renderCartItems;
  window.calculateCartTotal = async () =>
    (await getCart()).reduce((s, i) => s + i.price * i.quantity, 0);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-quantity]");
    if (!b) return;
    F.busy(b, async () => {
      const quantity = Number(b.dataset.quantity);
      await F.api("/cart/" + b.dataset.item, {
        method: quantity ? "PUT" : "DELETE",
        ...(quantity ? { body: { quantity } } : {}),
      });
      await renderCartItems();
      await updateCartCount();
    });
  });
  document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();
    renderCartItems();
  });
  document.addEventListener("componentloaded", updateCartCount);
  window.addEventListener("famina-signed-out", () => {
    renderCartItems();
    updateCartCount();
  });
})();
