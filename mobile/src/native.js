import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Capacitor, registerPlugin} from '@capacitor/core';
import {SplashScreen} from '@capacitor/splash-screen';

if (Capacitor.isNativePlatform()) {
    window.FaminaNativeApp = App;
    window.FaminaDeviceLock = registerPlugin('FamipayDeviceLock');
}

async function handleAuthCallback(value) {
    let callback;
    try {
        callback = new URL(value);
    } catch {
        return false;
    }
    if (
        callback.protocol !== 'famipay:' ||
        callback.hostname !== 'auth' ||
        callback.pathname !== '/login'
    ) return false;

    await window.Famina?.ready;
    if (!window.Famina?.client)
        throw new Error('FAMIPAY authentication is unavailable. Please try again.');
    const errorCode = callback.searchParams.get('error_code');
    const errorDescription = callback.searchParams.get('error_description');
    if (errorCode || errorDescription) {
        window.FaminaNotifications?.show(
            errorDescription || errorCode || 'Email verification could not be completed.',
            'error',
        );
        location.replace('verify-email.html');
        return true;
    }
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('The FAMIPAY confirmation link is incomplete.');
    const {error} = await window.Famina.client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    await Browser.close().catch(() => {});
    location.replace(callback.searchParams.get('recovery') === '1'
        ? 'login.html?recovery=1'
        : 'verify-email.html');
    return true;
}

async function boot() {
    if (!Capacitor.isNativePlatform()) return;
    document.body.classList.add('native-app');
    document.addEventListener('click', event => {
        const anchor = event.target.closest('a[href]');
        if (!anchor) return;
        const url = new URL(anchor.href, location.href);
        if (url.protocol === 'https:' && url.origin !== location.origin) {
            event.preventDefault();
            Browser.open({url: url.href}).catch(error =>
                window.FaminaNotifications?.show(error.message, 'error'));
        }
    });

    await App.addListener('appUrlOpen', event => {
        handleAuthCallback(event.url).catch(error =>
            window.FaminaNotifications?.show(error.message, 'error'));
    });
    const launch = await App.getLaunchUrl();
    if (launch?.url) await handleAuthCallback(launch.url);

    const ready = window.Famina?.ready || Promise.resolve();
    const splashTimeout = window.setTimeout(() => {
        SplashScreen.hide().catch(error => console.error('Could not hide the launch screen:', error));
    }, 8000);
    ready.finally(() => {
        window.clearTimeout(splashTimeout);
        SplashScreen.hide().catch(error => console.error('Could not hide the launch screen:', error));
    });
}

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => boot().catch(error =>
        window.FaminaNotifications?.show(error.message, 'error')));
else
    boot().catch(error => window.FaminaNotifications?.show(error.message, 'error'));
