import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

const app = initializeApp({
    apiKey: 'AIzaSyDiY_tLqtapjywiIf_CP34eZviEiNE7giI',
    authDomain: 'project-7ad92958-9f96-47a3-8f5.firebaseapp.com',
    projectId: 'project-7ad92958-9f96-47a3-8f5',
    storageBucket: 'project-7ad92958-9f96-47a3-8f5.firebasestorage.app',
    messagingSenderId: '718439267329',
    appId: '1:718439267329:web:6cedd714909e2d37b55400'
});
export const auth = getAuth(app);
