const sessionSecret = require('../session-secret');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const carts = {}; // In-memory carts keyed by user id

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

// Get cart
router.get('/', authenticate, (req, res) => {
  const cart = carts[req.userId] || [];
  res.json(cart);
});

// Add to cart
router.post('/', authenticate, (req, res) => {
  const { itemId, quantity } = req.body;
  if (!carts[req.userId]) carts[req.userId] = [];
  const cart = carts[req.userId];
  const existingItem = cart.find(item => item.id === itemId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ id: itemId, quantity });
  }
  res.json(cart);
});

// Update cart item
router.put('/:itemId', authenticate, (req, res) => {
  const { quantity } = req.body;
  const cart = carts[req.userId] || [];
  const item = cart.find(item => item.id === parseInt(req.params.itemId));
  if (item) {
    item.quantity = quantity;
    res.json(cart);
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

// Remove from cart
router.delete('/:itemId', authenticate, (req, res) => {
  const cart = carts[req.userId] || [];
  carts[req.userId] = cart.filter(item => item.id !== parseInt(req.params.itemId));
  res.json(carts[req.userId]);
});

module.exports = router;
