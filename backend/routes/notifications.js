const sessionSecret = require('../session-secret');
const express = require('express');
const webpush = require('web-push');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Push notifications are optional and must never prevent the API from starting.
const vapidKeys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
let pushEnabled = false;
if (vapidKeys.publicKey && vapidKeys.privateKey && process.env.VAPID_SUBJECT) {
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, vapidKeys.publicKey, vapidKeys.privateKey);
    pushEnabled = true;
  } catch (_) {
    console.warn('Push notifications disabled: invalid VAPID configuration.');
  }
}
router.use((req, res, next) => {
  if (!pushEnabled) return res.status(503).json({ message: 'Push notifications are not configured.' });
  next();
});

// In-memory storage for subscriptions (use database in production)
let subscriptions = [];

// Subscribe to push notifications
router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  if (!subscription) {
    return res.status(400).json({ error: 'Subscription data required' });
  }

  let userId = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, sessionSecret);
      userId = decoded.id;
    } catch (err) {
      // Continue without user association
    }
  }

  // Check if subscription already exists
  const existingIndex = subscriptions.findIndex(sub =>
    sub.endpoint === subscription.endpoint
  );

  if (existingIndex === -1) {
    subscriptions.push({ ...subscription, userId });
  } else {
    subscriptions[existingIndex] = { ...subscription, userId };
  }

  res.status(201).json({ message: 'Subscription added successfully' });
});

// Send push notification
router.post('/send', (req, res) => {
  const { title, body, icon, badge } = req.body;

  const payload = JSON.stringify({
    title: title || 'FA-MINNA Express',
    body: body || 'New notification from FA-MINNA Express!',
    icon: icon || '/assets/icons/icon-192x192.png',
    badge: badge || '/assets/icons/icon-192x192.png'
  });

  const promises = subscriptions.map(subscription =>
    webpush.sendNotification(subscription, payload)
      .catch(error => {
        console.error('Error sending notification:', error);
        // Remove invalid subscriptions
        subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
      })
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: 'Notifications sent successfully' }))
    .catch(error => {
      console.error('Error sending notifications:', error);
      res.status(500).json({ error: 'Failed to send notifications' });
    });
});

// Get VAPID public key
router.get('/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// Orders can call this even when optional push credentials are absent.
router.sendToUser = async (userId, title, body) => {
  if (!pushEnabled) return;
  const payload = JSON.stringify({ title, body });
  await Promise.all(subscriptions.filter(subscription => subscription.userId === userId).map(subscription =>
    webpush.sendNotification(subscription, payload).catch(error => {
      if ([404, 410].includes(error.statusCode)) {
        subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
      }
      console.warn('Optional push delivery failed:', error.statusCode || 'network error');
    })
  ));
};
module.exports = router;
