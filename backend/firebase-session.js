function createFirebaseHandler({ verifyIdToken, sign, secret }) {
  return async (req, res) => {
    if (typeof req.body?.idToken !== 'string' || !req.body.idToken || req.body.idToken.length > 10000) {
      return res.status(400).json({ message: 'A Firebase ID token is required.' });
    }
    try {
      const identity = await verifyIdToken(req.body.idToken);
      const provider = identity.firebase?.sign_in_provider;
      if (!identity.uid || !['google.com', 'phone'].includes(provider) ||
          (provider === 'google.com' && (!identity.email || !identity.email_verified)) ||
          (provider === 'phone' && !identity.phone_number)) {
        return res.status(401).json({ message: 'A verified Google or phone identity is required.' });
      }
      const user = {
        id: `firebase:${identity.uid}`,
        name: identity.name || identity.phone_number || 'Customer',
        email: identity.email || null,
        phone: identity.phone_number || null,
        role: 'customer'
      };
      const token = sign({ id: user.id, role: user.role, firebaseUser: user }, secret, { expiresIn: '7d' });
      return res.json({ token, user });
    } catch (_) {
      return res.status(401).json({ message: 'Firebase verification failed. Please sign in again.' });
    }
  };
}
module.exports = { createFirebaseHandler };
