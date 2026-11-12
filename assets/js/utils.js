// Utility functions for the food delivery website

// Format price to currency
function formatPrice(price) {
    return `$${price.toFixed(2)}`;
}

// Load HTML component into an element
function loadComponent(elementId, componentPath) {
    fetch(componentPath)
        .then(response => response.text())
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
            document.dispatchEvent(new CustomEvent('componentloaded'));
        })
        .catch(error => console.error('Error loading component:', error));
}

// Show notification (simple alert for now, can be enhanced)
function showNotification(message, type = 'info') {
    alert(message); // Replace with toast notification if needed
}

// Get URL parameter
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Debounce function for search/filtering
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number (basic US format)
function validatePhone(phone) {
    const re = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    return re.test(phone);
}

// Show loading indicator
function showLoading(button) {
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Loading...';
}

// Hide loading indicator
function hideLoading(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
}

// Capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatPrice,
        loadComponent,
        showNotification,
        getUrlParameter,
        debounce,
        generateId,
        validateEmail,
        validatePhone,
        showLoading,
        hideLoading,
        capitalize
    };
}
