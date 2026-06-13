# MAHAVI_FRONTEND_MEMORY_2_API_CONTRACTS
# Version: 1.0 | Generated from complete backend implementation
# Companion files: FRONTEND_MEMORY_1_ARCHITECTURE.md, FRONTEND_MEMORY_3_UI_SCREENS.md
# This file: every endpoint, request shapes, response shapes, enums, error codes, business rules, query params

---

## GLOBAL CONVENTIONS

BASE_URL: /api/v1 (all paths below are relative to this)
AUTH_HEADER: Authorization: Bearer <accessToken>
CONTENT_TYPE: application/json (all request/response bodies)
RESPONSE_ENVELOPE: { success: boolean, data: T } | { success: boolean, data: T[], meta: PaginationMeta } | { success: false, error: string, code: string }
PAGINATION_PARAMS: ?page=1&limit=20
UPDATEDAFTER_PARAM: ?updatedAfter=<ISO8601> (incremental polling, all list endpoints supporting polling)
PERIOD_PARAMS: ?period=today|week|month|year OR ?from=YYYY-MM-DD&to=YYYY-MM-DD (analytics)

## ENUM DEFINITIONS (authoritative — mirrors backend Prisma enums)

```typescript
type SubscriptionPlan   = 'trial' | 'monthly' | 'yearly';
type SubscriptionStatus = 'active' | 'grace_period' | 'expired' | 'cancelled';
type StaffRole          = 'staff' | 'manager' | 'admin';
type TableStatus        = 'available' | 'occupied' | 'cleaning';
type SessionStatus      = 'active' | 'completed' | 'abandoned';
type OrderType          = 'dine_in' | 'parcel';
type OrderStatus        = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
type ItemStatus         = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
type PaymentStatus      = 'pending' | 'completed' | 'failed' | 'refunded';
type PaymentMethod      = 'esewa' | 'cash';
type RequestType        = 'call_waiter' | 'request_water' | 'request_tissue';
type RequestStatus      = 'pending' | 'acknowledged' | 'resolved';
type BillType           = 'electricity' | 'rent' | 'water' | 'internet' | 'other';
type BillStatus         = 'unpaid' | 'paid' | 'overdue';
type InvChangeType      = 'add' | 'remove' | 'adjust';
type NotificationType   = 'low_stock' | 'waiter_called' | 'sub_expiring' | 'bill_overdue' | 'staff_invited' | 'meal_completed';
```

---

## API GROUP 1: AUTHENTICATION

### POST /auth/refresh
Auth: none (uses httpOnly cookie)
Request: {} (empty body, refresh token in cookie)
Response: { accessToken: string }
Errors: 401 (no cookie), 403 (reused/revoked token)
Notes: Rotate access token. Old refresh token invalidated. New refresh token set in cookie.

### POST /auth/logout
Auth: Bearer <accessToken>
Request: {}
Response: 204 No Content
Notes: Invalidates refresh token server-side. Frontend MUST clear accessToken from Zustand.

### GET /auth/me
Auth: Bearer <accessToken>
Response:
```typescript
{
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  branchId: number | null;
  restaurantId: number;
  oauthProvider: string;
  isActive: boolean;
}
```

### GET /auth/google
Auth: none
Behavior: Redirects browser to Google OAuth consent. NOT an API call — use window.location.href.

### GET /auth/google/callback
Auth: none (handled by backend)
Behavior: Backend processes OAuth, redirects to FRONTEND_URL/auth/callback?token=<accessToken>
Frontend extracts token from URL query param.

### GET /me/permissions
Auth: Bearer <accessToken>
Response:
```typescript
{
  canManageMenu: boolean;
  canViewAnalytics: boolean;
  canManageStaff: boolean;
  canManageBranches: boolean;
  canManageSubscriptions: boolean;
  canManageBills: boolean;
  canViewKitchen: boolean;
  canConfirmOrders: boolean;
  canManageInventory: boolean;
}
```

---

## API GROUP 2: RESTAURANTS

### POST /restaurants
Auth: none (public onboarding)
Request: { name: string, address?: string, billingEmail?: string }
Response: { id, name, address, billingEmail, createdAt }
Notes: Creates restaurant + trial subscription atomically.

### GET /restaurants/:id
Auth: Bearer (admin)
Response: { id, name, address, billingEmail, createdAt, subscription?: { plan, status, expiresAt, graceExpiresAt } }

### PATCH /restaurants/:id
Auth: Bearer (admin)
Request: { name?: string, address?: string, billingEmail?: string } (at least one field)
Response: same as GET

### DELETE /restaurants/:id
Auth: Bearer (admin)
Response: 204 No Content

---

## API GROUP 3: SUBSCRIPTIONS

### GET /restaurants/:id/subscription
Auth: Bearer (admin)
Response:
```typescript
{
  id: number;
  restaurantId: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  maxBranches: number;
  startedAt: string;
  expiresAt: string | null;
  graceExpiresAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}
```

### POST /restaurants/:id/subscription/upgrade
Auth: Bearer (admin)
Request: { plan: 'monthly' | 'yearly', maxBranches: number (1-50), expiresAt: string (ISO datetime) }
Response: same as GET subscription
Notes: Creates new subscription row, cancels old. Grace = expiresAt + SUBSCRIPTION_GRACE_DAYS.

### POST /restaurants/:id/subscription/cancel
Auth: Bearer (admin)
Request: { reason?: string }
Response: updated subscription object

### GET /restaurants/:id/subscriptions
Auth: Bearer (admin)
Response: Array of subscription objects (full billing history)

---

## API GROUP 4: BRANCHES

### GET /branches
Auth: Bearer (staff+)
Response: BranchDto[]
Notes: staff role → filtered to their branchId only. manager/admin → all branches.
```typescript
interface BranchDto {
  id: number;
  restaurantId: number;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}
```

### POST /branches
Auth: Bearer (admin)
Request: { name: string, address?: string, phone?: string }
Response: BranchDto
Errors: 402 NO_ACTIVE_SUBSCRIPTION, 403 BRANCH_LIMIT_REACHED

### GET /branches/:branchId
Auth: Bearer (staff+)
Response: BranchDto

### PATCH /branches/:branchId
Auth: Bearer (manager+)
Request: { name?: string, address?: string, phone?: string }
Response: BranchDto

### DELETE /branches/:branchId
Auth: Bearer (admin)
Response: 204

### PATCH /branches/:branchId/toggle
Auth: Bearer (admin)
Request: {} (empty — toggles isActive)
Response: BranchDto (with new isActive value)

---

## API GROUP 5: SECTIONS

All section routes: /branches/:branchId/sections/...

### GET /branches/:branchId/sections
Auth: Bearer (staff+)
Response:
```typescript
interface SectionDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: string;
}
```

### POST /branches/:branchId/sections
Auth: Bearer (manager+)
Request: { name: string, sortOrder?: number (default 0) }
Response: SectionDto

### PATCH /branches/:branchId/sections/:sectionId
Auth: Bearer (manager+)
Request: { name?: string, sortOrder?: number }
Response: SectionDto

### DELETE /branches/:branchId/sections/:sectionId
Auth: Bearer (manager+)
Response: 204
Errors: 409 SECTION_HAS_TABLES

---

## API GROUP 6: TABLES

### GET /branches/:branchId/tables
Auth: Bearer (staff+)
Query: ?sectionId=<id>&status=available|occupied|cleaning
Response:
```typescript
interface TableDto {
  id: number;
  branchId: number;
  sectionId: number;
  tableNumber: number;
  label: string | null;
  status: TableStatus;
  createdAt: string;
}
```

### POST /branches/:branchId/tables
Auth: Bearer (manager+)
Request: { sectionId: number, tableNumber: number, label?: string }
Response: TableDto
Errors: 409 TABLE_NUMBER_CONFLICT

### PATCH /branches/:branchId/tables/:tableId
Auth: Bearer (manager+)
Request: { tableNumber?: number, label?: string }
Response: TableDto
NOTE: Status NEVER updated via PATCH. Use dedicated transition endpoints.

### DELETE /branches/:branchId/tables/:tableId
Auth: Bearer (manager+)
Response: 204
Errors: 409 TABLE_NOT_AVAILABLE (must be 'available' status first)

### GET /tables/:tableId/qr
Auth: Bearer (manager+)
Accept: application/json → { tableId, tableNumber, qrToken, svg: string }
Accept: image/svg+xml → raw SVG data
Notes: qrToken is 64-char hex. svg is self-contained SVG string. Display inline or offer download.

### POST /tables/:tableId/regenerate-qr
Auth: Bearer (manager+)
Response: { tableId, tableNumber, qrToken, svg }
Notes: Invalidates all existing printed QR codes for this table.

### POST /tables/:tableId/cleaning
Auth: Bearer (staff+)
Response: TableDto (with status='cleaning')
Errors: 409 INVALID_STATUS_TRANSITION (must be 'occupied')

### POST /tables/:tableId/available
Auth: Bearer (staff+)
Response: TableDto (with status='available')
Errors: 409 INVALID_STATUS_TRANSITION (must be 'cleaning')

---

## API GROUP 7: MENU CATEGORIES

All under /branches/:branchId/menu/categories/...

### GET /branches/:branchId/menu/categories
Auth: Bearer (staff+)
Response:
```typescript
interface CategoryDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
  createdAt: string;
}
```

### POST /branches/:branchId/menu/categories
Auth: Bearer (manager+)
Request: { name: string, sortOrder?: number }
Response: CategoryDto

### PATCH /branches/:branchId/menu/categories/reorder
Auth: Bearer (manager+)
Request: { order: Array<{ id: number, sortOrder: number }> }
Response: CategoryDto[] (all categories with new sort orders)
Notes: Bulk update. All IDs must belong to this branch.

### PATCH /branches/:branchId/menu/categories/:categoryId
Auth: Bearer (manager+)
Request: { name?: string, sortOrder?: number }
Response: CategoryDto

### DELETE /branches/:branchId/menu/categories/:categoryId
Auth: Bearer (manager+)
Response: 204
Errors: 409 CATEGORY_HAS_ITEMS

---

## API GROUP 8: MENU ITEMS

### POST /menu/categories/:categoryId/items
Auth: Bearer (manager+)
Request:
```typescript
{
  name: string;           // max 150
  description?: string;  // max 1000
  basePrice: number;     // positive
  imageUrl?: string;     // URL, max 500
  isAvailable?: boolean; // default true
  sortOrder?: number;    // default 0
}
```
Response: MenuItemDto (see below)

### GET /menu/items/:itemId
Auth: Bearer (staff+)
Response:
```typescript
interface MenuItemDto {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  disableNote: string | null;
  sortOrder: number;
  createdAt: string;
  optionGroups: OptionGroupDto[];
}

interface OptionGroupDto {
  id: number;
  menuItemId: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: OptionDto[];
}

interface OptionDto {
  id: number;
  groupId: number;
  name: string;
  priceModifier: number;
  sortOrder: number;
}
```

### PATCH /menu/items/:itemId
Auth: Bearer (manager+)
Request: { name?, description?, basePrice?, imageUrl?, sortOrder? } (at least one)
Response: MenuItemDto
Notes: Writes audit log with old/new diff. imageUrl can be set to null to remove.

### PATCH /menu/items/:itemId/availability
Auth: Bearer (staff+)
Request: { isAvailable: boolean, disableNote?: string | null }
Response: MenuItemDto (without optionGroups)
Notes: disableNote auto-cleared when isAvailable=true. Shown to customers when item unavailable.

### DELETE /menu/items/:itemId
Auth: Bearer (manager+)
Response: 204

---

## API GROUP 9: MENU VARIANTS

All under /menu/items/:itemId/variants/...

### POST /menu/items/:itemId/variants
Auth: Bearer (manager+)
Request:
```typescript
{
  name: string;          // group name, e.g. "Type", max 100
  isRequired: boolean;   // default true
  sortOrder?: number;
  options?: Array<{      // optional seed options
    name: string;
    priceModifier?: number;  // default 0
    sortOrder?: number;
  }>;
}
```
Response:
```typescript
interface VariantGroupDto {
  id: number;
  menuItemId: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: OptionDto[];
}
```

### PATCH /menu/items/:itemId/variants/:variantId
Auth: Bearer (manager+)
Request: { name?: string, isRequired?: boolean, sortOrder?: number }
Response: VariantGroupDto

### DELETE /menu/items/:itemId/variants/:variantId
Auth: Bearer (manager+)
Response: 204
Notes: Also soft-deletes all child options atomically.

### POST /menu/items/:itemId/variants/:variantId/options
Auth: Bearer (manager+)
Request: { name: string, priceModifier?: number, sortOrder?: number }
Response: OptionDto

### PATCH /menu/items/:itemId/variants/:variantId/options/:optionId
Auth: Bearer (manager+)
Request: { name?, priceModifier?, sortOrder? }
Response: OptionDto

### DELETE /menu/items/:itemId/variants/:variantId/options/:optionId
Auth: Bearer (manager+)
Response: 204
Errors: 409 LAST_REQUIRED_OPTION (cannot delete last option of required group)

---

## API GROUP 10: SESSIONS (Staff)

### GET /branches/:branchId/sessions/active
Auth: Bearer (staff+)
Response:
```typescript
interface SessionSummaryDto {
  id: number;
  tableId: number;
  tableNumber: number;
  tableLabel: string | null;
  sectionName: string;
  branchId: number;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  memberCount: number;
}
```

### GET /sessions/:sessionId
Auth: Bearer (staff+)
Response:
```typescript
interface SessionDetailDto extends SessionSummaryDto {
  members: Array<{ id: number, name: string, phone: string | null, joinedAt: string }>;
  orderCount: number;
  totalRevenue: number;
}
```

### POST /sessions/:sessionId/close
Auth: Bearer (staff+)
Request: {} (no body)
Response: SessionSummaryDto
Notes: Sets status=completed, table→cleaning, inserts notification.
No guards — staff authority supersedes customer flow.

---

## API GROUP 11: ORDERS (Staff)

### GET /branches/:branchId/orders
Auth: Bearer (staff+)
Query: ?status=<OrderStatus>&orderType=dine_in|parcel&from=YYYY-MM-DD&to=YYYY-MM-DD&updatedAfter=<ISO>&page=1&limit=20
Response: Paginated OrderDto[]
```typescript
interface OrderDto {
  id: number;
  sessionId: number | null;
  branchId: number;
  memberId: number | null;
  orderType: OrderType;
  isParcel: boolean;
  customerName: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  note: string | null;
  acceptedByStaffId: number | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

interface OrderItemDto {
  id: number;
  menuItemId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  status: ItemStatus;
  note: string | null;
}
```

### GET /orders/:orderId
Auth: Bearer (staff+)
Response: OrderDto

### PATCH /orders/:orderId/status
Auth: Bearer (staff+)
Request: { status: 'confirmed' }  ← ONLY valid value
Response: OrderDto
Notes: Sets acceptedByStaffId to current staff. ONLY manual order transition allowed.
Errors: 409 INVALID_STATUS_TRANSITION (order must be 'pending')

### PATCH /orders/:orderId/cancel
Auth: Bearer (staff+)
Request: { reason: string }  ← REQUIRED
Response: OrderDto
Notes: Cancels order AND all non-terminal items. Logs to activity_logs.
Errors: 409 ALREADY_CANCELLED, 409 ORDER_DELIVERED

### PATCH /orders/:orderId/items/:itemId/cancel
Auth: Bearer (staff+)
Request: { reason: string }  ← REQUIRED
Response: OrderDto (full order with updated items)
Notes: Re-derives order status after item cancel.
Errors: 409 ALREADY_CANCELLED, 409 ITEM_DELIVERED

### POST /orders/parcel
Auth: Bearer (staff+)
Request:
```typescript
{
  customerName: string;   // max 100, required
  customerPhone: string;  // max 20, required
  note?: string;
  items: Array<{
    menuItemId: number;
    variantId?: number;
    quantity: number;       // 1-50
    note?: string;
  }>;
}
```
Response: OrderDto (sessionId=null, memberId=null, orderType='parcel', isParcel=true)

---

## API GROUP 12: KITCHEN / KDS

### GET /branches/:branchId/kitchen/orders
Auth: Bearer (staff+)
Query: ?updatedAfter=<ISO>
Response: KdsOrderDto[]
```typescript
interface KdsOrderDto {
  id: number;
  sessionId: number | null;
  orderType: OrderType;
  isParcel: boolean;
  customerName: string | null;
  tableNumber: number | null;
  sectionName: string | null;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: KdsItemDto[];
}

interface KdsItemDto {
  id: number;
  orderId: number;
  menuItemId: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  note: string | null;
  status: ItemStatus;
}
```
Notes: Returns orders with status in ['confirmed', 'preparing', 'ready']. Oldest first.

### GET /branches/:branchId/kitchen/queue
Auth: Bearer (staff+)
Query: ?updatedAfter=<ISO>
Response: KdsQueueDto[]
```typescript
interface KdsQueueDto {
  orderId: number;
  tableNumber: number | null;
  orderType: OrderType;
  isParcel: boolean;
  customerName: string | null;
  createdAt: string;
  pendingItems: KdsItemDto[];
  preparingItems: KdsItemDto[];
}
```
Notes: Only orders with pending or preparing items. No ready/delivered items included.

### PATCH /order-items/:itemId/preparing
Auth: Bearer (staff+)
Request: {}
Response: KdsItemDto (with status='preparing')
Errors: 409 INVALID_STATUS_TRANSITION (must be 'pending')

### PATCH /order-items/:itemId/ready
Auth: Bearer (staff+)
Request: {}
Response: KdsItemDto (with status='ready')
Errors: 409 INVALID_STATUS_TRANSITION (must be 'preparing')

### PATCH /order-items/:itemId/delivered
Auth: Bearer (staff+)
Request: {}
Response: KdsItemDto (with status='delivered')
Errors: 409 INVALID_STATUS_TRANSITION (must be 'ready')

---

## API GROUP 13: PAYMENTS (Staff)

### GET /sessions/:sessionId/payments
Auth: Bearer (staff+)
Response: PaymentDto[]
```typescript
interface PaymentDto {
  id: number;
  sessionId: number;
  orderId: number | null;
  memberId: number | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  esewaRefId: string | null;
  esewaPid: string | null;
  paidAt: string | null;
  createdAt: string;
}
```
Notes: Negative amounts = refunds.

### GET /orders/:orderId/payments
Auth: Bearer (staff+)
Response: PaymentDto[]

### POST /payments/esewa/verify
Auth: none (public webhook, called by eSewa)
Request: { oid: string, amt: string, refId: string }
Response: { verified: boolean, paymentId: number }
Notes: Frontend NEVER calls this. Backend-only endpoint.

### POST /payments/:paymentId/refund
Auth: Bearer (manager+)
Request: { amount: number, reason: string }
Response: PaymentDto (the NEW refund row, amount is negative)
Errors: 409 PAYMENT_NOT_COMPLETED, 400 REFUND_EXCEEDS_ORIGINAL
Notes: Append-only — creates new negative-amount row. Original row unchanged.

---

## API GROUP 14: INVOICES (Staff)

### GET /sessions/:sessionId/invoice
Auth: Bearer (staff+)
Response: InvoiceDto (see SECTION 17 in ARCHITECTURE file)

### GET /sessions/:sessionId/invoice/pdf
Auth: Bearer (staff+)
Response: application/pdf (binary stream)
Notes: Frontend opens in new browser tab: window.open(url, '_blank')
Must include Authorization header → use XMLHttpRequest or fetch with blob, not <a> tag.

### GET /orders/:orderId/invoice
Auth: Bearer (staff+)
Response: InvoiceDto

### GET /orders/:orderId/invoice/pdf
Auth: Bearer (staff+)
Response: application/pdf (binary stream)

---

## API GROUP 15: STAFF MANAGEMENT

### GET /staff
Auth: Bearer (admin)
Query: ?page=1&limit=20
Response: Paginated StaffDto[]
```typescript
interface StaffDto {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  branchId: number | null;
  isActive: boolean;
  oauthProvider: string;
  createdAt: string;
}
```

### POST /staff/invite
Auth: Bearer (admin)
Request: { name: string, email: string, role: StaffRole, branchId?: number }
Response: StaffDto (with isActive=false)
Notes: Pre-creates record. Staff cannot log in until whitelisted.
Errors: 409 EMAIL_EXISTS

### PATCH /staff/:staffId/whitelist
Auth: Bearer (admin)
Request: {}
Response: StaffDto (with isActive=true)
Errors: 409 ALREADY_ACTIVE

### PATCH /staff/:staffId/suspend
Auth: Bearer (admin)
Request: {}
Response: StaffDto (with isActive=false)

### PATCH /staff/:staffId/role
Auth: Bearer (admin)
Request: { role: StaffRole, branchId?: number | null }
Response: StaffDto

### GET /staff/:staffId/logs
Auth: Bearer (admin)
Query: ?page=1&limit=20
Response: Paginated ActivityLogDto[]
```typescript
interface ActivityLogDto {
  id: number;
  staffId: number;
  branchId: number | null;
  actionType: string;
  targetType: string;
  targetId: number;
  meta: unknown;
  createdAt: string;
}
```

### DELETE /staff/:staffId
Auth: Bearer (admin)
Response: 204

---

## API GROUP 16: WAITER REQUESTS (Staff)

### GET /branches/:branchId/waiter-requests
Auth: Bearer (staff+)
Query: ?status=pending|acknowledged|resolved&updatedAfter=<ISO>
Response: WaiterRequestDto[]
```typescript
interface WaiterRequestDto {
  id: number;
  sessionId: number;
  type: RequestType;
  status: RequestStatus;
  resolvedBy: number | null;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}
```

### PATCH /waiter-requests/:requestId/acknowledge
Auth: Bearer (staff+)
Request: {}
Response: WaiterRequestDto
Errors: 409 INVALID_TRANSITION (must be 'pending')

### PATCH /waiter-requests/:requestId/resolve
Auth: Bearer (staff+)
Request: {}
Response: WaiterRequestDto
Errors: 409 ALREADY_RESOLVED

---

## API GROUP 17: INVENTORY

### GET /branches/:branchId/inventory/categories
Auth: Bearer (staff+)
Response: InventoryCategoryDto[]
```typescript
interface InventoryCategoryDto {
  id: number;
  branchId: number;
  name: string;
  sortOrder: number;
}
```

### POST /branches/:branchId/inventory/categories
Auth: Bearer (manager+)
Request: { name: string, sortOrder?: number }
Response: InventoryCategoryDto

### PATCH /branches/:branchId/inventory/categories/:categoryId
Auth: Bearer (manager+)
Request: { name?, sortOrder? }
Response: InventoryCategoryDto

### DELETE /branches/:branchId/inventory/categories/:categoryId
Auth: Bearer (manager+)
Response: 204

### GET /branches/:branchId/inventory
Auth: Bearer (staff+)
Response: InventoryItemDto[]
```typescript
interface InventoryItemDto {
  id: number;
  branchId: number;
  categoryId: number | null;
  name: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;   // computed: threshold>0 && quantity<=threshold
}
```

### GET /branches/:branchId/inventory/low-stock
Auth: Bearer (staff+)
Response: InventoryItemDto[] (only items where isLowStock=true)

### POST /branches/:branchId/inventory
Auth: Bearer (manager+)
Request: { name, unit, categoryId?, quantity?, lowStockThreshold? }
Response: InventoryItemDto

### PATCH /branches/:branchId/inventory/:itemId
Auth: Bearer (manager+)
Request: { name?, unit?, categoryId?, lowStockThreshold? }
Response: InventoryItemDto
Notes: Does NOT update quantity. Use /adjust for stock changes.

### POST /branches/:branchId/inventory/:itemId/adjust
Auth: Bearer (staff+)
Request:
```typescript
{
  changeType: 'add' | 'remove' | 'adjust';
  quantityDelta: number;  // nonzero; negative for removals
  note?: string;
}
```
Response: InventoryItemDto (with updated quantity)
Errors: 400 INSUFFICIENT_STOCK (remove > available)
Notes: ALWAYS atomic — writes inventory_log row in same transaction.

### GET /branches/:branchId/inventory/:itemId/logs
Auth: Bearer (manager+)
Query: ?page=1&limit=20
Response: Paginated InventoryLogDto[]
```typescript
interface InventoryLogDto {
  id: number;
  itemId: number;
  changedBy: number;
  changeType: InvChangeType;
  quantityDelta: number;
  note: string | null;
  createdAt: string;
}
```

### DELETE /branches/:branchId/inventory/:itemId
Auth: Bearer (manager+)
Response: 204

---

## API GROUP 18: BILLS

### GET /branches/:branchId/bills
Auth: Bearer (manager+)
Query: ?status=unpaid|paid|overdue&page=1&limit=20
Response: Paginated BillDto[]
```typescript
interface BillDto {
  id: number;
  branchId: number;
  type: BillType;
  status: BillStatus;
  amount: number;
  dueDate: string;     // YYYY-MM-DD format
  paidDate: string | null;
  note: string | null;
  createdAt: string;
}
```

### POST /branches/:branchId/bills
Auth: Bearer (manager+)
Request: { type: BillType, amount: number, dueDate: string (YYYY-MM-DD), note?: string }
Response: BillDto

### PATCH /branches/:branchId/bills/:billId
Auth: Bearer (manager+)
Request: { amount?, dueDate?, note? }
Response: BillDto

### PATCH /branches/:branchId/bills/:billId/pay
Auth: Bearer (manager+)
Request: {}
Response: BillDto (status='paid', paidDate set)
Errors: 409 ALREADY_PAID

### DELETE /branches/:branchId/bills/:billId
Auth: Bearer (admin)
Response: 204

---

## API GROUP 19: DASHBOARD

### GET /dashboard
Auth: Bearer (staff+)
Response:
```typescript
interface StaffDashboardDto {
  activeOrders: number;
  activeSessions: number;
  tables: { available: number; occupied: number; cleaning: number };
  pendingWaiterCalls: number;
  revenueToday: number;
  ordersToday: number;
  lowStockItems: number;
}
```
Notes: revenueToday from snapshot table (may be 0 before 00:05 daily job runs).

### GET /dashboard/branch/:branchId
Auth: Bearer (manager+)
Response:
```typescript
interface BranchDashboardDto {
  branchId: number;
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  dineinOrders: number;
  parcelOrders: number;
  totalSessions: number;
  totalCustomers: number;
  avgOrderValue: number | null;
  completedPayments: number;
}
```

### GET /dashboard/admin
Auth: Bearer (admin)
Response:
```typescript
interface AdminDashboardDto {
  restaurantId: number;
  subscription: { plan: string; status: string; expiresAt: string | null } | null;
  branches: Array<{
    branchId: number;
    branchName: string;
    revenueToday: number;
    ordersToday: number;
    activeSessions: number;
  }>;
  totalRevenueToday: number;
  topBranchId: number | null;
}
```

---

## API GROUP 20: ANALYTICS

All analytics endpoints:
- Auth: Bearer (manager+)
- Base: /branches/:branchId/analytics/
- Query params: ?period=today|week|month|year OR ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10

### GET /branches/:branchId/analytics/revenue
Response:
```typescript
{
  period: { from: string; to: string };
  totalRevenue: number;
  cashRevenue: number;
  onlineRevenue: number;
  dineinRevenue: number;
  parcelRevenue: number;
  byDay: Array<{ date: string; revenue: number }>;
}
```

### GET /branches/:branchId/analytics/orders
Response:
```typescript
{
  period: { from: string; to: string };
  totalOrders: number;
  cancelledOrders: number;
  dineinOrders: number;
  parcelOrders: number;
  byDay: Array<{ date: string; orders: number }>;
}
```

### GET /branches/:branchId/analytics/payments
Response:
```typescript
{
  period: { from: string; to: string };
  cashRevenue: number;
  onlineRevenue: number;
  completedPayments: number;
  cashPercentage: number;
  onlinePercentage: number;
}
```

### GET /branches/:branchId/analytics/peak-hours
Response:
```typescript
{
  branchId: number;
  hours: Array<{ hour: number; orderCount: number }>;  // 0-23, last 30 days
}
```
Notes: NO period param for this endpoint. Always last 30 days. Queries raw orders (not snapshot).

### GET /branches/:branchId/analytics/top-dishes
Query: + ?limit=10
Response:
```typescript
Array<{
  menuItemId: number;
  name: string;
  quantitySold: number;
  revenueGenerated: number;
}>
```
Sorted by quantitySold DESC.

### GET /branches/:branchId/analytics/worst-dishes
Query: + ?limit=10
Response: same shape as top-dishes, sorted by quantitySold ASC

### GET /branches/:branchId/analytics/dish-sales
Response: same shape as top-dishes, sorted by revenueGenerated DESC (all items)

### GET /branches/:branchId/analytics/table-utilization
Response:
```typescript
Array<{
  tableId: number;
  tableNumber: number;
  sectionName: string;
  sessionCount: number;
  avgOccupancyMinutes: number | null;
}>
```
Sorted by sessionCount DESC.

### GET /branches/:branchId/analytics/session-duration
Response:
```typescript
{
  period: { from: string; to: string };
  avgDurationMinutes: number | null;
  totalSessions: number;
}
```

### GET /branches/:branchId/analytics/customer-trends
Response:
```typescript
{
  period: { from: string; to: string };
  totalCustomers: number;
  avgPartySize: number | null;
  byDay: Array<{ date: string; customers: number }>;
}
```

### GET /branches/:branchId/analytics/staff-performance
Response:
```typescript
Array<{
  staffId: number;
  staffName: string;
  ordersHandled: number;
  salesAmount: number;
  cancelledOrders: number;
  avgOrderCompletionSeconds: number | null;
}>
```
Sorted by salesAmount DESC.

### GET /restaurants/:id/analytics/branch-comparison
Auth: Bearer (admin)
Response:
```typescript
Array<{
  branchId: number;
  branchName: string;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number | null;
}>
```
Sorted by totalRevenue DESC.

---

## API GROUP 21: NOTIFICATIONS

### GET /notifications
Auth: Bearer (staff+)
Query: ?updatedAfter=<ISO>&page=1&limit=20
Response: Paginated NotificationDto[]
```typescript
interface NotificationDto {
  id: string;              // BigInt serialized as string
  restaurantId: number;
  branchId: number | null;
  staffId: number | null;
  type: NotificationType;
  title: string;
  message: string | null;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
}
```
Notes: Returns notifications for current staff AND branch-wide (staffId=null) notifications.

### PATCH /notifications/:notificationId/read
Auth: Bearer (staff+)
Request: {}
Response: NotificationDto

### PATCH /notifications/read-all
Auth: Bearer (staff+)
Request: {}
Response: 204

---

## API GROUP 22: FEEDBACK (Staff View)

### GET /branches/:branchId/feedback
Auth: Bearer (manager+)
Query: ?page=1&limit=20
Response:
```typescript
{
  branchId: number;
  avgRating: number | null;
  totalResponses: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  recent: Array<{
    id: number;
    sessionId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}
```

---

## API GROUP 23: CUSTOMER QR SCAN (Public)

### POST /customer/qr/scan
Auth: none (public, rate-limited)
Request:
```typescript
{
  qrToken: string;      // exactly 64 chars hex
  name?: string;        // customer name (optional; defaults to 'Guest')
  phone?: string;       // optional
}
```
Response:
```typescript
{
  memberToken: string;
  session: {
    id: number;
    status: SessionStatus;
    tableId: number;
    tableNumber: number;
    tableLabel: string | null;
    sectionName: string;
    branchId: number;
    branchName: string;
    isNew: boolean;      // true if this scan created a new session
  };
  memberId: number;
  menuUrl: string;       // ${CUSTOMER_APP_URL}/menu
}
```
Errors: 404 QR_NOT_FOUND, 403 BRANCH_UNAVAILABLE, 403 SUBSCRIPTION_INACTIVE
Notes: memberToken must be stored in localStorage. Decode to get sessionId, branchId etc.
Rate limited: implement exponential backoff on 429.

---

## API GROUP 24: CUSTOMER SESSION

### GET /customer/session
Auth: Bearer <memberToken>
Response:
```typescript
interface CustomerSessionDto {
  id: number;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  table: {
    id: number;
    tableNumber: number;
    label: string | null;
    sectionName: string;
  };
  members: Array<{ id: number; name: string; joinedAt: string }>;
  memberCount: number;
}
```

### POST /customer/session/leave
Auth: Bearer <memberToken>
Request: {}
Response: { message: string }
Notes: Removes this member. If last member + no orders → session abandoned, table freed.
If last member + orders exist → session stays active, staff notified.

### POST /customer/session/complete
Auth: Bearer <memberToken>
Request: {}
Response: { message: string }
Errors:
  409 SESSION_NOT_ACTIVE (already completed)
  409 ORDERS_NOT_COMPLETE (undelivered items remain)
  409 PAYMENT_REQUIRED (outstanding balance > 0)
Notes: Guards enforced server-side. Frontend should also check before showing button.

---

## API GROUP 25: CUSTOMER MENU

### GET /customer/menu
Auth: Bearer <memberToken>
Response: CustomerMenuCategoryDto[]
```typescript
interface CustomerMenuCategoryDto {
  id: number;
  name: string;
  sortOrder: number;
  items: CustomerMenuItemDto[];
}

interface CustomerMenuItemDto {
  id: number;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isAvailable: boolean;
  disableNote: string | null;   // only non-null when isAvailable=false
  sortOrder: number;
  optionGroups: CustomerOptionGroupDto[];
}

interface CustomerOptionGroupDto {
  id: number;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: Array<{
    id: number;
    name: string;
    priceModifier: number;
    sortOrder: number;
  }>;
}
```
Notes: Branch derived from memberToken. Unavailable items ARE included (show greyed out).

### GET /customer/menu/categories
Auth: Bearer <memberToken>
Response: Array<{ id: number; name: string; sortOrder: number }>
Notes: Lightweight, no items. For tab navigation.

### GET /customer/menu/items/:itemId
Auth: Bearer <memberToken>
Response: CustomerMenuItemDto (same as above with optionGroups)

---

## API GROUP 26: CUSTOMER ORDERS

### POST /customer/orders
Auth: Bearer <memberToken>
Request:
```typescript
{
  note?: string;
  items: Array<{
    menuItemId: number;
    variantId?: number;
    quantity: number;    // 1-50
    note?: string;       // per-item note, max 255
  }>;
}
```
Response: CustomerOrderDto
```typescript
interface CustomerOrderDto {
  id: number;
  sessionId: number;
  orderType: 'dine_in';
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: CustomerOrderItemDto[];
  subtotal: number;        // sum of unitPrice*quantity for non-cancelled items
}

interface CustomerOrderItemDto {
  id: number;
  menuItemId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  status: ItemStatus;
  note: string | null;
}
```
Errors: 400 SESSION_NOT_ACTIVE, 400 ITEM_NOT_FOUND, 400 ITEM_UNAVAILABLE, 400 VARIANT_NOT_FOUND

### GET /customer/orders
Auth: Bearer <memberToken>
Query: ?updatedAfter=<ISO>
Response: CustomerOrderDto[] (all orders in current session, oldest first)

### GET /customer/orders/:orderId
Auth: Bearer <memberToken>
Response: CustomerOrderDto
Notes: Verifies order belongs to this member's session. Access controlled by JWT sessionId.

### POST /customer/orders/:orderId/items
Auth: Bearer <memberToken>
Request: { items: Array<{ menuItemId, variantId?, quantity, note? }> }
Response: CustomerOrderDto (with new items added)
Errors: 409 ORDER_NOT_PENDING (cannot add to confirmed/preparing order)

### POST /customer/orders/:orderId/cancel
Auth: Bearer <memberToken>
Request: {}
Response: CustomerOrderDto
Errors: 409 CANNOT_CANCEL (order not in 'pending' status)

---

## API GROUP 27: CUSTOMER PAYMENTS

### POST /customer/payments
Auth: Bearer <memberToken>
Request:
```typescript
{
  method: 'cash' | 'esewa';
  orderIds?: number[];    // empty/omitted = full session balance
}
```
Response: CustomerPaymentDto
```typescript
interface CustomerPaymentDto {
  id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  esewaRefId: string | null;
  paidAt: string | null;
  createdAt: string;
}
```
Errors: 400 SESSION_NOT_ACTIVE, 400 ALREADY_PAID (no outstanding balance)
Notes: Cash → immediately marked 'completed'. eSewa → stays 'pending' until webhook.

### POST /customer/payments/esewa/initiate
Auth: Bearer <memberToken>
Request: { orderIds?: number[], successUrl: string, failureUrl: string }
Response:
```typescript
{
  paymentId: number;
  esewaPid: string;
  formParams: {
    amt: number;
    psc: number;
    pdc: number;
    txAmt: number;
    tAmt: number;
    pid: string;
    scd: string;
    su: string;
    fu: string;
  };
}
```
Notes: Frontend must POST formParams as HTML form to ESEWA_URL. DO NOT use fetch/XHR.
Use JavaScript to dynamically create and submit a form.

### GET /customer/payments
Auth: Bearer <memberToken>
Response: CustomerPaymentDto[] (all payments for current session)
Notes: Poll every 5s when waiting for eSewa confirmation.

---

## API GROUP 28: CUSTOMER INVOICES

### GET /customer/invoice
Auth: Bearer <memberToken>
Response: InvoiceDto (see SECTION 17 in ARCHITECTURE file)

### GET /customer/invoice/pdf
Auth: Bearer <memberToken>
Response: application/pdf (binary stream)
Notes: Fetch as blob, create object URL, open in new tab.

### GET /customer/orders/:orderId/invoice
Auth: Bearer <memberToken>
Response: InvoiceDto
Notes: Only orders belonging to this member's session are accessible.

### GET /customer/orders/:orderId/invoice/pdf
Auth: Bearer <memberToken>
Response: application/pdf

---

## API GROUP 29: CUSTOMER WAITER REQUESTS

### POST /customer/waiter-requests
Auth: Bearer <memberToken>
Request: { type: RequestType }
Response: WaiterRequestDto
Errors:
  400 SESSION_NOT_ACTIVE
  409 DUPLICATE_REQUEST (pending/acknowledged request of same type already exists)
Notes: Inserts notification for branch staff automatically.

### GET /customer/waiter-requests
Auth: Bearer <memberToken>
Query: ?updatedAfter=<ISO>
Response: WaiterRequestDto[]

---

## API GROUP 30: CUSTOMER FEEDBACK

### POST /customer/feedback
Auth: Bearer <memberToken>
Request: { rating: number (1-5), comment?: string (max 1000) }
Response: created/updated FeedbackDto
Notes: One submission per session. Second submission updates (upsert).

---

## SHARED UTILITY ENDPOINT

### GET /health
Auth: none
Response: { status: 'ok', uptime: number }

---

## IMPORTANT BUSINESS RULES (enforced server-side, reflected in UI)

1. PRICE_SNAPSHOT: Once an order is placed, item prices are frozen. Menu price changes do NOT affect existing orders. UI must show itemNameSnapshot and unitPrice from order, NOT from current menu.

2. PAYMENT_APPEND_ONLY: Payments are never updated. Each payment is a new row. Refunds are new rows with negative amounts. UI shows all payment rows; sum of positive amounts = total paid; sum of negative amounts = total refunded.

3. SESSION_CREATION: Sessions are NEVER created by staff. Only QR scan creates them. Staff "Close Session" closes an EXISTING session; it does not create one.

4. ORDER_STATUS_DERIVED: After pending→confirmed, order status changes automatically based on item statuses. Frontend should NEVER show a manual order status control beyond "Confirm Order" and "Cancel Order".

5. INVENTORY_MANUAL: No automatic stock deduction when orders are placed. Staff must manually adjust inventory. Frontend should NOT show real-time inventory impact of orders.

6. SOFT_DELETE: Records with deletedAt are never shown. Filter all list queries accordingly (backend handles this, but understand WHY items can disappear from lists).

7. OVERPAYMENT_GUARD: Customer cannot pay more than the outstanding balance. Frontend should compute and display the exact amount due before initiating payment.

8. QR_TOKEN_ENTROPY: QR tokens are 64-char hex strings (256-bit entropy). They are never sequential and never predictable. Regenerating invalidates ALL printed QR codes for that table.

9. BRANCH_SCOPING: All staff API calls are implicitly scoped to the staff's restaurant. The staff role is additionally scoped to their branchId. Admin sees all. Frontend must respect this when showing branch selectors.

10. MEMBER_SESSION_ISOLATION: Customer member tokens carry sessionId. They can ONLY access data for their own session. Backend enforces this. Frontend should not attempt cross-session access.
