(function () {
  const F = window.Famina;
  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("profile-form");
    if (!form || !(await F.require())) return;
    document.getElementById("profile-name").value = F.user.name;
    document.getElementById("profile-email").value =
      F.user.email || F.user.phone || "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      F.busy(form.querySelector("[type=submit]"), async () => {
        await F.api("/profile", {
          method: "PUT",
          body: { name: document.getElementById("profile-name").value },
        });
        await F.refreshUser((await F.client.auth.getSession()).data.session);
        F.notify("Profile updated successfully!");
      });
    });
    const input = document.getElementById("profile-picture-input");
    input?.addEventListener("change", () => {
      const file = input.files[0];
      if (!file || !file.type.startsWith("image/") || file.size > 2000000) {
        F.notify("Choose an image smaller than 2 MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        document.getElementById("profile-picture").src = reader.result;
        try {
          localStorage.setItem("profilePicture_" + F.user.id, reader.result);
        } catch {
          F.notify("Your browser could not save this picture.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
    const picture = localStorage.getItem("profilePicture_" + F.user.id);
    if (picture) document.getElementById("profile-picture").src = picture;
  });
})();
