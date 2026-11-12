// Profile page behavior: load, edit, and save logged-in user info.
(function () {
    function getCurrentUser() {
        try {
            return window.FaminaSession.user();
        } catch (_) {
            return null;
        }
    }

    function getUsersStore() {
        try {
            return JSON.parse(localStorage.getItem('fd_users') || '[]');
        } catch (_) {
            return [];
        }
    }

    function setUsersStore(users) {
        localStorage.setItem('fd_users', JSON.stringify(users));
    }

    function validateEmailSafe(email) {
        if (typeof validateEmail === 'function') return validateEmail(email);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function notify(message, type) {
        if (typeof showNotification === 'function') {
            showNotification(message, type || 'info');
        } else {
            window.FaminaNotifications.show(message, typeof type === 'string' ? type : 'info');
        }
    }

    function profilePictureKey(user) {
        const idPart = user && (user.id || user.email || 'guest');
        return `profilePicture_${idPart}`;
    }

    window.addEventListener('famina-signed-out', function () {
        const form = document.getElementById('profile-form');
        if (!form) return;
        form.reset();
        form.querySelectorAll('input,button').forEach(input => input.disabled = true);
        window.FaminaSession.gate(form.parentElement, 'Please login to access your profile.');
    });
    document.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('profile-form');
        if (!form) return;

        const user = getCurrentUser();
        if (!user) {
            notify('Please login to access your profile.', 'error');
            window.FaminaSession.rememberPage();
            window.FaminaSession.gate(form.parentElement, 'Please login to access your profile.');
            form.querySelectorAll('input,button').forEach(input => input.disabled = true);
            return;
        }

        const nameInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');
        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const pictureInput = document.getElementById('profile-picture-input');
        const picture = document.getElementById('profile-picture');

        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';

        const storedPicture = localStorage.getItem(profilePictureKey(user));
        if (storedPicture && picture) {
            picture.src = storedPicture;
        }

        if (pictureInput && picture) {
            pictureInput.addEventListener('change', function (e) {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    notify('Please select an image file.', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (ev) {
                    const imageData = ev.target && ev.target.result ? String(ev.target.result) : '';
                    if (!imageData) return;
                    picture.src = imageData;
                    localStorage.setItem(profilePictureKey(user), imageData);
                    notify('Profile picture updated.');
                };
                reader.readAsDataURL(file);
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const nextName = (nameInput && nameInput.value || '').trim();
            const nextEmail = (emailInput && emailInput.value || '').trim().toLowerCase();
            const currentPassword = (currentPasswordInput && currentPasswordInput.value || '').trim();
            const newPassword = (newPasswordInput && newPasswordInput.value || '').trim();
            const confirmPassword = (confirmPasswordInput && confirmPasswordInput.value || '').trim();

            if (!nextName) {
                notify('Name is required.', 'error');
                return;
            }
            if (!validateEmailSafe(nextEmail)) {
                notify('Please enter a valid email address.', 'error');
                return;
            }
            if (newPassword && newPassword !== confirmPassword) {
                notify('New passwords do not match.', 'error');
                return;
            }

            const users = getUsersStore();
            const idx = users.findIndex(u => (user.id && u.id === user.id) || u.email === user.email);
            const existing = idx >= 0 ? users[idx] : null;

            if (newPassword && !currentPassword) {
                notify('Enter your current password to set a new password.', 'error');
                return;
            }
            if (newPassword && existing && existing.password !== currentPassword) {
                notify('Current password is incorrect.', 'error');
                return;
            }

            if (idx >= 0) {
                users[idx] = {
                    ...users[idx],
                    name: nextName,
                    email: nextEmail,
                    password: newPassword ? newPassword : users[idx].password
                };
                setUsersStore(users);
            }

            const nextUser = {
                ...user,
                name: nextName,
                email: nextEmail
            };
            localStorage.setItem('currentUser', JSON.stringify(nextUser));

            if (typeof window.updateAuthStatus === 'function') {
                window.updateAuthStatus();
            }

            if (currentPasswordInput) currentPasswordInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';

            notify('Profile updated successfully!');
        });
    });
})();
