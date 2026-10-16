# ShopCart — Redis + MongoDB + MonetDB Analytics

This project combines Redis for fast carts, MongoDB for persistent products/orders, MonetDB for sales analytics, and Neo4j for graph-based product recommendations.

## Responsibilities
- **Redis:** shopping carts with a 30-minute TTL.
- **MongoDB:** persistent products and orders; order history survives server restarts.
- **MonetDB:** analytical tables and SQL queries for total revenue, average order value, monthly sales, and top products.
- **Neo4j:** a product graph connects products in the same category with `RELATED_TO` relationships and recommends similar products on the storefront.

> MonetDB is an analytical database, not a payment gateway. This project does not process real payments.

## Requirements
- Node.js 18+
- Redis server
- MongoDB Community Server or MongoDB Atlas
- MonetDB server (optional until you want the analytics dashboard live)
- Neo4j Desktop or Aura (optional until you want graph recommendations live)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env`. Change credentials to match your local services. The default MongoDB and Redis URLs are for local development. Keep secrets out of Git.

```env
PORT=3000
REDIS_URL=redis://127.0.0.1:6379
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=online_shopping
# Example only; use your actual MonetDB username/password/database:
MONETDB_URL=mapi:monetdb://monetdb:YOUR_PASSWORD@127.0.0.1:50000/analytics
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD
```

Create the MonetDB database named `analytics` and ensure the server is listening on port `50000`. Exact setup commands vary by MonetDB installation/version; see https://www.monetdb.org/documentation/.

## 3. Start services

Start Redis and MongoDB, then start MonetDB if you want analytics enabled. In a terminal in this project folder:

```bash
npm start
```

Open http://localhost:3000.

The shop starts even if MonetDB or Neo4j is not configured. Without Neo4j, recommendations use a category-based fallback and the UI says so. MongoDB and Redis are required for checkout/cart features.

## 4. Try the analytics

1. Add products to the cart and place an order.
2. The order is saved to MongoDB.
3. If MonetDB is connected, the order and line items are copied to MonetDB analytics tables.
4. The Sales dashboard shows total orders, revenue, average order value, monthly revenue, and top products.
5. Use **Recommended for you** to view similar products. With Neo4j configured, recommendations come from graph relationships; otherwise the app shows a category-based fallback.

If you already have orders in MongoDB, call `POST http://localhost:3000/api/analytics/sync-existing` (e.g. from VS Code REST Client or Postman) to sync them into MonetDB after connecting it.

## API routes
- `GET /api/status` — connection status for Redis, MongoDB, MonetDB and Neo4j.
- `GET /api/recommendations/:productId` — related products from Neo4j, with a category fallback if Neo4j is not configured.
- `GET /api/analytics/summary` — analytical results from MonetDB.
- `POST /api/analytics/sync-existing` — synchronize historical MongoDB orders into MonetDB.
- `GET /api/orders/:customerId` — order history from MongoDB.

## Important implementation note
The demo product list is seeded into MongoDB on startup. Checkout writes the order to MongoDB first, then attempts to synchronize analytics rows to MonetDB. If MonetDB is down, the order remains saved in MongoDB and the app logs the sync issue. This is a learning/demo project; production use would need a retry queue/outbox for reliable synchronization, authentication/authorization for analytics routes, and robust transaction handling.

## ShopCart UI upgrade features
- 24 products across Electronics, Accessories, Audio, Wearables, Home, Fashion, Fitness, Beauty, Gaming, Lifestyle and Stationery.
- Product search, category filters, ratings, deal labels, wishlist/save-for-later, and listed price-drop indicators.
- Stock warnings on product cards and in the cart for demo items with five or fewer units. These inventory values are seeded demo data and are not a live warehouse feed.
- Animated cart reward meter: free delivery at ₹1,000; 10% off plus a free sample at ₹2,000. The same delivery/discount rules are applied when the order is placed.
- Customer name registration from the store and a separate Customer Hub page at `http://localhost:3000/customers.html`.
- Customer Hub displays registered customer count, distinct customers with orders, total orders, searchable customer directory, and a customer registration form. Profiles are persisted in MongoDB's `customers` collection.
- The site does not invent claims such as "2 other people have this in their cart". Low-stock notices use the seeded product stock field; price-drop notices use products with a listed `oldPrice`.

### New customer APIs
- `GET /api/customers` — list registered customers.
- `POST /api/customers` with JSON `{ "name": "Your Name" }` — register a named customer.
- `GET /api/customer-stats` — registered customers, distinct customers with orders, order count, and recent profiles.


## ShopCart Plus additions
- Expanded catalogue with 36 demo products, including separate Women, Men and Kids department filters, plus fitness, audio and lifestyle picks.
- Dedicated Neo4j recommendations page at `/recommendations.html`.
- Animated order-success modal with order ID, total, checkmark and confetti after successful checkout.
- Light/dark mode switch, shared between the storefront and graph recommendations page, with the choice remembered in the browser.
- MonetDB dashboard includes today's revenue and order count alongside monthly revenue and top products. Today's values are sourced from MonetDB when connected.
- Extra demo idea: wishlist sale indicators and cart reward thresholds remain available; use these as a base for future coupon codes or product bundles.

The Women/Men/Kids departments are demo merchandising filters over the seeded catalogue, not authenticated or age-restricted areas. Checkout remains a demo flow and does not process real payments.


## ShopCart Plus features (expanded build)

- Storefront language selector: English (India), English (UK), Malayalam, Hindi, Tamil and Telugu. The common shopping controls are translated; some product names and long descriptive text remain in English.
- Separate Project Dashboard at `http://localhost:3000/dashboard.html`, with service health, project totals, payment mix and recent orders.
- Checkout methods: Google Pay / UPI demo, card demo and cash on delivery. No real payment gateway is connected; no card information is collected and demo online payments are not charged.
- Coupon codes: `WELCOME50` (₹50 off ₹500+), `SAVE100` (₹100 off ₹1,000+), `SAVE10` (10% off ₹2,000+) and `FESTIVE15` (15% off ₹3,000+). Discounts can stack with automatic and eligible family discounts, capped at 30% of subtotal.
- Family discount: create two customer profiles with the same family group code; eligible carts of ₹1,000+ receive an extra 5%. This is a demo code and does not verify family relationships.
- Seasonal festival portal shows the next configured event and a matching coupon. Review the event dates annually, especially Eid and other lunar-calendar festivals.

### Important security note
The project dashboard is a separate page, but is not protected by admin authentication. Add authentication/role-based access before deploying it publicly. For production payments, integrate a payment provider (such as Razorpay or Stripe) server-side rather than treating the demo choices as real payment processing.
