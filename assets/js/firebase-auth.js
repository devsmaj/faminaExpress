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

function message(error) {
    const messages = {
        'auth/popup-closed-by-user': 'Google sign-in was cancelled. Please try again.',
        'auth/popup-blocked': 'Allow popups for this website, then try again.',
        'auth/unauthorized-domain': 'This website domain must be authorized in Firebase Authentication settings.',
        'auth/operation-not-allowed': 'This sign-in method must be enabled in Firebase Authentication.',
        'auth/invalid-phone-number': 'Enter a valid phone number including the country code.',
        'auth/invalid-verification-code': 'The SMS code is incorrect. Please try again.',
        'auth/code-expired': 'This SMS code has expired. Request a new code.',
        'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
        'auth/quota-exceeded': 'SMS is temporarily unavailable. Please try Google or email.',
        'auth/network-request-failed': 'Check your internet connection and try again.'
    };
    return messages[error.code] || error.message || 'Sign-in failed. Please try again.';
}

async function run(action) {
    if (busy) return;
    busy = true;
    status.textContent = '';
    panel.querySelectorAll('button').forEach(button => button.disabled = true);
    try { await action(); }
    catch (error) { status.textContent = message(error); }
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
        throw new Error('Could not connect to the FA-MINNA Express sign-in server. Please try again.');
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
    if (Date.now() < resendAt) throw new Error('Please wait 60 seconds before requesting another code.');
    const phone = document.getElementById('auth-phone').value.trim().replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Include your country code, for example +971501234567.');
    try {
        if (!verifier) verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'normal' });
        confirmation = await signInWithPhoneNumber(auth, phone, verifier);
        resendAt = Date.now() + 60000;
        codeForm.hidden = false;
        status.textContent = 'SMS code sent. Enter the six-digit code below.';
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
        if (!confirmation) throw new Error('Request an SMS code first.');
        await finish((await confirmation.confirm(document.getElementById('auth-code').value.trim())).user);
    });
});
