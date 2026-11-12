(function () {
    const video = document.querySelector('.auth-video');
    const toggle = document.getElementById('video-toggle');
    if (!video || !toggle) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let userPaused = false;
    function updateButton() {
        const paused = video.paused;
        const key = paused ? 'auth.play' : 'auth.pause';
        toggle.setAttribute('aria-pressed', String(!paused));
        const label = toggle.querySelector('span');
        label.dataset.i18n = key;
        const fallback = paused ? 'Play background video' : 'Pause background video';
        label.textContent = window.i18n ? window.i18n.t(key, fallback) : fallback;
        toggle.querySelector('svg').innerHTML = paused
            ? '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>'
            : '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/>';
    }
    async function play() {
        if (!video.src) video.src = video.dataset.src;
        try { await video.play(); } catch (_) { /* Retain poster if autoplay is blocked. */ }
        updateButton();
    }
    toggle.addEventListener('click', () => {
        userPaused = !video.paused;
        if (video.paused) play(); else video.pause();
    });
    video.addEventListener('play', updateButton);
    video.addEventListener('pause', updateButton);
    reducedMotion.addEventListener('change', () => {
        if (reducedMotion.matches) video.pause();
        else if (!userPaused && !document.hidden) play();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) video.pause();
        else if (!userPaused && !reducedMotion.matches && !navigator.connection?.saveData) play();
    });
    if (!reducedMotion.matches && !navigator.connection?.saveData) play();
    else updateButton();
})();
