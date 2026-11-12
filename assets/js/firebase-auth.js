import { auth } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, signOut }
    from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

const panel = document.getElementById('firebase-auth');
const status = document.getElementById('firebase-status');
const phoneForm = document.getElementById('phone-form');
const codeForm = document.getElementById('phone-code-form');
const resend = document.getElementById('resend-code');
let verifier;
let confirmation;
let resendAt = 0;
let busy = false;

function authError(key) { const error = new Error(key); error.authKey = key; return error; }
function showStatus(key) {
    status.dataset.i18n = 'auth.errors.' + key;
    status.textContent = window.i18n ? window.i18n.t(status.dataset.i18n, 'Please try again.') : 'Please try again.';
}
function errorKey(error) {
    const keys = {
        'auth/popup-closed-by-user': 'cancelled', 'auth/popup-blocked': 'popup',
        'auth/unauthorized-domain': 'domain', 'auth/operation-not-allowed': 'disabled',
        'auth/invalid-phone-number': 'phone', 'auth/invalid-verification-code': 'code',
        'auth/code-expired': 'expired', 'auth/too-many-requests': 'attempts',
        'auth/quota-exceeded': 'quota', 'auth/network-request-failed': 'network'
    };
    return error.authKey || keys[error.code] || 'failed';
}
function setAuthLanguage() { auth.languageCode = (window.i18n?.getCurrentLanguage() || 'fr-TD').split('-')[0]; }
setAuthLanguage();
document.addEventListener('languagechange', setAuthLanguage);

async function run(action) {
    if (busy) return;
    busy = true;
    delete status.dataset.i18n;
    status.textContent = '';
    panel.querySelectorAll('button').forEach(button => button.disabled = true);
    try { await action(); }
    catch (error) { showStatus(errorKey(error)); }
    finally {
        busy = false;
        panel.querySelectorAll('button').forEach(button => button.disabled = false);
    }
}

async function finish(user) {
    try {
        const response = await fetch(`${window.FAMINA_API_BASE}/auth/firebase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: await user.getIdToken() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not create your FA-MINNA Express session.');
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        localStorage.setItem('faminaAuthProvider', 'firebase');
        window.location.assign('profile.html');
    } catch (error) {
        throw authError('server');
    } finally {
        // FA-MINNA Express uses the server-issued session; leave no separate Firebase session behind.
        await signOut(auth);
    }
}

document.getElementById('google-continue').addEventListener('click', () => run(async () => {
    await finish((await signInWithPopup(auth, new GoogleAuthProvider())).user);
}));
document.getElementById('phone-continue').addEventListener('click', () => {
    phoneForm.hidden = !phoneForm.hidden;
    if (!phoneForm.hidden) document.getElementById('auth-phone').focus();
});

async function sendCode() {
    if (Date.now() < resendAt) throw authError('wait');
    const phone = document.getElementById('auth-phone').value.trim().replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw authError('phone');
    try {
        if (!verifier) verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
        confirmation = await signInWithPhoneNumber(auth, phone, verifier);
        resendAt = Date.now() + 60000;
        codeForm.hidden = false;
        showStatus('sent');
        document.getElementById('auth-code').focus();
    } finally {
        if (verifier) { verifier.clear(); verifier = null; }
    }
}
phoneForm.addEventListener('submit', event => { event.preventDefault(); run(sendCode); });
resend.addEventListener('click', () => run(sendCode));
document.getElementById('auth-phone').addEventListener('input', () => {
    confirmation = null;
    codeForm.hidden = true;
});
codeForm.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
        if (!confirmation) throw authError('first');
        await finish((await confirmation.confirm(document.getElementById('auth-code').value.trim())).user);
    });
});
