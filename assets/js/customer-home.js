document.addEventListener("DOMContentLoaded", async () => {
  const F = window.Famina;
  if (!(await F.require("customer"))) return;
  document.getElementById("customer-home-name").textContent = F.user.name || "";
});
