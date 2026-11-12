// Frontend-only API shim for localhost backend endpoints.
(function () {
    if (window.__FRONTEND_API_SHIM__) return;
    window.__FRONTEND_API_SHIM__ = true;

    const API_BASE = 'http://localhost:3001/api';
    const USERS_KEY = 'fd_users';
    const SESSIONS_KEY = 'fd_sessions';
    const ORDERS_KEY = 'fd_orders';
    const OWNER_MENU_KEY = 'fd_owner_menu_items';
    const OWNER_HIDDEN_KEY = 'fd_owner_hidden_menu_ids';
    const CART_PREFIX = 'fd_cart_';
    const DEFAULT_PASSWORD = '123456';
    const originalFetch = window.fetch.bind(window);

    const nowIso = () => new Date().toISOString();
    const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const readJson = (k, fallback) => {
        try {
            const raw = localStorage.getItem(k);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    };
    const writeJson = (k, val) => localStorage.setItem(k, JSON.stringify(val));
    const jsonResponse = (data, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' }
        }));

    function getBody(init) {
        if (!init || !init.body) return {};
        if (typeof init.body === 'string') {
            try {
                return JSON.parse(init.body);
            } catch (_) {
                return {};
            }
        }
        return init.body || {};
    }

    function getHeader(init, name) {
        if (!init || !init.headers) return '';
        const lower = name.toLowerCase();
        if (init.headers instanceof Headers) return init.headers.get(name) || '';
        const pairs = Object.entries(init.headers);
        const found = pairs.find(([k]) => String(k).toLowerCase() === lower);
        return found ? String(found[1]) : '';
    }

    function getUsers() {
        const users = readJson(USERS_KEY, null);
        if (Array.isArray(users) && users.length > 0) return users;

        const baseRestaurants =
            (typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : []) ||
            (Array.isArray(window.restaurants) ? window.restaurants : []);
        const ownerRestaurant = baseRestaurants[0] || {
            id: 1,
            name: 'Italian Delight',
            cuisine: 'Italian',
            description: 'Authentic Italian cuisine with fresh ingredients.',
            deliveryTime: '25-30 min',
            image: 'assets/images/Italian Delight.jpeg',
            rating: 4.5
        };
        const seeded = [
            {
                id: 1,
                name: 'Demo Customer',
                email: 'customer@demo.com',
                password: DEFAULT_PASSWORD,
                role: 'customer'
            },
            {
                id: 2,
                name: 'Demo Owner',
                email: 'owner@demo.com',
                password: DEFAULT_PASSWORD,
                role: 'restaurant_owner',
                restaurant: ownerRestaurant
            }
        ];
        writeJson(USERS_KEY, seeded);
        return seeded;
    }

    function getSessions() {
        return readJson(SESSIONS_KEY, {});
    }

    function setSessions(sessions) {
        writeJson(SESSIONS_KEY, sessions);
    }

    function makeToken(user) {
        const token = `frontend-token-${user.id}-${Date.now()}`;
        const sessions = getSessions();
        sessions[token] = user.id;
        setSessions(sessions);
        return token;
    }

    function userFromAuth(init) {
        const auth = getHeader(init, 'Authorization');
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        const sessions = getSessions();
        const userId = sessions[token];
        if (!userId) return null;
        return getUsers().find(u => u.id === userId) || null;
    }

    function getMenuAll() {
        const base =
            (typeof menuItems !== 'undefined' && Array.isArray(menuItems) ? menuItems : []) ||
            (Array.isArray(window.menuItems) ? window.menuItems : []);
        const ownerMenu = readJson(OWNER_MENU_KEY, []);
        const hidden = new Set(readJson(OWNER_HIDDEN_KEY, []));
        return [...base, ...ownerMenu].filter(item => !hidden.has(item.id));
    }

    function getRestaurantsAll() {
        const base =
            (typeof restaurants !== 'undefined' && Array.isArray(restaurants) ? restaurants : []) ||
            (Array.isArray(window.restaurants) ? window.restaurants : []);
        const owners = getUsers().filter(u => u.role === 'restaurant_owner' && u.restaurant);
        const ownerRestaurants = owners.map(o => o.restaurant);
        const map = new Map();
        [...base, ...ownerRestaurants].forEach(r => {
            if (!r || typeof r.id === 'undefined') return;
            if (!map.has(r.id)) {
                map.set(r.id, r);
                return;
            }
            const existing = map.get(r.id);
            map.set(r.id, {
                ...existing,
                ...r,
                image: r.image || existing.image || 'assets/images/Italian Delight.jpeg',
                rating: (typeof r.rating !== 'undefined' ? r.rating : existing.rating)
            });
        });
        return Array.from(map.values());
    }

    function cartKey(user) {
        return `${CART_PREFIX}${user ? user.id : 'guest'}`;
    }

    function getCartRaw(user) {
        return readJson(cartKey(user), []);
    }

    function setCartRaw(user, cart) {
        writeJson(cartKey(user), cart);
    }

    function hydrateCartItems(raw) {
        const menu = getMenuAll();
        return raw
            .map(row => {
                const item = menu.find(m => m.id === row.itemId);
                if (!item) return null;
                return {
                    id: item.id,
                    itemId: item.id,
                    name: item.name,
                    image: item.image,
                    price: toNum(item.price),
                    quantity: toNum(row.quantity, 1),
                    restaurantId: item.restaurantId
                };
            })
            .filter(Boolean);
    }

    function getOrders() {
        return readJson(ORDERS_KEY, []);
    }

    function setOrders(orders) {
        writeJson(ORDERS_KEY, orders);
    }

    function nextId(items) {
        return (items.reduce((m, it) => Math.max(m, toNum(it.id)), 0) || 0) + 1;
    }

    function trackingForOrder(order) {
        const statusEta = {
            pending: 35,
            confirmed: 30,
            preparing: 24,
            ready: 18,
            picked_up: 12,
            on_the_way: 8,
            delivered: 0
        };
        const mins = statusEta[order.status] ?? 20;
        const eta = new Date(Date.now() + mins * 60000).toISOString();
        return {
            orderId: order.id,
            status: order.status,
            eta,
            driver: {
                name: 'Alex Driver',
                phone: '+1-555-0142',
                vehicle: 'Honda Civic - Gray'
            },
            driverLocation: { lat: 40.7589, lng: -73.9851 },
            customerLocation: { lat: 40.7484, lng: -73.9857 }
        };
    }

    async function handleApi(path, method, init) {
        const body = getBody(init);
        const cleanPath = path.replace(/^\/+/, '');
        const user = userFromAuth(init);
        const users = getUsers();

        if (cleanPath === 'auth/login' && method === 'POST') {
            const email = String(body.email || '').toLowerCase();
            const password = String(body.password || '');
            const found = users.find(u => u.email.toLowerCase() === email && u.password === password);
            if (!found) return jsonResponse({ message: 'Invalid email or password' }, 401);
            const token = makeToken(found);
            const safeUser = { ...found };
            delete safeUser.password;
            return jsonResponse({ token, user: safeUser }, 200);
        }

        if (cleanPath === 'auth/register' && method === 'POST') {
            const email = String(body.email || '').toLowerCase();
            if (users.some(u => u.email.toLowerCase() === email)) {
                return jsonResponse({ message: 'Email already exists' }, 400);
            }
            const newUser = {
                id: nextId(users),
                name: body.name || 'Customer',
                email,
                password: body.password || DEFAULT_PASSWORD,
                role: 'customer'
            };
            users.push(newUser);
            writeJson(USERS_KEY, users);
            return jsonResponse({ message: 'Customer created' }, 201);
        }

        if (cleanPath === 'auth/register-owner' && method === 'POST') {
            const email = String(body.email || '').toLowerCase();
            if (users.some(u => u.email.toLowerCase() === email)) {
                return jsonResponse({ message: 'Email already exists' }, 400);
            }
            const restaurants = getRestaurantsAll();
            const restaurant = {
                id: nextId(restaurants),
                name: body.restaurantName || 'New Restaurant',
                cuisine: body.cuisine || 'Mixed',
                description: body.description || '',
                deliveryTime: '25-35 min',
                image: 'assets/images/Italian Delight.jpeg',
                rating: 4.3
            };
            const newOwner = {
                id: nextId(users),
                name: body.name || 'Restaurant Owner',
                email,
                password: body.password || DEFAULT_PASSWORD,
                role: 'restaurant_owner',
                restaurant
            };
            users.push(newOwner);
            writeJson(USERS_KEY, users);
            return jsonResponse({ message: 'Restaurant owner created' }, 201);
        }

        if (cleanPath === 'menu' && method === 'GET') {
            return jsonResponse(getMenuAll());
        }

        if (cleanPath === 'restaurants' && method === 'GET') {
            return jsonResponse(getRestaurantsAll());
        }

        if (cleanPath === 'cart' && method === 'GET') {
            const raw = getCartRaw(user);
            return jsonResponse(hydrateCartItems(raw));
        }

        if (cleanPath === 'cart' && method === 'POST') {
            const itemId = toNum(body.itemId);
            const qty = Math.max(1, toNum(body.quantity, 1));
            const raw = getCartRaw(user);
            const idx = raw.findIndex(i => i.itemId === itemId);
            if (idx >= 0) raw[idx].quantity += qty;
            else raw.push({ itemId, quantity: qty });
            setCartRaw(user, raw);
            return jsonResponse({ success: true }, 201);
        }

        if (cleanPath.startsWith('cart/') && method === 'DELETE') {
            const itemId = toNum(cleanPath.split('/')[1]);
            const raw = getCartRaw(user).filter(i => i.itemId !== itemId);
            setCartRaw(user, raw);
            return jsonResponse({ success: true });
        }

        if (cleanPath.startsWith('cart/') && method === 'PUT') {
            const itemId = toNum(cleanPath.split('/')[1]);
            const qty = Math.max(0, toNum(body.quantity, 1));
            const raw = getCartRaw(user);
            const idx = raw.findIndex(i => i.itemId === itemId);
            if (idx >= 0) {
                if (qty === 0) raw.splice(idx, 1);
                else raw[idx].quantity = qty;
            }
            setCartRaw(user, raw);
            return jsonResponse({ success: true });
        }

        if (cleanPath === 'orders' && method === 'POST') {
            if (!user) return jsonResponse({ message: 'Unauthorized' }, 401);
            const orders = getOrders();
            const order = {
                id: nextId(orders),
                userId: user.id,
                customerName: user.name,
                items: Array.isArray(body.items) ? body.items : [],
                total: toNum(body.total),
                status: 'pending',
                paymentMethod: body.paymentMethod || 'card',
                createdAt: nowIso()
            };
            orders.push(order);
            setOrders(orders);
            setCartRaw(user, []);
            return jsonResponse(order, 201);
        }

        if (cleanPath === 'orders' && method === 'GET') {
            if (!user) return jsonResponse([], 200);
            const orders = getOrders();
            if (user.role === 'restaurant_owner' && user.restaurant) {
                const rid = user.restaurant.id;
                return jsonResponse(orders.filter(o => o.items.some(i => i.restaurantId === rid)));
            }
            return jsonResponse(orders.filter(o => o.userId === user.id));
        }

        if (/^orders\/\d+$/.test(cleanPath) && method === 'GET') {
            const id = toNum(cleanPath.split('/')[1]);
            const order = getOrders().find(o => o.id === id);
            if (!order) return jsonResponse({ message: 'Not found' }, 404);
            return jsonResponse(order);
        }

        if (/^orders\/\d+\/tracking$/.test(cleanPath) && method === 'GET') {
            const id = toNum(cleanPath.split('/')[1]);
            const order = getOrders().find(o => o.id === id);
            if (!order) return jsonResponse({ message: 'Not found' }, 404);
            return jsonResponse(trackingForOrder(order));
        }

        if (cleanPath === 'restaurant-owner/dashboard' && method === 'GET') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const rid = user.restaurant.id;
            const orders = getOrders().filter(o => o.items.some(i => i.restaurantId === rid));
            const today = new Date().toDateString();
            const stats = {
                totalOrders: orders.length,
                todayOrders: orders.filter(o => new Date(o.createdAt).toDateString() === today).length,
                totalRevenue: orders.reduce((sum, o) => sum + toNum(o.total), 0),
                pendingOrders: orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).length
            };
            return jsonResponse({ stats });
        }

        if (cleanPath === 'restaurant-owner/menu' && method === 'GET') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const rid = user.restaurant.id;
            return jsonResponse(getMenuAll().filter(m => m.restaurantId === rid));
        }

        if (cleanPath === 'restaurant-owner/menu' && method === 'POST') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const ownerMenu = readJson(OWNER_MENU_KEY, []);
            const item = {
                id: nextId([...getMenuAll(), ...ownerMenu, { id: 10000 }]),
                name: body.name || 'New Item',
                category: body.category || 'Other',
                price: toNum(body.price, 0),
                description: body.description || '',
                image: body.image || 'assets/images/pazza.jpg',
                restaurantId: user.restaurant.id
            };
            ownerMenu.push(item);
            writeJson(OWNER_MENU_KEY, ownerMenu);
            return jsonResponse(item, 201);
        }

        if (/^restaurant-owner\/menu\/\d+$/.test(cleanPath) && method === 'DELETE') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const id = toNum(cleanPath.split('/')[2]);
            const ownerMenu = readJson(OWNER_MENU_KEY, []).filter(m => m.id !== id);
            writeJson(OWNER_MENU_KEY, ownerMenu);
            const hidden = readJson(OWNER_HIDDEN_KEY, []);
            if (!hidden.includes(id)) hidden.push(id);
            writeJson(OWNER_HIDDEN_KEY, hidden);
            return jsonResponse({ success: true });
        }

        if (cleanPath === 'restaurant-owner/orders' && method === 'GET') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const rid = user.restaurant.id;
            return jsonResponse(getOrders().filter(o => o.items.some(i => i.restaurantId === rid)));
        }

        if (/^restaurant-owner\/orders\/\d+\/status$/.test(cleanPath) && method === 'PUT') {
            if (!user || user.role !== 'restaurant_owner') {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const id = toNum(cleanPath.split('/')[2]);
            const orders = getOrders();
            const target = orders.find(o => o.id === id);
            if (!target) return jsonResponse({ message: 'Not found' }, 404);
            target.status = body.status || target.status;
            setOrders(orders);
            return jsonResponse(target);
        }

        if (cleanPath === 'restaurant-owner/analytics' && method === 'GET') {
            if (!user || user.role !== 'restaurant_owner' || !user.restaurant) {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const rid = user.restaurant.id;
            const orders = getOrders().filter(o => o.items.some(i => i.restaurantId === rid));
            const totalRevenue = orders.reduce((sum, o) => sum + toNum(o.total), 0);
            const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;
            const popularMap = new Map();
            orders.forEach(o => o.items.forEach(i => {
                if (i.restaurantId !== rid) return;
                popularMap.set(i.name, (popularMap.get(i.name) || 0) + toNum(i.quantity, 1));
            }));
            const popularItems = Array.from(popularMap.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            return jsonResponse({
                avgOrderValue,
                weeklyOrders: orders.length,
                weeklyRevenue: totalRevenue,
                satisfaction: 4.7,
                popularItems
            });
        }

        if (cleanPath === 'restaurant-owner/settings' && method === 'PUT') {
            if (!user || user.role !== 'restaurant_owner') {
                return jsonResponse({ message: 'Unauthorized' }, 401);
            }
            const updated = getUsers().map(u => {
                if (u.id !== user.id) return u;
                return {
                    ...u,
                    restaurant: {
                        ...u.restaurant,
                        name: body.name || u.restaurant.name,
                        cuisine: body.cuisine || u.restaurant.cuisine,
                        description: body.description ?? u.restaurant.description,
                        deliveryTime: body.deliveryTime || u.restaurant.deliveryTime
                    }
                };
            });
            writeJson(USERS_KEY, updated);
            const newUser = updated.find(u => u.id === user.id);
            return jsonResponse(newUser.restaurant);
        }

        if (cleanPath === 'payments/create-payment-intent' && method === 'POST') {
            return jsonResponse({
                clientSecret: `demo-client-secret-${Date.now()}`,
                amount: toNum(body.amount)
            });
        }

        if (cleanPath === 'notifications/public-key' && method === 'GET') {
            return jsonResponse({ publicKey: 'demo-public-key' });
        }

        if (cleanPath === 'notifications/subscribe' && method === 'POST') {
            return jsonResponse({ success: true });
        }

        return null;
    }

    window.fetch = async function frontendFetch(input, init = {}) {
        const method = String((init && init.method) || 'GET').toUpperCase();
        const rawUrl = typeof input === 'string' ? input : input.url;
        const parsed = new URL(rawUrl, window.location.origin);
        const isApi = parsed.href.startsWith(API_BASE) || parsed.pathname.startsWith('/api/');

        if (!isApi) {
            return originalFetch(input, init);
        }

        // Firebase sessions must reach the real API and must never use demo data.
        if (parsed.pathname === '/api/auth/firebase' || localStorage.getItem('faminaAuthProvider') === 'firebase') {
            const base = window.FAMINA_API_BASE || (['localhost', '127.0.0.1'].includes(location.hostname) ? API_BASE : location.origin + '/api');
            return originalFetch(base.replace(/\/$/, '') + parsed.pathname.slice(4) + parsed.search, init);
        }

        const path = parsed.pathname.replace(/^\/api\//, '');
        const handled = await handleApi(path, method, init);
        if (handled) return handled;
        return jsonResponse({ message: 'Not implemented in frontend mode' }, 404);
    };
})();
