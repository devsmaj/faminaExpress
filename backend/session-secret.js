const { randomBytes } = require('node:crypto');
// Configure JWT_SECRET in production for sessions that survive server restarts.
module.exports = process.env.JWT_SECRET || randomBytes(32).toString('hex');
