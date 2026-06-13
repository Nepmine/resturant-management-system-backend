# MaHaVi Restaurant SaaS — Complete API Architecture
## Node.js + TypeScript + PostgreSQL + Prisma + Google OAuth + JWT

---

## 1. Project Structure

```
mahavi-api/
├── src/
│   ├── config/
│   │   ├── env.ts                    # Zod-validated env vars
│   │   ├── database.ts               # Prisma client singleton
│   │   └── passport.ts               # Google OAuth strategy
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification (staff) + member JWT
│   │   ├── tenant.ts                 # Resolve + validate tenant context
│   │   ├── authorize.ts              # Role-based guard factory
│   │   ├── memberAuth.ts             # Customer/member JWT guard
│   │   ├── rateLimiter.ts            # Per-tenant rate limiting
│   │   ├── validate.ts               # Zod request schema validator
│   │   └── errorHandler.ts           # Global error handler
│   ├── modules/
│   │   ├── auth/
│   │   ├── restaurants/
│   │   ├── branches/
│   │   ├── sections/
│   │   ├── tables/
│   │   ├── menu/
│   │   │   ├── categories/
│   │   │   ├── items/
│   │   │   └── variants/
│   │   ├── sessions/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── invoices/
│   │   ├── waiter-requests/
│   │   ├── staff/
│   │   ├── inventory/
│   │   ├── bills/
│   │   ├── analytics/
│   │   ├── dashboard/
│   │   ├── kitchen/
│   │   ├── notifications/
│   │   ├── feedback/
│   │   └── subscriptions/
│   │
│   ├── customer/                     # ← Dedicated customer-facing module
│   │   ├── customer.router.ts        # All /customer/* routes
│   │   ├── qr/
│   │   ├── session/
│   │   ├── menu/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── invoices/
│   │   └── waiter-requests/
│   │
│   ├── jobs/
│   │   ├── snapshotMetrics.ts        # Daily branch/item/staff metrics
│   │   ├── expireSubscriptions.ts
│   │   ├── lowStockAlerts.ts
│   │   └── markBillsOverdue.ts
│   ├── utils/
│   │   ├── jwt.ts                    # Staff JWT + member JWT (separate secrets)
│   │   ├── pagination.ts
│   │   ├── apiResponse.ts
│   │   ├── pdf.ts                    # Invoice PDF generation
│   │   └── auditLog.ts
│   ├── types/
│   │   ├── express.d.ts              # req.user, req.tenant, req.member
│   │   └── enums.ts
│   └── app.ts / server.ts
├── prisma/schema.prisma
├── tests/
├── .env.example
└── docker-compose.yml
```

---

## 2. Environment Configuration

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_MEMBER_SECRET: z.string().min(32),   // separate secret for customer member tokens
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_MEMBER_EXPIRES_IN: z.string().default('6h'),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  ESEWA_MERCHANT_CODE: z.string(),
  ESEWA_SECRET_KEY: z.string(),
  ESEWA_VERIFY_URL: z.string().url(),

  FRONTEND_URL: z.string().url(),
  CUSTOMER_APP_URL: z.string().url(),
  SUBSCRIPTION_GRACE_DAYS: z.coerce.number().default(3),
});
```

---

## 3. Prisma Schema (key models)

```prisma
enum SubscriptionPlan   { trial monthly yearly }
enum SubscriptionStatus { active grace_period expired cancelled }
enum TableStatus        { available occupied cleaning }
enum SessionStatus      { active completed abandoned }
enum OrderType          { dine_in parcel }
enum OrderStatus        { pending confirmed preparing ready delivered cancelled }
enum ItemStatus         { pending preparing ready delivered cancelled }
enum PaymentStatus      { pending completed failed refunded }
enum PaymentMethod      { esewa cash }
enum StaffRole          { staff manager admin }
enum RequestType        { call_waiter request_water request_tissue }
enum RequestStatus      { pending acknowledged resolved }
enum BillType           { electricity rent water internet other }
enum BillStatus         { unpaid paid overdue }

model DiningSession {
  id           Int           @id @default(autoincrement())
  tableId      Int           @map("table_id")
  branchId     Int           @map("branch_id")           // denormalized
  status       SessionStatus @default(active)
  startedAt    DateTime      @default(now()) @map("started_at")
  completedAt  DateTime?     @map("completed_at")
  // session is created automatically on first QR scan
  // no staff_id required for creation

  @@index([branchId, status])
  @@index([tableId, status])
  @@map("dining_sessions")
}

model Order {
  id          Int         @id @default(autoincrement())
  sessionId   Int?        @map("session_id")   // null for parcel orders
  branchId    Int         @map("branch_id")    // denormalized
  memberId    Int?        @map("member_id")    // null for parcel/staff-placed orders
  orderType   OrderType   @default(dine_in) @map("order_type")
  status      OrderStatus @default(pending)
  isParcel    Boolean     @default(false) @map("is_parcel")
  // customer_name, customer_phone for parcel
  customerName  String?   @map("customer_name")
  customerPhone String?   @map("customer_phone")
  note        String?
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@index([branchId, status])
  @@index([branchId, orderType])
  @@index([branchId, createdAt])
  @@index([sessionId])
  @@map("orders")
}
```

---

## 4. Two Auth Contexts

### 4.1 Staff JWT (access token, 15 min)

```typescript
interface AccessTokenPayload {
  sub: number;           // staff_users.id
  restaurantId: number;
  branchId: number | null;
  role: StaffRole;
  jti: string;
}
```

### 4.2 Member JWT (customer token, 6 h)

```typescript
// Issued when customer scans QR and joins a session.
// Signed with JWT_MEMBER_SECRET — completely separate from staff auth.
interface MemberTokenPayload {
  sub: number;        // session_members.id
  sessionId: number;
  tableId: number;
  branchId: number;
  restaurantId: number;
}
```

`memberAuth` middleware verifies `Authorization: Bearer <memberToken>` on all `/customer/*` routes and attaches `req.member`.

---

## 5. Middleware Stack

```typescript
// Protected staff route pipeline:
authenticate()        // verify staff JWT, check is_active
→ resolveTenant()     // verify active subscription
→ authorize(role)     // role hierarchy check
→ assertBranchAccess()// staff scoped to own branch
→ validate(schema)    // Zod parse body/query/params
→ handler

// Customer route pipeline:
memberAuth()          // verify member JWT, attach req.member
→ validate(schema)
→ handler

// Public routes (QR scan entry point):
validate(schema)
→ handler
```

---

## 6. Authorization

```typescript
const ROLE_HIERARCHY = { staff: 1, manager: 2, admin: 3 };

export function authorize(minRole: RoleLevel) { ... }

// Staff can only touch their assigned branch
export function assertBranchAccess(req, res, next) { ... }

// Customer invoice access guard
// Ensures member can only access invoices from their own session
export function assertMemberSessionAccess(req, res, next) {
  const { sessionId } = req.member;
  if (parseInt(req.params.sessionId) !== sessionId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
}
```

---

## 7. Complete API Route Reference

### Base URL: `/api/v1`

---

### 7.1 Authentication (Staff)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | Public | Redirect to Google OAuth |
| GET | `/auth/google/callback` | Public | OAuth callback, issue JWT pair |
| POST | `/auth/refresh` | Refresh token | Rotate access token |
| POST | `/auth/logout` | Bearer | Invalidate refresh token |
| GET | `/auth/me` | Bearer | Current user profile |
| GET | `/me/permissions` | Staff+ | Flat permission object for frontend gating |

---

### 7.2 Restaurants

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/restaurants` | Public | Onboard new restaurant (creates trial sub) |
| GET | `/restaurants/:id` | Admin | Get restaurant details |
| PATCH | `/restaurants/:id` | Admin | Update name, billing email |
| DELETE | `/restaurants/:id` | Admin | Soft-delete |

---

### 7.3 Subscriptions

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/restaurants/:id/subscription` | Admin | Current subscription |
| POST | `/restaurants/:id/subscription/upgrade` | Admin | Upgrade plan |
| POST | `/restaurants/:id/subscription/cancel` | Admin | Cancel |
| GET | `/restaurants/:id/subscriptions` | Admin | Billing history |

---

### 7.4 Branches

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches` | Staff+ | List (scoped by role) |
| POST | `/branches` | Admin | Create (enforces max_branches with row lock) |
| GET | `/branches/:id` | Staff+ | Branch detail |
| PATCH | `/branches/:id` | Manager+ | Update info |
| DELETE | `/branches/:id` | Admin | Soft-delete |
| PATCH | `/branches/:id/toggle` | Admin | Activate / deactivate |

---

### 7.5 Sections

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/sections` | Staff+ | List sections |
| POST | `/branches/:branchId/sections` | Manager+ | Create |
| PATCH | `/branches/:branchId/sections/:id` | Manager+ | Rename |
| DELETE | `/branches/:branchId/sections/:id` | Manager+ | Soft-delete |

---

### 7.6 Dining Tables + Table Lifecycle

Table status lifecycle: **available → occupied → cleaning → available**

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/tables` | Staff+ | List (filterable by section, status) |
| POST | `/branches/:branchId/tables` | Manager+ | Create table (auto-generates qr_token) |
| PATCH | `/branches/:branchId/tables/:id` | Manager+ | Update table_no / label |
| DELETE | `/branches/:branchId/tables/:id` | Manager+ | Soft-delete |
| POST | `/tables/:id/cleaning` | Staff+ | Mark table cleaning (after session close) |
| POST | `/tables/:id/available` | Staff+ | Mark table available (cleaning done) |
| GET | `/tables/:id/qr` | Manager+ | Return QR SVG/PNG for current qr_token |
| POST | `/tables/:id/regenerate-qr` | Manager+ | Issue new qr_token (invalidates old QR) |

> **Note:** `occupied` status is set automatically when a customer scans QR and creates/joins a session. Staff do not manually set tables to occupied. `cleaning` and `available` are explicit staff actions.

---

### 7.7 Menu (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/menu/categories` | Staff+ | Full category list |
| POST | `/branches/:branchId/menu/categories` | Manager+ | Create category |
| PATCH | `/branches/:branchId/menu/categories/:id` | Manager+ | Update name, sort_order, visibility |
| DELETE | `/branches/:branchId/menu/categories/:id` | Manager+ | Soft-delete |
| PATCH | `/branches/:branchId/menu/categories/reorder` | Manager+ | Bulk sort_order update |
| POST | `/menu/categories/:categoryId/items` | Manager+ | Create item |
| GET | `/menu/items/:id` | Staff+ | Item detail + variants |
| PATCH | `/menu/items/:id` | Manager+ | Update item (writes audit log old/new) |
| PATCH | `/menu/items/:id/availability` | Staff+ | Toggle is_available + disable_note |
| DELETE | `/menu/items/:id` | Manager+ | Soft-delete |
| POST | `/menu/items/:itemId/variants` | Manager+ | Create variant |
| PATCH | `/menu/items/:itemId/variants/:id` | Manager+ | Update variant |
| DELETE | `/menu/items/:itemId/variants/:id` | Manager+ | Soft-delete |

---

### 7.8 Sessions (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/sessions/active` | Staff+ | All active sessions |
| GET | `/sessions/:id` | Staff+ | Session detail + members + orders |
| POST | `/sessions/:id/close` | Staff+ | Close session → table goes to cleaning |

> Sessions are no longer manually created by staff. Creation happens automatically via the customer QR flow (§9).

---

### 7.9 Orders (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/orders` | Staff+ | List orders (filter: status, type, date, `?updatedAfter=`) |
| GET | `/orders/:id` | Staff+ | Order detail + items |
| PATCH | `/orders/:id/status` | Staff+ | Advance order status |
| PATCH | `/orders/:id/cancel` | Staff+ | Cancel order (logs reason to activity_logs) |
| PATCH | `/orders/:orderId/items/:id/status` | Staff+ | Update single item status |
| PATCH | `/orders/:orderId/items/:id/cancel` | Staff+ | Cancel single item |

#### Parcel Orders (Staff-placed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/orders/parcel` | Staff+ | Create parcel order with customer_name, customer_phone |
| GET | `/branches/:branchId/orders?orderType=parcel` | Staff+ | Filter parcel-only orders |

---

### 7.10 Payments (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/sessions/:sessionId/payments` | Staff+ | All payments for a session |
| GET | `/orders/:orderId/payments` | Staff+ | Payments for a specific order |
| POST | `/payments/esewa/verify` | Public | eSewa webhook callback |
| POST | `/payments/:id/refund` | Manager+ | Refund (creates new row, append-only) |

---

### 7.11 Invoices (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/sessions/:sessionId/invoice` | Staff+ | Full session invoice (all orders + payments) |
| GET | `/orders/:orderId/invoice` | Staff+ | Single order invoice |
| GET | `/sessions/:sessionId/invoice/pdf` | Staff+ | Download session invoice as PDF |
| GET | `/orders/:orderId/invoice/pdf` | Staff+ | Download order invoice as PDF |

---

### 7.12 Kitchen Display System (KDS)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/kitchen/orders` | Staff+ | Active orders grouped by status |
| GET | `/branches/:branchId/kitchen/queue` | Staff+ | Pending + preparing items only (`?updatedAfter=`) |
| PATCH | `/order-items/:id/preparing` | Staff+ | Mark preparing |
| PATCH | `/order-items/:id/ready` | Staff+ | Mark ready |
| PATCH | `/order-items/:id/delivered` | Staff+ | Mark delivered |

---

### 7.13 Waiter Requests (Staff-managed)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/waiter-requests` | Staff+ | Pending requests (`?updatedAfter=`) |
| PATCH | `/waiter-requests/:id/acknowledge` | Staff+ | Acknowledge |
| PATCH | `/waiter-requests/:id/resolve` | Staff+ | Resolve + set resolved_at |

---

### 7.14 Staff Management

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/staff` | Admin | List staff (restaurant-scoped) |
| POST | `/staff/invite` | Admin | Pre-create (is_active=false) |
| PATCH | `/staff/:id/whitelist` | Admin | Whitelist: set is_active=true |
| PATCH | `/staff/:id/suspend` | Admin | Suspend |
| PATCH | `/staff/:id/role` | Admin | Update role + branch |
| DELETE | `/staff/:id` | Admin | Soft-delete |
| GET | `/staff/:id/logs` | Admin | Staff activity timeline |

---

### 7.15 Inventory

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/inventory/categories` | Staff+ | List inventory categories |
| POST | `/branches/:branchId/inventory/categories` | Manager+ | Create category |
| PATCH | `/branches/:branchId/inventory/categories/:id` | Manager+ | Rename / reorder |
| DELETE | `/branches/:branchId/inventory/categories/:id` | Manager+ | Soft-delete |
| GET | `/branches/:branchId/inventory` | Staff+ | List items (low_stock flag included) |
| GET | `/branches/:branchId/inventory/low-stock` | Staff+ | Items below threshold |
| POST | `/branches/:branchId/inventory` | Manager+ | Create item |
| PATCH | `/branches/:branchId/inventory/:id` | Manager+ | Update metadata |
| POST | `/branches/:branchId/inventory/:id/adjust` | Staff+ | Log stock adjustment (+/-) |
| GET | `/branches/:branchId/inventory/:id/logs` | Manager+ | Item history |
| DELETE | `/branches/:branchId/inventory/:id` | Manager+ | Soft-delete |

---

### 7.16 Bills

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/bills` | Manager+ | List (filter by status) |
| POST | `/branches/:branchId/bills` | Manager+ | Create |
| PATCH | `/branches/:branchId/bills/:id` | Manager+ | Update amount, due_date, note |
| PATCH | `/branches/:branchId/bills/:id/pay` | Manager+ | Mark paid + paid_date |
| DELETE | `/branches/:branchId/bills/:id` | Admin | Soft-delete |

---

### 7.17 Dashboard

Reads exclusively from snapshot tables — zero real-time aggregation.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | Staff+ | Staff dashboard: active orders, active sessions, table status counts, pending waiter calls, revenue today, orders today |
| GET | `/dashboard/branch/:branchId` | Manager+ | Branch metrics from daily_branch_metrics |
| GET | `/dashboard/admin` | Admin | Restaurant-wide: cross-branch revenue, top branch, subscription status |

**`GET /dashboard` response shape:**
```json
{
  "activeOrders": 12,
  "activeSessions": 8,
  "tables": { "available": 10, "occupied": 8, "cleaning": 2 },
  "pendingWaiterCalls": 3,
  "revenueToday": 14500.00,
  "ordersToday": 47,
  "lowStockItems": 2
}
```

---

### 7.18 Analytics

All endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Period shortcuts: `?period=today|week|month|year`.
Analytics queries read from snapshot tables (daily_branch_metrics, daily_item_metrics, staff_daily_metrics) — never from raw orders.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/analytics/revenue` | Manager+ | Revenue by period: total, cash, online, dine-in, parcel breakdown |
| GET | `/branches/:branchId/analytics/orders` | Manager+ | Order counts by period: total, cancelled, dine-in, parcel |
| GET | `/branches/:branchId/analytics/payments` | Manager+ | Payment breakdown: cash vs eSewa, completed vs failed |
| GET | `/branches/:branchId/analytics/peak-hours` | Manager+ | Hourly order distribution (last 30 days) |
| GET | `/branches/:branchId/analytics/top-dishes` | Manager+ | Top N selling items by quantity + revenue |
| GET | `/branches/:branchId/analytics/worst-dishes` | Manager+ | Bottom N items by quantity |
| GET | `/branches/:branchId/analytics/dish-sales` | Manager+ | Per-item sales: quantity_sold, revenue_generated by period |
| GET | `/branches/:branchId/analytics/table-utilization` | Manager+ | Sessions per table, avg occupancy %, busiest tables |
| GET | `/branches/:branchId/analytics/session-duration` | Manager+ | Avg session duration by period |
| GET | `/branches/:branchId/analytics/customer-trends` | Manager+ | Customer count by period, avg party size |
| GET | `/branches/:branchId/analytics/staff-performance` | Manager+ | Staff leaderboard from staff_daily_metrics |
| GET | `/restaurants/:id/analytics/branch-comparison` | Admin | Side-by-side revenue/orders across all branches |

> **Peak hours** is the only endpoint querying raw `orders` table — it groups by `EXTRACT(HOUR FROM created_at)` with a `(branch_id, created_at)` index. All others hit snapshots.

---

### 7.19 Notifications

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Staff+ | Notifications for current user |
| PATCH | `/notifications/:id/read` | Staff+ | Mark one read |
| PATCH | `/notifications/read-all` | Staff+ | Mark all read |

---

### 7.20 Customer Feedback

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/branches/:branchId/feedback` | Manager+ | List feedback + avg rating |

---

### 7.21 Utility

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | `{ status, db, uptime }` |

---

## 8. Customer Module (`/api/v1/customer`)

All routes use **member JWT** via `memberAuth()` middleware, except the QR entry point which is public.

### 8.1 QR Entry Point (Public)

```
POST /customer/qr/scan
Body: { qr_token: string }

Logic (atomic transaction):
1. Resolve table by qr_token → verify table exists + not deleted
2. Find active session for this table OR create new one
   - If no active session: create dining_session + set table status = occupied
   - If active session exists: join it
3. Create session_member row
4. Issue member JWT { sub: memberId, sessionId, tableId, branchId, restaurantId }
5. Return: { memberToken, session, menu_url }
```

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/customer/qr/scan` | Public | Scan QR → auto-create/join session, get member token |

This is the **single entry point** for all customer interactions. No staff action required to start a session.

---

### 8.2 Customer Session

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer/session` | Member JWT | Current session state (status, members, table info) |
| POST | `/customer/session/leave` | Member JWT | Leave session (removes member row) |
| POST | `/customer/session/complete` | Member JWT | Customer clicks "Complete Meal" — triggers session completion flow |

**Complete Meal flow (`POST /customer/session/complete`):**
1. Verify all orders for session are in terminal state (delivered/cancelled)
2. Verify no pending payments
3. Set session status = completed, completed_at = NOW()
4. Set table status = cleaning
5. Notify staff via notifications table

---

### 8.3 Customer Menu

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer/menu` | Member JWT | Full menu for this branch (categories + available items + variants) |
| GET | `/customer/menu/categories` | Member JWT | Categories only |
| GET | `/customer/menu/items/:id` | Member JWT | Item detail + variants |

Branch is resolved from `req.member.branchId` — no branch param needed.

---

### 8.4 Customer Orders

**Payment flow: Order Created → Items Served → Customer Pays**

Order is always created first; payment happens after items are served. The "Pay → Order" pattern from requirements refers to the customer initiating payment at session end, not pre-payment before ordering.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/customer/orders` | Member JWT | Place new order (items auto price-snapshotted) |
| GET | `/customer/orders` | Member JWT | All orders in current session |
| GET | `/customer/orders/:id` | Member JWT | Single order detail + item statuses |
| POST | `/customer/orders/:id/items` | Member JWT | Add items to an existing pending order |
| POST | `/customer/orders/:id/cancel` | Member JWT | Cancel order if still pending |

**Polling:** All GET endpoints accept `?updatedAfter=<ISO>` for incremental updates.

---

### 8.5 Customer Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer/session/invoice` | Member JWT | Full session invoice (pre-payment review) |
| POST | `/customer/payments` | Member JWT | Initiate payment for session (cash or eSewa) |
| GET | `/customer/payments` | Member JWT | Payment status for current session |
| POST | `/customer/payments/esewa/initiate` | Member JWT | Get eSewa payment form params |

`POST /customer/payments` body:
```json
{
  "method": "cash" | "esewa",
  "sessionId": 123,     // validated against req.member.sessionId
  "orderIds": [1, 2, 3] // specific orders or empty for full session
}
```

---

### 8.6 Customer Invoices

Access control: `assertMemberSessionAccess()` middleware verifies `sessionId` in route matches `req.member.sessionId`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer/invoice` | Member JWT | Current session invoice (read-only, member-scoped) |
| GET | `/customer/invoice/pdf` | Member JWT | Download invoice PDF |
| GET | `/customer/orders/:id/invoice` | Member JWT | Single order invoice |

Customers can **only** access invoices from their own session. The member JWT contains `sessionId` and the guard rejects any mismatch — no parameter spoofing possible.

---

### 8.7 Customer Waiter Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/customer/waiter-requests` | Member JWT | Submit request (call_waiter, request_water, request_tissue) |
| GET | `/customer/waiter-requests` | Member JWT | Status of requests from this session |

---

### 8.8 Customer Feedback

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/customer/feedback` | Member JWT | Submit rating (1-5) + comment |

---

### 8.9 Customer Polling Summary

All customer GET endpoints support `?updatedAfter=ISO` for incremental polling:

| Endpoint | Poll interval | What changes |
|----------|---------------|--------------|
| `GET /customer/orders?updatedAfter=` | 5s | Item status changes (preparing/ready/delivered) |
| `GET /customer/session?updatedAfter=` | 10s | Session status, member count |
| `GET /customer/waiter-requests?updatedAfter=` | 10s | Request acknowledgement/resolution |
| `GET /customer/payments?updatedAfter=` | 5s | eSewa payment confirmation |

---

## 9. Session Creation Flow (Corrected)

```
Customer scans QR code on table
         ↓
POST /customer/qr/scan  { qr_token }
         ↓
Server (atomic transaction):
  1. Lookup table by qr_token
  2. Find active session for table?
     YES → add member to existing session
     NO  → CREATE dining_session
             SET table.status = 'occupied'
             CREATE first session_member
  3. Issue member JWT
         ↓
Customer receives:
  - memberToken (6h expiry)
  - sessionId
  - Full menu via /customer/menu
         ↓
Customer browses menu → POST /customer/orders
         ↓
Staff KDS receives order → prepares items
         ↓
Customer sees item status via polling
         ↓
All items delivered → Customer clicks "Complete Meal"
         ↓
POST /customer/session/complete
  → session.status = completed
  → table.status = cleaning
  → staff notified
         ↓
Staff runs POST /tables/:id/available (after cleaning)
  → table.status = available
```

---

## 10. Payment Flow (Clarified)

The correct flow is **Order → Fulfillment → Payment**:

```
1. Customer places order (POST /customer/orders)
2. Kitchen prepares + serves items (KDS status updates)
3. Customer reviews invoice (GET /customer/invoice)
4. Customer pays:
   - Cash: POST /customer/payments { method: "cash" }
           → staff confirms cash received (optional staff confirmation step)
   - eSewa: POST /customer/payments/esewa/initiate
            → customer completes eSewa flow
            → POST /payments/esewa/verify (webhook)
            → payment row updated to completed
5. Payment confirmed → session completable
```

"Pay → Order" in original requirements refers to the **customer journey sequence** (they think about paying last), not pre-authorization. The order is always created before payment.

---

## 11. Invoice Module

### Invoice Schema

```sql
-- Invoices are generated on-demand (not stored), but a reference table
-- tracks issued invoice numbers for accounting.

CREATE TABLE invoice_references (
  id               SERIAL PRIMARY KEY,
  invoice_number   VARCHAR(30) NOT NULL UNIQUE,  -- e.g. INV-2025-00042
  session_id       INT REFERENCES dining_sessions(id),
  order_id         INT REFERENCES orders(id),    -- null = session invoice
  branch_id        INT NOT NULL REFERENCES branches(id),
  total_amount     NUMERIC(12,2) NOT NULL,
  issued_at        TIMESTAMPTZ DEFAULT now(),
  issued_to        VARCHAR(150),                 -- customer name (parcel)

  INDEX (branch_id, issued_at),
  INDEX (session_id),
  INDEX (order_id)
);
```

### Invoice Response Shape

```json
{
  "invoiceNumber": "INV-2025-00042",
  "issuedAt": "2025-06-04T14:32:00Z",
  "branch": { "name": "Mahavi Thamel", "address": "...", "phone": "..." },
  "table": { "tableNo": "T-05", "section": "Ground Floor" },
  "session": { "id": 123, "startedAt": "...", "completedAt": "..." },
  "members": 3,
  "orders": [
    {
      "orderId": 45,
      "orderType": "dine_in",
      "items": [
        { "name": "Momo", "variant": "Buff", "qty": 2, "unitPrice": 200, "subtotal": 400 }
      ],
      "subtotal": 400
    }
  ],
  "subtotal": 1250.00,
  "tax": 0,
  "total": 1250.00,
  "payments": [
    { "method": "esewa", "amount": 1250.00, "status": "completed" }
  ],
  "balanceDue": 0
}
```

### PDF Generation

`GET /sessions/:sessionId/invoice/pdf` and `GET /customer/invoice/pdf` use `pdfkit` or `puppeteer` to render the invoice JSON into a printable PDF. Streamed directly as `Content-Type: application/pdf`.

---

## 12. Order Service (Core Business Logic)

```typescript
export class OrderService {
  async placeOrder(dto: PlaceOrderDto, member: MemberTokenPayload): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      // 1. Validate session is active and belongs to this member
      const session = await tx.diningSession.findUnique({
        where: { id: member.sessionId, status: 'active' }
      });
      if (!session) throw new AppError('Session not active', 400);

      // 2. Validate + snapshot menu items
      const menuItems = await tx.menuItem.findMany({
        where: { id: { in: dto.items.map(i => i.menuItemId) }, isAvailable: true, deletedAt: null },
        include: { variants: true }
      });
      if (menuItems.length !== dto.items.length) throw new AppError('Item unavailable', 400);

      // 3. Create order
      const order = await tx.order.create({
        data: {
          sessionId: member.sessionId,
          branchId: member.branchId,
          memberId: member.sub,
          orderType: 'dine_in',
          status: 'pending',
          note: dto.note,
        }
      });

      // 4. Create items with price + name snapshots
      await tx.orderItem.createMany({
        data: dto.items.map(item => {
          const mi = menuItems.find(m => m.id === item.menuItemId)!;
          const variant = item.variantId ? mi.variants.find(v => v.id === item.variantId) : null;
          return {
            orderId: order.id,
            menuItemId: item.menuItemId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            unitPrice: mi.basePrice + (variant?.extraPrice ?? 0),
            itemNameSnapshot: mi.name,
            variantNameSnapshot: variant?.name ?? null,
            note: item.note ?? null,
            status: 'pending',
          };
        })
      });

      // 5. Write audit log
      await auditLog(tx, { staffId: null, branchId: member.branchId, actionType: 'order_placed', targetType: 'order', targetId: order.id });

      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    });
  }

  async createParcelOrder(dto: ParcelOrderDto, staffUser: StaffUser): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      // Parcel orders: no session, no member — staff-placed
      const order = await tx.order.create({
        data: {
          sessionId: null,
          branchId: staffUser.branchId!,
          memberId: null,
          orderType: 'parcel',
          isParcel: true,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          status: 'pending',
          note: dto.note,
        }
      });
      // ... snapshot items same as above
      return order;
    });
  }
}
```

---

## 13. Branch Creation Guard (Subscription Enforcement)

```typescript
async createBranch(restaurantId: number, dto: CreateBranchDto) {
  return prisma.$transaction(async (tx) => {
    // Row-level lock prevents concurrent over-provisioning
    const subscription = await tx.$queryRaw`
      SELECT * FROM subscriptions
      WHERE restaurant_id = ${restaurantId}
        AND (status = 'active' OR (status = 'grace_period' AND grace_expires_at > now()))
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE
    `;
    if (!subscription[0]) throw new AppError('No active subscription', 402);

    const count = await tx.branch.count({ where: { restaurantId, deletedAt: null } });
    if (count >= subscription[0].maxBranches) {
      throw new AppError(`Plan allows max ${subscription[0].maxBranches} branches`, 403, 'BRANCH_LIMIT_REACHED');
    }
    return tx.branch.create({ data: { restaurantId, ...dto } });
  });
}
```

---

## 14. Google OAuth + Staff Whitelist

```typescript
// Passport strategy: match email to whitelisted staff record
passport.use(new GoogleStrategy({ ... }, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0].value;
  const staff = await prisma.staffUser.findFirst({ where: { email, isActive: true, deletedAt: null } });
  if (!staff) return done(null, false, { message: 'Account not whitelisted' });
  if (!staff.oauthId) {
    await prisma.staffUser.update({ where: { id: staff.id }, data: { oauthProvider: 'google', oauthId: profile.id } });
  }
  done(null, staff);
}));
```

---

## 15. Background Jobs

```typescript
// 00:05 daily — populate all three snapshot tables atomically
async function snapshotDailyMetrics(date: Date) {
  const branches = await prisma.branch.findMany({ where: { deletedAt: null, isActive: true } });
  for (const branch of branches) {
    await prisma.$transaction(async (tx) => {
      // daily_branch_metrics: revenue, orders, sessions, customers, parcel vs dine-in, cash vs online
      await tx.dailyBranchMetrics.upsert({ ... });
      // daily_item_metrics: per-item quantity_sold + revenue_generated
      await tx.dailyItemMetrics.createMany({ ... });
      // staff_daily_metrics: orders_handled, sales_amount, avg_completion_seconds
      await tx.staffDailyMetrics.createMany({ ... });
    });
  }
}

// Every hour — expire grace periods
async function expireGracePeriods() {
  await prisma.subscription.updateMany({
    where: { status: 'grace_period', graceExpiresAt: { lt: new Date() } },
    data: { status: 'expired' }
  });
}

// Every 6 hours — low stock notifications
async function lowStockAlerts() { ... }

// Nightly — mark overdue bills
async function markBillsOverdue() { ... }
```

---

## 16. Analytics Snapshot Tables

### `daily_branch_metrics`

```sql
CREATE TABLE daily_branch_metrics (
  id                 SERIAL PRIMARY KEY,
  branch_id          INT NOT NULL REFERENCES branches(id),
  snapshot_date      DATE NOT NULL,
  total_revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_orders       INT NOT NULL DEFAULT 0,
  cancelled_orders   INT NOT NULL DEFAULT 0,
  dinein_orders      INT NOT NULL DEFAULT 0,
  parcel_orders      INT NOT NULL DEFAULT 0,
  total_sessions     INT NOT NULL DEFAULT 0,
  total_customers    INT NOT NULL DEFAULT 0,
  avg_order_value    NUMERIC(10,2),
  completed_payments INT NOT NULL DEFAULT 0,
  UNIQUE (branch_id, snapshot_date)
);
```

### `daily_item_metrics`

```sql
CREATE TABLE daily_item_metrics (
  id                SERIAL PRIMARY KEY,
  branch_id         INT NOT NULL REFERENCES branches(id),
  menu_item_id      INT NOT NULL REFERENCES menu_items(id),
  snapshot_date     DATE NOT NULL,
  quantity_sold     INT NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (branch_id, menu_item_id, snapshot_date),
  INDEX  (branch_id, snapshot_date)
);
```

### `staff_daily_metrics`

```sql
CREATE TABLE staff_daily_metrics (
  id                           SERIAL PRIMARY KEY,
  staff_id                     INT NOT NULL REFERENCES staff_users(id),
  branch_id                    INT NOT NULL REFERENCES branches(id),
  snapshot_date                DATE NOT NULL,
  orders_handled               INT NOT NULL DEFAULT 0,
  sessions_handled             INT NOT NULL DEFAULT 0,
  sales_amount                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  cancelled_orders             INT NOT NULL DEFAULT 0,
  avg_order_completion_seconds INT,
  UNIQUE (staff_id, snapshot_date),
  INDEX  (branch_id, snapshot_date)
);
```

---

## 17. Notifications Table

```sql
CREATE TABLE notifications (
  id             BIGSERIAL PRIMARY KEY,
  restaurant_id  INT NOT NULL REFERENCES restaurants(id),
  branch_id      INT REFERENCES branches(id),
  staff_id       INT REFERENCES staff_users(id),
  type           VARCHAR(50) NOT NULL,  -- low_stock | waiter_called | sub_expiring | bill_overdue | staff_invited | meal_completed
  title          VARCHAR(150) NOT NULL,
  message        TEXT,
  reference_type VARCHAR(30),
  reference_id   INT,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  INDEX (staff_id, is_read, created_at),
  INDEX (branch_id, created_at)
);
```

---

## 18. Security Tables

### `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  staff_id    INT NOT NULL REFERENCES staff_users(id),
  family_id   UUID NOT NULL,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  INDEX (staff_id, revoked_at),
  INDEX (family_id)
);
```

### `login_history`

```sql
CREATE TABLE login_history (
  id               BIGSERIAL PRIMARY KEY,
  staff_id         INT REFERENCES staff_users(id),
  attempted_email  VARCHAR(150),  -- populated on failed attempts
  ip_address       INET,
  user_agent       TEXT,
  login_at         TIMESTAMPTZ DEFAULT now(),
  logout_at        TIMESTAMPTZ,
  success          BOOLEAN NOT NULL DEFAULT true,
  INDEX (staff_id, login_at)
);
```

---

## 19. Customer Feedback Table

```sql
CREATE TABLE customer_feedback (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES dining_sessions(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  INDEX (session_id)
);
```

---

## 20. Inventory Categories Table

```sql
CREATE TABLE inventory_categories (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id),
  name        VARCHAR(80) NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  INDEX (branch_id, sort_order)
);
-- inventory_items.category_id → inventory_categories(id) nullable FK
```

---

## 21. Standard Response Envelope

```json
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 142 } }

// Error
{ "success": false, "error": "Validation failed", "code": "VALIDATION_ERROR",
  "details": [{ "field": "email", "message": "Invalid email format" }] }
```

---

## 22. Error Handling

```typescript
export class AppError extends Error {
  constructor(public message: string, public statusCode = 500, public code = 'INTERNAL_ERROR') {
    super(message);
  }
}

export function globalErrorHandler(err, req, res, next) {
  if (err instanceof AppError) return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, error: 'Already exists', code: 'CONFLICT' });
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  }
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

---

## 23. Security Checklist

- [x] Staff JWT (15 min) + member JWT (6 h) on separate secrets — no cross-contamination
- [x] Member JWT contains sessionId — customer invoice access guard compares param vs token claim
- [x] Refresh token family tracking — reuse detection, logout-everywhere support
- [x] Staff whitelist model — no self-signup, admin must pre-approve
- [x] `is_active` re-checked on every staff request (not just at login)
- [x] All routes tenant-scoped — no cross-restaurant data leakage
- [x] Branch access guard for `staff` role
- [x] Subscription enforcement on branch creation (row-level lock vs race condition)
- [x] Session creation is atomic — no duplicate sessions per table
- [x] Table status transitions enforced via dedicated endpoints (not generic PATCH)
- [x] Price snapshots on order_items — menu edits never affect order history
- [x] Payments append-only — refund = new row, no updates
- [x] Invoice numbers tracked in invoice_references table for accounting
- [x] Zod validation on all inputs
- [x] Per-tenant rate limiting
- [x] Helmet.js security headers
- [x] Audit log on all destructive + financial operations

---

## 24. Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Session auto-created on QR scan | Customer-driven flow; staff never need to "open" a table manually |
| Member JWT separate secret | Customer tokens can be revoked independently; no staff privilege escalation possible |
| `assertMemberSessionAccess()` guard | Prevents member token from accessing another session's invoice via param manipulation |
| Table lifecycle via dedicated endpoints | `POST /tables/:id/cleaning` and `/available` enforce valid transitions; generic PATCH was too permissive |
| Parcel orders: null sessionId, null memberId | Parcel orders are staff-placed; they bypass the customer flow entirely |
| Payment after fulfillment | Matches real restaurant workflow; pre-payment not applicable for dine-in |
| Analytics read from snapshot tables | All analytics endpoints except peak-hours are O(1) date-range scans on pre-aggregated rows |
| Invoice generated on-demand, number tracked | Avoids storing redundant data; invoice_references gives accounting trail without duplicating order data |
| Customer module isolated under `/customer/*` | Clean separation; different auth middleware, different guards, independently deployable |
| `orders.branch_id` denormalized | Avoids 5-join analytics queries; set immutably at creation |