const sessionSecret = require('../session-secret');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// In-memory data for demo (would be database in production)
let menuItems = [
    {
        id: 1,
        name: 'Margherita Pizza',
        category: 'Pizza',
        price: 12.99,
        image: 'assets/images/margherita pizza.jpg',
        description: 'Classic pizza with tomato sauce, mozzarella, and basil.',
        restaurantId: 1
    },
    {
        id: 2,
        name: 'Pepperoni Pizza',
        category: 'Pizza',
        price: 14.99,
        image: 'assets/images/Pepperoni Pizza.jpg',
        description: 'Pizza topped with pepperoni and extra cheese.',
        restaurantId: 1
    }
];

let orders = [
    {
        id: 1,
        customerName: 'John Doe',
        items: [
            { name: 'Margherita Pizza', quantity: 2, price: 12.99 },
            { name: 'Coca Cola', quantity: 1, price: 2.99 }
        ],
        total: 28.97,
        status: 'pending',
        createdAt: new Date().toISOString(),
        restaurantId: 1
    },
    {
        id: 2,
        customerName: 'Jane Smith',
        items: [
            { name: 'Pepperoni Pizza', quantity: 1, price: 14.99 }
        ],
        total: 14.99,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        restaurantId: 1
    }
];

// Middleware to verify restaurant owner token
function verifyRestaurantOwner(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, sessionSecret);
        if (decoded.role !== 'restaurant_owner') {
            return res.status(403).json({ message: 'Access denied' });
        }
        req.ownerId = decoded.id;
        req.restaurantId = decoded.restaurantId || 1; // Default for demo
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
}

// Get dashboard stats
router.get('/dashboard', verifyRestaurantOwner, (req, res) => {
    const restaurantId = req.restaurantId;

    const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);
    const today = new Date().toDateString();
    const todayOrders = restaurantOrders.filter(order =>
        new Date(order.createdAt).toDateString() === today
    );

    const totalRevenue = restaurantOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + order.total, 0);

    const pendingOrders = restaurantOrders.filter(order => order.status === 'pending').length;

    res.json({
        stats: {
            totalOrders: restaurantOrders.length,
            todayOrders: todayOrders.length,
            totalRevenue,
            pendingOrders
        }
    });
});

// Get menu items for restaurant
router.get('/menu', verifyRestaurantOwner, (req, res) => {
    const restaurantId = req.restaurantId;
    const restaurantMenu = menuItems.filter(item => item.restaurantId === restaurantId);
    res.json(restaurantMenu);
});

// Add new menu item
router.post('/menu', verifyRestaurantOwner, (req, res) => {
    const restaurantId = req.restaurantId;
    const { name, category, price, description, image } = req.body;

    const newItem = {
        id: menuItems.length + 1,
        name,
        category,
        price: parseFloat(price),
        description,
        image: image || 'assets/images/default-food.jpg',
        restaurantId
    };

    menuItems.push(newItem);
    res.status(201).json(newItem);
});

// Delete menu item
router.delete('/menu/:id', verifyRestaurantOwner, (req, res) => {
    const itemId = parseInt(req.params.id);
    const restaurantId = req.restaurantId;

    const itemIndex = menuItems.findIndex(item =>
        item.id === itemId && item.restaurantId === restaurantId
    );

    if (itemIndex === -1) {
        return res.status(404).json({ message: 'Menu item not found' });
    }

    menuItems.splice(itemIndex, 1);
    res.json({ message: 'Menu item deleted successfully' });
});

// Get orders for restaurant
router.get('/orders', verifyRestaurantOwner, (req, res) => {
    const restaurantId = req.restaurantId;
    const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);
    res.json(restaurantOrders);
});

// Update order status
router.put('/orders/:id/status', verifyRestaurantOwner, (req, res) => {
    const orderId = parseInt(req.params.id);
    const restaurantId = req.restaurantId;
    const { status } = req.body;

    const order = orders.find(order =>
        order.id === orderId && order.restaurantId === restaurantId
    );

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    res.json(order);
});

// Get analytics data
router.get('/analytics', verifyRestaurantOwner, (req, res) => {
    const restaurantId = req.restaurantId;
    const restaurantOrders = orders.filter(order => order.restaurantId === restaurantId);

    const completedOrders = restaurantOrders.filter(order => order.status === 'delivered');
    const avgOrderValue = completedOrders.length > 0
        ? completedOrders.reduce((sum, order) => sum + order.total, 0) / completedOrders.length
        : 0;

    const weeklyOrders = restaurantOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
    }).length;

    const weeklyRevenue = restaurantOrders
        .filter(order => {
            const orderDate = new Date(order.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDate >= weekAgo && order.status === 'delivered';
        })
        .reduce((sum, order) => sum + order.total, 0);

    // Calculate popular items
    const itemCounts = {};
    restaurantOrders.forEach(order => {
        order.items.forEach(item => {
            itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
        });
    });

    const popularItems = Object.entries(itemCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    res.json({
        avgOrderValue,
        weeklyOrders,
        weeklyRevenue,
        satisfaction: 4.5, // Mock data
        popularItems
    });
});

// Update restaurant settings
router.put('/settings', verifyRestaurantOwner, (req, res) => {
    const ownerId = req.ownerId;
    const { name, cuisine, description, deliveryTime } = req.body;

    // In a real app, this would update the database
    // For demo, we'll just return the updated data
    const updatedRestaurant = {
        id: 1, // Would be dynamic in real app
        name,
        cuisine,
        description,
        deliveryTime,
        rating: 4.5,
        image: 'assets/images/default-restaurant.jpg'
    };

    res.json(updatedRestaurant);
});

module.exports = router;
