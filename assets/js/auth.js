// Auth functionality for login and registration
(function () {

const AUTH_API_BASE = window.FAMINA_API_BASE || 'http://localhost:3001/api';

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const customerForm = document.getElementById('customer-register-form');
    if (customerForm) {
        customerForm.addEventListener('submit', (e) => handleRegister(e, 'customer'));
    }

    // Handle account type switching on register page
    const customerBtn = document.getElementById('customer-btn');
    const restaurantBtn = document.getElementById('restaurant-btn');

    if (customerBtn && restaurantBtn) {
        customerBtn.addEventListener('click', () => switchAccountType('customer'));
        restaurantBtn.addEventListener('click', () => switchAccountType('restaurant'));
    }

    const restaurantForm = document.getElementById('restaurant-register-form');
    if (restaurantForm) {
        restaurantForm.addEventListener('submit', (e) => handleRegister(e, 'restaurant'));
    }
});

// Switch between account types
function switchAccountType(type) {
    const customerBtn = document.getElementById('customer-btn');
    const restaurantBtn = document.getElementById('restaurant-btn');
    const customerForm = document.getElementById('customer-register-form');
    const restaurantForm = document.getElementById('restaurant-register-form');

    if (type === 'customer') {
        customerBtn.classList.add('active');
        restaurantBtn.classList.remove('active');
        customerForm.classList.add('active-form');
        restaurantForm.classList.remove('active-form');
    } else {
        restaurantBtn.classList.add('active');
        customerBtn.classList.remove('active');
        restaurantForm.classList.add('active-form');
        customerForm.classList.remove('active-form');
    }
}

// Login function
async function handleLogin(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${AUTH_API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.removeItem('faminaAuthProvider');
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            showNotification('Login successful!');

            // Redirect based on user role
            if (data.user.role === 'restaurant_owner') {
                window.location.href = 'restaurant-owner-dashboard.html';
            } else {
                window.location.href = 'profile.html';
            }
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Network error', 'error');
    }
}

// Register function
async function handleRegister(e, accountType) {
    e.preventDefault();

    const formData = new FormData(e.target);
    let registerData;

    if (accountType === 'customer') {
        registerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password')
        };

        // Check password confirmation
        const confirmPassword = formData.get('confirm-password');
        if (registerData.password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        // Use customer registration endpoint
        const response = await fetch(`${AUTH_API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Customer account created successfully! Please login.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }

    } else if (accountType === 'restaurant') {
        registerData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            restaurantName: formData.get('restaurantName'),
            cuisine: formData.get('cuisine'),
            description: formData.get('description')
        };

        // Check password confirmation
        const confirmPassword = formData.get('confirm-password');
        if (registerData.password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }

        // Use restaurant owner registration endpoint
        const response = await fetch(`${AUTH_API_BASE}/auth/register-owner`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Restaurant account created successfully! Please login.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    }
}

})();
