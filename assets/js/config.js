// Set this to your hosted Express API URL when frontend and backend use different domains.
window.FAMINA_API_BASE = window.FAMINA_API_BASE ||
    (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3001/api' : `${location.origin}/api`);
