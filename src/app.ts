import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import './config/passport';                          // registers Google strategy
import { env } from './config/env';
import { globalErrorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// ── Auth ──────────────────────────────────────────────────────────────────
import { authRouter ,permissionsRoute } from './modules/auth/auth.routes';

// ── Restaurants & subscriptions ───────────────────────────────────────────
import restaurantsRouter from './modules/restaurants/restaurants.routes';
import subscriptionRouter, { billingHistoryRouter } from './modules/subscriptions/subscriptions.routes';
import { restaurantAnalyticsRouter } from './modules/analytics/analytics.routes';

// ── Branches ──────────────────────────────────────────────────────────────
import branchesRouter from './modules/branches/branches.routes';

// ── Sections ──────────────────────────────────────────────────────────────
import sectionsRouter from './modules/sections/sections.routes';

// ── Tables ────────────────────────────────────────────────────────────────
import tablesRouter, { branchTablesRouter } from './modules/tables/tables.routes';

// ── Menu ──────────────────────────────────────────────────────────────────
import categoriesRouter from './modules/menu/categories/categories.routes';
import itemsRouter, { categoryItemsRouter } from './modules/menu/items/items.routes';
import variantsRouter from './modules/menu/variants/variants.routes';

// ── Sessions ──────────────────────────────────────────────────────────────
import sessionsRouter, { branchSessionsRouter } from './modules/sessions/sessions.routes';

// ── Orders ────────────────────────────────────────────────────────────────
import ordersRouter, { branchOrdersRouter } from './modules/orders/orders.routes';

// ── Kitchen ───────────────────────────────────────────────────────────────
import orderItemsRouter, { branchKitchenRouter } from './modules/kitchen/kitchen.routes';

// ── Payments ──────────────────────────────────────────────────────────────
import paymentsRouter, {
  sessionPaymentsRouter,
  orderPaymentsRouter,
} from './modules/payments/payments.routes';

// ── Invoices ──────────────────────────────────────────────────────────────
import { sessionInvoiceRouter, orderInvoiceRouter } from './modules/invoices/invoices.routes';

// ── Staff management ──────────────────────────────────────────────────────
import staffRouter from './modules/staff/staff.routes';

// ── Waiter requests ───────────────────────────────────────────────────────
import waiterRequestsRouter, {
  branchWaiterRequestsRouter,
} from './modules/waiter-requests/waiter-requests.routes';

// ── Inventory ─────────────────────────────────────────────────────────────
import inventoryRouter from './modules/inventory/inventory.routes';

// ── Bills ─────────────────────────────────────────────────────────────────
import billsRouter from './modules/bills/bills.routes';

// ── Dashboard ─────────────────────────────────────────────────────────────
import dashboardRouter from './modules/dashboard/dashboard.routes';

// ── Analytics ─────────────────────────────────────────────────────────────
import { branchAnalyticsRouter } from './modules/analytics/analytics.routes';

// ── Notifications ─────────────────────────────────────────────────────────
import notificationsRouter from './modules/notifications/notifications';

// ── Feedback ─────────────────────────────────────────────────────────────
import staffFeedbackRouter, {
  customerFeedbackRouter,
} from './modules/feedback/feedback';

// ── Customer module ───────────────────────────────────────────────────────
import qrRouter from './customer/qr/qr.routes';
import customerSessionRouter from './customer/session/session.routes';
import customerMenuRouter from './customer/menu/menu.routes';
import customerOrdersRouter from './customer/orders/orders.routes';
import customerPaymentsRouter from './customer/payments/payments.routes';
import customerInvoicesRouter from './customer/invoices/invoices.routes';
import customerWaiterRequestsRouter from './customer/waiter-requests/waiter-requests.routes';

// ─────────────────────────────────────────────────────────────────────────

const app = express();

// ── Security & parsing ────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [env.FRONTEND_URL, env.CUSTOMER_APP_URL],
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ── Global rate limit ─────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

const api = '/api/v1';

// ── Health check ──────────────────────────────────────────────────────────
app.get(`${api}/health`, (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Auth ──────────────────────────────────────────────────────────────────
app.use(`${api}/auth`, authRouter);
// GET /api/v1/me/permissions (mounted separately from /auth)
app.get(`${api}/me/permissions`, ...permissionsRoute);

// ── Restaurants ───────────────────────────────────────────────────────────
app.use(`${api}/restaurants`, restaurantsRouter);
// Subscription sub-routes nested under /restaurants/:id
app.use(`${api}/restaurants/:id/subscription`,  subscriptionRouter);
app.use(`${api}/restaurants/:id/subscriptions`, billingHistoryRouter);
app.use(`${api}/restaurants/:id/analytics`,     restaurantAnalyticsRouter);

// ── Branches ──────────────────────────────────────────────────────────────
app.use(`${api}/branches`, branchesRouter);

// ── Sections (nested under branches) ─────────────────────────────────────
app.use(`${api}/branches/:branchId/sections`, sectionsRouter);

// ── Tables ────────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/tables`, branchTablesRouter);
app.use(`${api}/tables`, tablesRouter);

// ── Menu ──────────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/menu/categories`, categoriesRouter);
app.use(`${api}/menu/categories/:categoryId/items`,  categoryItemsRouter);
app.use(`${api}/menu/items`,                         itemsRouter);
app.use(`${api}/menu/items/:itemId/variants`,        variantsRouter);

// ── Sessions ──────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/sessions`, branchSessionsRouter);
app.use(`${api}/sessions`, sessionsRouter);

// ── Orders ────────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/orders`, branchOrdersRouter);
app.use(`${api}/orders`, ordersRouter);

// ── Kitchen / KDS ─────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/kitchen`, branchKitchenRouter);
app.use(`${api}/order-items`, orderItemsRouter);

// ── Payments ──────────────────────────────────────────────────────────────
app.use(`${api}/sessions/:sessionId/payments`, sessionPaymentsRouter);
app.use(`${api}/orders/:orderId/payments`,     orderPaymentsRouter);
app.use(`${api}/payments`, paymentsRouter);

// ── Invoices ──────────────────────────────────────────────────────────────
app.use(`${api}/sessions/:sessionId/invoice`, sessionInvoiceRouter);
app.use(`${api}/orders/:orderId/invoice`,     orderInvoiceRouter);

// ── Staff ─────────────────────────────────────────────────────────────────
app.use(`${api}/staff`, staffRouter);

// ── Waiter requests ───────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/waiter-requests`, branchWaiterRequestsRouter);
app.use(`${api}/waiter-requests`, waiterRequestsRouter);

// ── Inventory ─────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/inventory`, inventoryRouter);

// ── Bills ─────────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/bills`, billsRouter);

// ── Dashboard ─────────────────────────────────────────────────────────────
app.use(`${api}/dashboard`, dashboardRouter);

// ── Analytics ─────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/analytics`, branchAnalyticsRouter);

// ── Notifications ─────────────────────────────────────────────────────────
app.use(`${api}/notifications`, notificationsRouter);

// ── Feedback ──────────────────────────────────────────────────────────────
app.use(`${api}/branches/:branchId/feedback`, staffFeedbackRouter);

// ── Customer module (/api/v1/customer/*) ─────────────────────────────────
app.use(`${api}/customer/qr`,              qrRouter);
app.use(`${api}/customer/session`,         customerSessionRouter);
app.use(`${api}/customer/menu`,            customerMenuRouter);
app.use(`${api}/customer/orders`,          customerOrdersRouter);
app.use(`${api}/customer/payments`,        customerPaymentsRouter);
app.use(`${api}/customer/waiter-requests`, customerWaiterRequestsRouter);
app.use(`${api}/customer/feedback`,        customerFeedbackRouter);
// Customer invoice routes sit at /customer/invoice and /customer/orders/:id/invoice
app.use(`${api}/customer`,                 customerInvoicesRouter);

// ── Global error handler (must be last) ───────────────────────────────────
app.use(globalErrorHandler);

export default app;
