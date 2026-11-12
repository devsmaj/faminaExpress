// All API requests reach the configured backend. No browser-generated sessions or demo responses.
(function () {
  const original = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = new URL(
      typeof input === "string" ? input : input.url,
      location.href,
    );
    if (
      url.origin === "http://localhost:3001" &&
      url.pathname.startsWith("/api/")
    )
      return original(
        window.FAMINA_API_BASE + url.pathname.slice(4) + url.search,
        init,
      );
    return original(input, init);
  };
})();
