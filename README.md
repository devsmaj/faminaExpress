# FA-MINNA Express - Food Delivery Website

A multi-page food delivery web app with a static frontend and an Express API backend.

## Features
- Customer flow: browse restaurants/menu, add to cart, checkout, view orders.
- Auth flow: register/login for customer and restaurant owner.
- Restaurant owner dashboard page.
- Delivery tracking page.
- Push notification support scaffolding.
- Service worker caching (`sw.js`).
- Multi-language resources (`assets/locales/en.json`).

## Tech Stack
- Frontend: HTML, CSS, JavaScript (vanilla)
- Backend: Node.js, Express
- Key backend packages: `cors`, `jsonwebtoken`, `bcryptjs`, `stripe`, `web-push`

## Project Structure
```text
food-delivery/
+-- index.html
+-- menu.html
+-- restaurant.html
+-- cart.html
+-- checkout.html
+-- orders.html
+-- profile.html
+-- login.html
+-- register.html
+-- restaurant-owner-dashboard.html
+-- delivery-tracking.html
+-- about.html
+-- contact.html
+-- faq.html
+-- privacy.html
+-- terms.html
+-- 404.html
+-- sw.js
+-- assets/
¦   +-- css/
¦   +-- js/
¦   +-- images/
¦   +-- locales/
+-- components/
¦   +-- header.html
¦   +-- footer.html
+-- backend/
    +-- server.js
    +-- package.json
    +-- routes/
```

## Getting Started

### 1) Frontend only (quick start)
You can open `index.html` directly, but a local server is recommended for component loading and service-worker behavior.

Example:
```bash
# from repo root
npx serve .
```
Then open `http://localhost:3000` (or the port shown in terminal).

### 2) Backend API
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3001` by default.

## Environment Variables (Backend)
Create `backend/.env` (or set env vars in your shell):

```env
PORT=3001
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Notes:
- If `STRIPE_SECRET_KEY` is not set, the code falls back to a placeholder test key.
- Push notifications route currently uses placeholder VAPID keys in code and should be replaced for real usage.

## API Base URL
- Expected API base: `http://localhost:3001/api`
- Frontend includes a local shim in `assets/js/frontend-api.js` to emulate backend behavior when needed.

## NPM Scripts
Inside `backend/package.json`:
- `npm start` - run API server
- `npm run dev` - run with `nodemon`

## Important Notes
- This project contains demo/in-memory data paths in several backend routes.
- `backend/node_modules` is present in the repository; in normal workflows this directory is usually gitignored.

## Recommended Next Improvements
- Add persistent database storage for users/orders/cart.
- Replace hardcoded secrets and VAPID placeholders with environment-based config.
- Add automated tests for API routes and frontend flows.
- Add a root `package.json` for unified scripts (frontend + backend).

## License
Add a `LICENSE` file if you want to publish with an explicit license.
