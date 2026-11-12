const sessionSecret = require('../session-secret');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const webpush = require('web-push');

// VAPID keys (should match notifications.js)
const vapidKeys = {
  publicKey: 'YOUR_VAPID_PUBLIC_KEY',
  privateKey: 'YOUR_VAPID_PRIVATE_KEY'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory storage for subscriptions (use database in production)
let subscriptions = [];

const orders = [];

// Update order with payment status
router.put('/:id/payment', (req, res) => {
  const { id } = req.params;
  const { paymentIntentId, status } = req.body;

  const order = orders.find(o => o.id == id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.paymentIntentId = paymentIntentId;
  order.paymentStatus = status;
  order.updatedAt = new Date();

  res.json(order);
});

// Middleware to get user from token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, sessionSecret);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get orders
router.get('/', authenticate, (req, res) => {
  const userOrders = orders.filter(order => order.userId === req.userId);
  res.json(userOrders);
});

// Create order
router.post('/', authenticate, (req, res) => {
  const { items, total, paymentMethod } = req.body;
  const order = {
    id: orders.length + 1,
    userId: req.userId,
    items,
    total,
    paymentMethod,
    status: 'pending',
    createdAt: new Date()
  };
  orders.push(order);

  // Send push notification for new order
  sendPushNotification(order.userId, 'Order Placed', `Your order #${order.id} has been placed successfully!`);

  res.json(order);
});

// Get order by id
router.get('/:id', authenticate, (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id) && o.userId === req.userId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

module.exports = router;
