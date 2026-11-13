const CACHE_NAME = 'fa-minna-express-platform-v3';
const urlsToCache = [
  '/assets/js/loading.js',
  '/assets/css/loading.css',
  '/assets/icons/loading.svg',
  '/',
  '/index.html',
  '/customer-home.html',
  '/assets/js/customer-home.js',
  '/menu.html',
  '/cart.html',
  '/checkout.html',
  '/login.html',
  '/register.html',
  '/about.html',
  '/contact.html',
  '/faq.html',
  '/privacy.html',
  '/terms.html',
  '/restaurant.html',
  '/orders.html',
  '/profile.html',
  '/404.html',
  '/assets/css/style.css',
  '/assets/css/responsive.css',
  '/assets/css/auth.css',
  '/assets/js/i18n.js',
  '/assets/js/notifications.js',
  '/assets/js/session.js',
  '/assets/css/notifications.css',
  '/assets/js/auth-scene.js',
  '/assets/locales/en.json',
  '/assets/locales/catalog.js',
  '/assets/locales/fr-TD.json',
  '/assets/locales/ar-TD.json',
  '/assets/js/data.js',
  '/assets/js/utils.js',
  '/assets/js/main.js',
  '/assets/js/cart.js',
  '/assets/js/config.js',
  '/assets/js/frontend-api.js',
  '/assets/js/platform.js',
  '/assets/js/navigation.js',
  '/assets/js/cart-state.js',
  '/assets/js/supabase-auth.js',
  '/assets/js/maps.js',
  '/assets/js/addresses.js',
  '/assets/js/profile.js',
  '/assets/js/admin-dashboard.js',
  '/assets/js/rider-dashboard.js',
  '/assets/js/restaurant-dashboard.js',
  '/assets/js/delivery-tracking.js',
  '/assets/css/platform.css',
  '/assets/vendor/supabase.js',
  '/assets/vendor/chart.js',
  '/assets/vendor/leaflet/leaflet.js',
  '/assets/vendor/leaflet/leaflet.css',
  '/admin-dashboard.html',
  '/rider-dashboard.html',
  '/restaurant-owner-dashboard.html',
  '/assets/icons/google.svg',
  '/assets/icons/phone.svg',
  '/assets/js/menu.js',
  '/assets/js/checkout.js',
  '/components/header.html',
  '/components/footer.html',
  // Images
  '/assets/images/pazza.jpg',
  '/assets/images/burger.jpg',
  '/assets/images/salad.jpg',
  '/assets/images/dessert.jpg',
  '/assets/images/beverage.jpg',
  '/assets/images/Italian Delight.jpeg',
  '/assets/images/Burger Junction.webp',
  '/assets/images/Asian Fusion.jpeg',
  '/assets/images/Healthy Eats.jpg',
  '/assets/images/margherita pizza.jpg',
  '/assets/images/Pepperoni Pizza.jpg',
  '/assets/images/Cheeseburger.jpg',
  '/assets/images/Chicken Burger.jpg',
  '/assets/images/Spaghetti Carbonara.jpg',
  '/assets/images/Caesar Salad.jpg',
  '/assets/images/Chocolate Cake.jpg',
  '/assets/images/Coca Cola.jpg',
  '/assets/images/Pad Thai.jpg',
  '/assets/images/Greek Salad.jpg'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache.map(path => new URL(path.replace(/^\//, ''), self.registration.scope).href));
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push event
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'You have a new notification from FA-MINNA Express!',
    icon: data.icon || '/assets/icons/icon-192x192.png',
    badge: data.badge || '/assets/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'FA-MINNA Express', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
