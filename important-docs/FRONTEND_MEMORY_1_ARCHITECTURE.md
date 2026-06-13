# MAHAVI_FRONTEND_MEMORY_1_ARCHITECTURE
# Version: 1.0 | Generated from complete backend implementation
# Companion files: FRONTEND_MEMORY_2_API_CONTRACTS.md, FRONTEND_MEMORY_3_UI_SCREENS.md
# This file: stack decisions, auth flows, state machines, routing trees, permission matrices, global patterns, polling contracts, API client architecture

---

## SECTION 0: SYSTEM OVERVIEW

MaHaVi is a Restaurant SaaS with TWO completely separate frontend applications:

APP_1: STAFF_APP — web dashboard used by restaurant owners, managers, and floor/kitchen staff
APP_2: CUSTOMER_APP — mobile-first web app accessed exclusively via QR code scan at a table

These apps have completely different auth contexts, JWT types, and API surface areas. They MUST be built as separate apps (separate Vite projects, separate deployments, separate domains). They share NO state, NO auth tokens, NO routing.

BASE_URL: All API calls prefix with `https://<backend-domain>/api/v1`
STAFF_APP_URL: Set in env; used by backend for OAuth redirect
CUSTOMER_APP_URL: Set in env; QR codes encode `${CUSTOMER_APP_URL}/scan?token=<qrToken>`

---

## SECTION 1: TECH STACK DECISION

Both apps use identical stack:
- React 18 + TypeScript (strict mode)
- Vite (build tool)
- React Router v6 (routing)
- TanStack Query v5 (server state, caching, polling)
- Zustand (client-only auth state, member token state)
- React Hook Form + Zod (all form validation; Zod schemas MUST mirror backend schemas)
- Axios (HTTP client with interceptors)
- Tailwind CSS (styling)
- Lucide React (icons)
- React Hot Toast (notifications/toasts)
- date-fns (date formatting/manipulation)
- recharts (analytics charts)

NO Redux. NO MobX. TanStack Query is the ONLY server state manager.
Zustand is ONLY for: auth tokens, user profile, current role context.

---

## SECTION 2: STAFF APP — AUTH FLOW STATE MACHINE

### 2.1 Token Architecture

STAFF uses TWO tokens:
- ACCESS_TOKEN: JWT, 15-minute TTL, stored in memory (Zustand), NEVER localStorage
- REFRESH_TOKEN: httpOnly cookie, 7-day TTL, set by backend, NOT accessible to JS

ACCESS_TOKEN payload (decoded):
```typescript
interface AccessTokenPayload {
  sub: number;           // staff_users.id
  restaurantId: number;
  branchId: number | null;  // null for admin role
  role: 'staff' | 'manager' | 'admin';
  jti: string;
}
```

### 2.2 Auth State Machine

```
STATES: unauthenticated | loading | authenticated | suspended | error

unauthenticated:
  TRIGGER: app load → check if refresh token cookie exists
  ACTION: attempt silent refresh via POST /auth/refresh
  → SUCCESS: transition to authenticated
  → FAIL (401/403): stay unauthenticated, show login screen

loading:
  TRIGGER: OAuth redirect in progress OR refresh in flight
  ACTION: show full-screen spinner

authenticated:
  TRIGGER: access token in memory + user profile loaded
  DATA: { user: StaffProfile, accessToken: string, role, branchId, restaurantId }
  EXPIRY: token expires in 15min → auto-refresh 2min before expiry via setInterval
  REFRESH_INTERVAL: set when token received: setTimeout(refresh, (expiresIn - 120) * 1000)

suspended:
  TRIGGER: API returns 401 with code IS_SUSPENDED or is_active=false
  ACTION: clear Zustand, show "Account suspended" screen, NO redirect to login

error:
  TRIGGER: network failure during initial auth check
  ACTION: show retry button
```

### 2.3 Login Flow

NO username/password login exists. Staff login is Google OAuth ONLY.

```
1. User clicks "Sign in with Google"
2. Frontend redirects to GET /api/v1/auth/google
3. Backend handles OAuth, redirects to FRONTEND_URL/auth/callback?token=<accessToken>
   (refresh token set as httpOnly cookie by backend)
4. Frontend /auth/callback route: extract token from URL query param
5. Store accessToken in Zustand
6. Decode JWT to extract { sub, restaurantId, branchId, role }
7. Call GET /api/v1/auth/me to get full profile
8. Store profile in Zustand
9. Navigate to role-appropriate default route
10. Clear token from URL (replaceState)
```

DEFAULT ROUTES BY ROLE:
- admin → /dashboard/admin
- manager → /dashboard/branch
- staff → /dashboard

### 2.4 Token Refresh

```typescript
// On every Axios request that returns 401:
// 1. Queue all pending requests
// 2. Call POST /api/v1/auth/refresh (sends cookie automatically)
// 3. On success: update Zustand accessToken, retry queued requests
// 4. On failure: clear Zustand, redirect to /login
// IMPLEMENT as Axios interceptor with isRefreshing flag + requestQueue array
```

### 2.5 Logout

```
1. Call POST /api/v1/auth/logout (invalidates refresh token server-side)
2. Clear Zustand auth state
3. Redirect to /login
4. Backend clears cookie
```

### 2.6 Permission Enforcement (Frontend)

Role hierarchy: staff(1) < manager(2) < admin(3)

```typescript
// Zustand store provides:
const useAuthStore = create(() => ({
  user: null as StaffProfile | null,
  accessToken: null as string | null,
  role: null as 'staff' | 'manager' | 'admin' | null,
  branchId: null as number | null,
  restaurantId: null as number | null,
}));

// Permission check util:
function hasRole(required: 'staff' | 'manager' | 'admin'): boolean {
  const hierarchy = { staff: 1, manager: 2, admin: 3 };
  return hierarchy[currentRole] >= hierarchy[required];
}
```

Route-level permission guard component:
```typescript
// <RequireRole role="manager"> — redirects to /unauthorized if insufficient role
// <RequireRole role="admin"> — admin-only sections
```

Staff role is ALSO branch-scoped: staff can only see data for their assigned branchId.
Admin can see all branches. Manager sees their branch.

### 2.7 GET /me/permissions Response

```typescript
// Fetched after login, shapes which UI elements render
interface PermissionsDto {
  canManageMenu: boolean;        // manager+
  canViewAnalytics: boolean;     // manager+
  canManageStaff: boolean;       // admin only
  canManageBranches: boolean;    // admin only
  canManageSubscriptions: boolean; // admin only
  canManageBills: boolean;       // manager+
  canViewKitchen: boolean;       // staff+
  canConfirmOrders: boolean;     // staff+
  canManageInventory: boolean;   // staff+ (adjust), manager+ (create/delete)
}
```

---

## SECTION 3: CUSTOMER APP — AUTH FLOW STATE MACHINE

### 3.1 Token Architecture

MEMBER uses ONE token:
- MEMBER_TOKEN: JWT, 6-hour TTL, stored in localStorage (customer app), key: `mahavi_member_token`

MEMBER_TOKEN payload (decoded):
```typescript
interface MemberTokenPayload {
  sub: number;        // session_members.id
  sessionId: number;
  tableId: number;
  branchId: number;
  restaurantId: number;
}
```

### 3.2 Customer App State Machine

```
STATES: scanning | joining | active_session | session_complete | error

scanning:
  ENTRY: app load, no valid member token in localStorage
  OR: token exists but session is no longer active
  UI: "Scan a QR code to start" (deep link landing page at /scan?token=<qrToken>)

joining:
  TRIGGER: URL contains ?token=<64-char-hex>
  ACTION: POST /api/v1/customer/qr/scan with { qrToken, name? }
  → If no name and no existing session: show name prompt modal first
  → SUCCESS: store memberToken in localStorage, transition to active_session
  → FAIL: show error, stay in scanning state

active_session:
  ENTRY: valid memberToken in localStorage AND session.status === 'active'
  DATA: decoded JWT gives sessionId, tableId, branchId
  UI: full customer ordering experience
  PERSISTENCE: memberToken survives page refresh (localStorage)

session_complete:
  TRIGGER: GET /customer/session returns status !== 'active'
  OR: customer clicks "Complete Meal" and backend confirms
  UI: thank you screen, option to leave feedback, no re-ordering

error:
  TRIGGER: token invalid/expired, 401 on any customer request
  ACTION: clear localStorage, redirect to /scan
```

### 3.3 Customer App Entry Points

ONLY valid entry: `${CUSTOMER_APP_URL}/scan?token=<qrToken>`
QR code is printed on table tent/sticker. Customer scans → browser opens URL → app handles.

```typescript
// /scan route logic:
const qrToken = new URLSearchParams(location.search).get('token');
if (!qrToken) redirect('/error?reason=no_token');

// Check localStorage for existing valid token first
const existing = localStorage.getItem('mahavi_member_token');
if (existing) {
  const decoded = jwtDecode(existing);
  if (decoded.exp > Date.now() / 1000) {
    // Token still valid — skip scan, go directly to session
    navigate('/session');
    return;
  }
}
// No valid token: initiate scan
```

---

## SECTION 4: STAFF APP ROUTING TREE

```
/                           → redirect to /dashboard
/login                      → Google OAuth button
/auth/callback              → Handle OAuth redirect, extract token
/unauthorized               → Role gate failed

/dashboard                  → Staff dashboard (staff+)
/dashboard/branch           → Branch manager dashboard (manager+)
/dashboard/admin            → Admin cross-branch dashboard (admin)

/sessions                   → Active sessions list (staff+)
/sessions/:sessionId        → Session detail (staff+)

/orders                     → Order list with filters (staff+)
/orders/parcel/new          → Create parcel order (staff+)
/orders/:orderId            → Order detail (staff+)

/kitchen                    → KDS full board (staff+)
/kitchen/queue              → KDS queue view — pending+preparing only (staff+)

/menu                       → Menu category list (manager+)
/menu/categories            → Category management (manager+)
/menu/items/:itemId         → Item detail + variants (manager+)
/menu/items/:itemId/edit    → Edit item (manager+)

/tables                     → Tables grid by section (staff+)
/tables/:tableId            → Table detail + QR (manager+)

/inventory                  → Inventory items list (staff+)
/inventory/low-stock        → Low stock filtered view (staff+)
/inventory/:itemId/logs     → Item adjustment history (manager+)

/bills                      → Bills list (manager+)
/bills/new                  → Create bill (manager+)

/staff                      → Staff list (admin)
/staff/invite               → Invite staff form (admin)
/staff/:staffId             → Staff detail + logs (admin)

/analytics                  → Analytics hub (manager+)
/analytics/revenue          → Revenue charts (manager+)
/analytics/orders           → Order analytics (manager+)
/analytics/dishes           → Top/worst dishes (manager+)
/analytics/staff            → Staff performance (manager+)
/analytics/tables           → Table utilization (manager+)
/analytics/customers        → Customer trends (manager+)

/settings                   → Settings hub
/settings/restaurant        → Restaurant info (admin)
/settings/subscription      → Subscription management (admin)
/settings/branches          → Branch management (admin)
/settings/branches/:id      → Branch detail (admin)
/settings/sections          → Section management (manager+)
/settings/notifications     → Notification preferences

/notifications              → Notification list (staff+)

/payments/:sessionId        → Session payment list (staff+)

/invoices/session/:sessionId → Session invoice (staff+)
/invoices/order/:orderId    → Order invoice (staff+)

/feedback                   → Customer feedback list (manager+)
```

---

## SECTION 5: CUSTOMER APP ROUTING TREE

```
/                           → redirect to /scan or /session
/scan                       → QR entry point (handles ?token= param)
/session                    → Session overview + members
/menu                       → Full menu (categories + items)
/menu/category/:id          → Category filtered view
/menu/item/:id              → Item detail + variant picker + add to order
/orders                     → My orders in this session
/orders/:id                 → Single order detail + item statuses
/cart                       → Review items before placing order
/invoice                    → Session invoice (pre-payment)
/payment                    → Payment initiation (cash or eSewa)
/payment/esewa              → eSewa redirect flow
/payment/status             → Post-payment polling screen
/feedback                   → Submit feedback (1-5 stars + comment)
/complete                   → Session complete / thank you screen
/error                      → Generic error with reason param
```

---

## SECTION 6: API CLIENT ARCHITECTURE

### 6.1 Axios Instance — Staff App

```typescript
// staffApiClient.ts
const staffApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api/v1',
  withCredentials: true,  // REQUIRED for refresh token cookie
  timeout: 15000,
});

// Request interceptor: attach access token
staffApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 with token refresh
let isRefreshing = false;
let failedQueue: Array<{resolve: Function, reject: Function}> = [];

staffApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return staffApi(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await staffApi.post('/auth/refresh');
        const newToken = data.data.accessToken;
        useAuthStore.setState({ accessToken: newToken });
        failedQueue.forEach(p => p.resolve(newToken));
        failedQueue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return staffApi(original);
      } catch (refreshError) {
        failedQueue.forEach(p => p.reject(refreshError));
        failedQueue = [];
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
```

### 6.2 Axios Instance — Customer App

```typescript
// customerApiClient.ts
const customerApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api/v1',
  withCredentials: false,  // no cookies in customer app
  timeout: 15000,
});

customerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('mahavi_member_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

customerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mahavi_member_token');
      window.location.href = '/scan';  // force re-scan
    }
    return Promise.reject(error);
  }
);
```

### 6.3 Response Envelope Handling

ALL backend responses follow this envelope:
```typescript
// Success (single item or list without pagination):
{ success: true, data: T }

// Success (paginated list):
{ success: true, data: T[], meta: { page: number, limit: number, total: number } }

// Error:
{ success: false, error: string, code: string, details?: Array<{field: string, message: string}> }
```

Axios wrapper to extract data:
```typescript
async function get<T>(url: string): Promise<T> {
  const res = await api.get(url);
  return res.data.data;
}
// Always access res.data.data for single resources
// Always access res.data for paginated (need res.data.data and res.data.meta)
```

---

## SECTION 7: POLLING CONTRACTS

All polling uses TanStack Query `refetchInterval`. Polling only active when tab is focused (`refetchIntervalInBackground: false`). All polled endpoints support `?updatedAfter=<ISO>` for incremental fetching — ALWAYS pass last fetch timestamp.

### 7.1 Staff App Polling

```
GET /branches/:branchId/orders?updatedAfter=<ISO>        → 5s  (KDS + order list)
GET /branches/:branchId/kitchen/orders?updatedAfter=<ISO> → 5s  (KDS board)
GET /branches/:branchId/kitchen/queue?updatedAfter=<ISO>  → 5s  (KDS queue)
GET /notifications?updatedAfter=<ISO>                    → 10s (notification bell)
GET /branches/:branchId/waiter-requests?updatedAfter=<ISO>→ 10s (waiter call alerts)
GET /branches/:branchId/sessions/active                  → 15s (session list)
```

### 7.2 Customer App Polling

```
GET /customer/orders?updatedAfter=<ISO>          → 5s  (track item statuses)
GET /customer/session?updatedAfter=<ISO>          → 10s (session state changes)
GET /customer/waiter-requests?updatedAfter=<ISO>  → 10s (request ack/resolve)
GET /customer/payments?updatedAfter=<ISO>         → 5s  (eSewa confirmation)
```

### 7.3 Polling Implementation Pattern

```typescript
// TanStack Query polling with updatedAfter:
const lastFetchedAt = useRef<string>(new Date().toISOString());

const { data } = useQuery({
  queryKey: ['kitchen-orders', branchId, lastFetchedAt.current],
  queryFn: async () => {
    const result = await fetchKitchenOrders(branchId, lastFetchedAt.current);
    lastFetchedAt.current = new Date().toISOString();
    return result;
  },
  refetchInterval: 5000,
  refetchIntervalInBackground: false,
});
// NOTE: merge incremental results into existing cache — don't replace full list
```

---

## SECTION 8: PERMISSION MATRIX — STAFF APP UI GATING

Format: endpoint_action → minimum_role → UI visibility rule

```
BRANCH VISIBILITY:
  staff role → sees only their assigned branchId (from JWT)
  manager/admin → can see branch selector

NAVIGATION ITEMS:
  Dashboard: staff+
  Sessions: staff+
  Orders: staff+
  Kitchen/KDS: staff+
  Menu management: manager+ (staff can only toggle item availability)
  Tables: staff+ (view), manager+ (create/edit/QR)
  Inventory: staff+ (view + adjust), manager+ (create/delete)
  Bills: manager+
  Staff management: admin only
  Analytics: manager+
  Settings > Restaurant: admin
  Settings > Subscription: admin
  Settings > Branches: admin
  Settings > Sections: manager+
  Notifications: staff+
  Feedback reports: manager+

ACTION BUTTONS:
  "Confirm Order" (pending→confirmed): staff+
  "Mark Preparing" (KDS item): staff+
  "Mark Ready" (KDS item): staff+
  "Mark Delivered" (KDS item): staff+
  "Cancel Order": staff+ (shows reason input)
  "Cancel Item": staff+
  "Close Session": staff+
  "Mark Table Cleaning": staff+
  "Mark Table Available": staff+
  "Adjust Stock": staff+
  "Create Inventory Item": manager+
  "Edit Menu Item": manager+
  "Toggle Item Availability": staff+ (inline toggle on menu list)
  "Refund Payment": manager+
  "Invite Staff": admin
  "Whitelist Staff": admin
  "Suspend Staff": admin
  "Regenerate QR": manager+
  "Create Parcel Order": staff+
  "Create Bill": manager+
  "Pay Bill": manager+
  "Delete Bill": admin
  "Create Branch": admin
  "Upgrade Subscription": admin
  "Cancel Subscription": admin
```

---

## SECTION 9: ZUSTAND STORE CONTRACTS

### 9.1 Staff App Auth Store

```typescript
interface AuthState {
  user: StaffProfile | null;
  accessToken: string | null;
  role: 'staff' | 'manager' | 'admin' | null;
  branchId: number | null;
  restaurantId: number | null;
  permissions: PermissionsDto | null;
  isAuthenticated: boolean;

  setAuth: (payload: { user: StaffProfile; accessToken: string }) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}
// NEVER persist accessToken to localStorage/sessionStorage — memory only
// branchId from decoded JWT — may be null for admin
```

### 9.2 Customer App Member Store

```typescript
interface MemberState {
  memberToken: string | null;
  memberId: number | null;
  sessionId: number | null;
  tableId: number | null;
  branchId: number | null;
  restaurantId: number | null;
  isJoined: boolean;

  setMember: (token: string, decoded: MemberTokenPayload) => void;
  clearMember: () => void;
}
// Persist memberToken to localStorage key 'mahavi_member_token'
// On app init: read from localStorage, decode, hydrate store
```

### 9.3 Cart Store (Customer App)

```typescript
interface CartState {
  items: CartItem[];
  sessionId: number | null;

  addItem: (item: CartItem) => void;
  removeItem: (tempId: string) => void;
  updateQuantity: (tempId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

interface CartItem {
  tempId: string;           // uuid, client-side only
  menuItemId: number;
  variantId: number | null;
  quantity: number;
  unitPrice: number;        // base + variant modifier, computed client-side for display
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  note: string | null;
}
// Cart is NOT persisted — lost on refresh. This is acceptable: customer must re-add items.
// Cart is scoped to sessionId — clear on session change.
```

---

## SECTION 10: ERROR HANDLING PATTERNS

### 10.1 API Error Extraction

```typescript
function extractApiError(error: unknown): { message: string; code: string } {
  if (axios.isAxiosError(error)) {
    return {
      message: error.response?.data?.error ?? 'Request failed',
      code: error.response?.data?.code ?? 'UNKNOWN_ERROR',
    };
  }
  return { message: 'Network error', code: 'NETWORK_ERROR' };
}
```

### 10.2 Error Code → User Message Map

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  BRANCH_LIMIT_REACHED: 'Plan limit reached. Upgrade subscription to add more branches.',
  NO_ACTIVE_SUBSCRIPTION: 'Subscription inactive. Contact admin.',
  SUBSCRIPTION_INACTIVE: 'Restaurant subscription has expired.',
  SESSION_NOT_ACTIVE: 'This session is no longer active.',
  QR_NOT_FOUND: 'Invalid or expired QR code. Ask staff for assistance.',
  INVALID_STATUS_TRANSITION: 'This action is not allowed at the current status.',
  ITEM_UNAVAILABLE: 'One or more items are currently unavailable.',
  OVERPAYMENT: 'Payment amount exceeds the balance due.',
  ALREADY_PAID: 'This order is already fully paid.',
  ORDERS_NOT_COMPLETE: 'All orders must be delivered before completing the session.',
  PAYMENT_REQUIRED: 'Outstanding balance must be paid before completing.',
  LAST_REQUIRED_OPTION: 'Cannot remove the last option from a required variant group.',
  CATEGORY_HAS_ITEMS: 'Remove or reassign all items before deleting this category.',
  SECTION_HAS_TABLES: 'Remove or reassign all tables before deleting this section.',
  DUPLICATE_REQUEST: 'A similar request is already pending.',
  CANNOT_CANCEL: 'Only pending orders can be cancelled.',
  CONFLICT: 'This item already exists.',
  NOT_FOUND: 'The requested resource was not found.',
  EMAIL_EXISTS: 'This email is already registered.',
  VALIDATION_ERROR: 'Please check the highlighted fields.',
  AMOUNT_MISMATCH: 'Payment amount does not match.',
  REFUND_EXCEEDS_ORIGINAL: 'Refund cannot exceed the original payment amount.',
  TABLE_NOT_AVAILABLE: 'Table must be available to perform this action.',
  BRANCH_UNAVAILABLE: 'This branch is currently not accepting orders.',
};
```

### 10.3 Toast Configuration

Use React Hot Toast. Durations:
- Error: 5000ms
- Success: 2000ms
- Warning: 3000ms
- Loading: dismiss manually on completion

---

## SECTION 11: TABLE STATUS STATE MACHINE

```
STATES: available | occupied | cleaning

available → occupied:
  TRIGGER: customer QR scan (automatic, via backend)
  FRONTEND: table card shows green, no action buttons

occupied → cleaning:
  TRIGGER: staff POST /tables/:id/cleaning (after session close)
  FRONTEND: yellow badge, "Mark Cleaning" button visible to staff+
  ALSO SET AUTOMATICALLY: when staff clicks "Close Session" → table transitions server-side

cleaning → available:
  TRIGGER: staff POST /tables/:id/available
  FRONTEND: orange badge, "Mark Available" button visible to staff+
```

Visual colors: available=green, occupied=red/amber, cleaning=orange/yellow

---

## SECTION 12: ORDER STATUS STATE MACHINE

```
STATES: pending | confirmed | preparing | ready | delivered | cancelled

pending → confirmed:
  TRIGGER: Staff PATCH /orders/:id/status { status: 'confirmed' }
  FRONTEND: "Confirm Order" button, sets accepted_by_staff_id
  NOTE: ONLY manual transition for orders

confirmed → preparing:
  TRIGGER: AUTOMATIC when any item marked preparing via KDS
  FRONTEND: status updates via polling, no direct button

preparing → ready:
  TRIGGER: AUTOMATIC when ALL items are ready or cancelled
  FRONTEND: status updates via polling

ready → delivered:
  TRIGGER: AUTOMATIC when ALL items are delivered or cancelled
  FRONTEND: status updates via polling

any → cancelled:
  TRIGGER: Staff PATCH /orders/:id/cancel { reason }
  FRONTEND: "Cancel Order" button with required reason input
  EFFECT: all non-terminal items also cancelled
```

---

## SECTION 13: ORDER ITEM STATUS STATE MACHINE (KDS)

```
STATES: pending | preparing | ready | delivered | cancelled

pending → preparing:
  TRIGGER: Staff PATCH /order-items/:id/preparing
  KDS: "Start" button

preparing → ready:
  TRIGGER: Staff PATCH /order-items/:id/ready
  KDS: "Ready" button

ready → delivered:
  TRIGGER: Staff PATCH /order-items/:id/delivered
  KDS: "Delivered" button

any → cancelled:
  TRIGGER: Staff PATCH /orders/:orderId/items/:itemId/cancel { reason }
  FRONTEND: context menu on order detail
```

RULE: Order status is DERIVED from item statuses. Frontend NEVER independently sets order status beyond pending→confirmed. After confirmation, frontend shows order status changes only via polling — KDS item updates propagate up automatically.

---

## SECTION 14: SESSION LIFECYCLE STATE MACHINE

```
STATES: active | completed | abandoned

CREATION: automatic on first QR scan (no staff action creates sessions)

active:
  STAFF ACTIONS: view details, close session (POST /sessions/:id/close)
  CUSTOMER ACTIONS: browse menu, place orders, request waiter, pay, complete

active → completed:
  TRIGGER: 
    A) Customer POST /customer/session/complete (guards: all orders delivered, balance=0)
    B) Staff POST /sessions/:id/close (no guards — staff authority)
  EFFECT: table → cleaning, notification sent to staff

active → abandoned:
  TRIGGER: last customer leaves (POST /customer/session/leave) AND no non-cancelled orders
  EFFECT: table → available immediately

FRONTEND RULE: Customer "Complete Meal" button is DISABLED until:
  1. All orders status === 'delivered' OR 'cancelled'
  2. balanceDue === 0 (from GET /customer/session/invoice)
```

---

## SECTION 15: SUBSCRIPTION STATUS GATING (Admin Only)

```
STATES: active | grace_period | expired | cancelled | trial

UI RULES:
  active: full access
  grace_period: show prominent warning banner "Subscription expiring soon"
                continue access, show days remaining
  expired: block access to most features
            show "Subscription expired" full-screen with upgrade CTA
            EXCEPTION: admin can still access /settings/subscription to upgrade
  cancelled: same as expired
  trial: show "Trial" badge, show limits

BRANCH CREATION GUARD:
  Frontend should pre-fetch subscription.maxBranches before showing "Create Branch" button
  If branch count >= maxBranches: show upgrade prompt, disable button
  Backend enforces with 403 BRANCH_LIMIT_REACHED regardless
```

---

## SECTION 16: WAITER REQUEST STATE MACHINE

```
STATES: pending | acknowledged | resolved

Customer submits → pending
Staff acknowledges (PATCH /waiter-requests/:id/acknowledge) → acknowledged
Staff resolves (PATCH /waiter-requests/:id/resolve) → resolved

FRONTEND STAFF:
  Show badge on waiter icon with count of pending+acknowledged requests
  Auto-poll every 10s
  Sound alert option on new pending request (localStorage preference)
  Quick action buttons on request card: "Acknowledge" → "Resolve"

FRONTEND CUSTOMER:
  Show request status in customer waiter request list
  pending: "Requested..."
  acknowledged: "On the way!"
  resolved: "Resolved ✓"
  DUPLICATE GUARD: disable submit button if pending/acknowledged request of same type exists
```

---

## SECTION 17: INVOICE FLOW

### 17.1 Staff Invoice Access
Staff can view session invoice: GET /sessions/:sessionId/invoice
Staff can view order invoice: GET /orders/:orderId/invoice
Staff can download PDF: GET /sessions/:sessionId/invoice/pdf (opens in new tab, application/pdf)
Staff can download order PDF: GET /orders/:orderId/invoice/pdf

### 17.2 Customer Invoice Access
Customer views session invoice before payment: GET /customer/invoice
Customer views per-order invoice: GET /customer/orders/:orderId/invoice
Customer downloads PDF: GET /customer/invoice/pdf

### 17.3 Invoice Data Shape (used for display in both apps)
```typescript
interface InvoiceDto {
  invoiceNumber: string;         // "INV-2025-3-00042"
  issuedAt: string;             // ISO datetime
  branch: { name: string; address: string | null; phone: string | null };
  table: { tableNo: string; section: string } | null;
  session: { id: number; startedAt: string; completedAt: string | null } | null;
  members: number;
  orders: Array<{
    orderId: number;
    orderType: 'dine_in' | 'parcel';
    items: Array<{
      name: string;
      variant: string | null;
      qty: number;
      unitPrice: number;
      subtotal: number;
    }>;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  payments: Array<{ method: string; amount: number; status: string }>;
  balanceDue: number;
}
```

---

## SECTION 18: ESEWA PAYMENT FLOW (Customer App)

```
1. Customer views invoice (GET /customer/invoice)
2. Customer clicks "Pay with eSewa"
3. Frontend calls POST /customer/payments/esewa/initiate
   Body: { orderIds?: number[], successUrl, failureUrl }
   successUrl = `${CUSTOMER_APP_URL}/payment/status?success=true`
   failureUrl = `${CUSTOMER_APP_URL}/payment/status?success=false`
4. Backend returns: { paymentId, esewaPid, formParams }
5. Frontend submits formParams to eSewa endpoint (POST form submit):
   URL: https://uat.esewa.com.np/epay/main (UAT) or https://esewa.com.np/epay/main (prod)
   Method: POST form
6. eSewa redirects to successUrl or failureUrl
7. Frontend at /payment/status?success=true:
   Start polling GET /customer/payments every 5s
   Wait for payment status === 'completed'
   On completed: show success, navigate to /invoice
   Timeout after 60s: show "Payment pending, check with staff"
8. Backend webhook POST /payments/esewa/verify confirms via eSewa API
   Frontend NEVER calls verify directly — backend handles it

CASH PAYMENT FLOW:
1. Customer clicks "Pay with Cash"
2. POST /customer/payments { method: 'cash', orderIds?: [] }
3. Backend marks completed immediately (trust model)
4. Frontend shows "Payment recorded. Thank you."
```

---

## SECTION 19: NOTIFICATION SYSTEM (Staff App)

```
DELIVERY: HTTP polling only (no WebSocket/SSE in v1)
POLL: GET /notifications?updatedAfter=<ISO> every 10s

TYPES and their UI handling:
  low_stock: 📦 inventory alert — link to /inventory/low-stock
  waiter_called: 🔔 waiter request — link to waiter requests panel
  sub_expiring: ⚠️ subscription warning — link to /settings/subscription
  bill_overdue: 💰 overdue bill — link to /bills
  staff_invited: 👤 new staff invited — link to /staff
  meal_completed: ✅ session complete — link to /sessions

BELL COMPONENT:
  Badge count = unread notifications for current user
  Dropdown shows last 10
  "Mark all read" button
  Individual notification click → mark read + navigate to relevant resource

SOUND ALERTS: Optional, localStorage preference 'mahavi_sound_alerts'
  Play sound for: waiter_called type
```

---

## SECTION 20: FORM VALIDATION RULES (Mirrors Backend Zod Schemas)

```typescript
// Staff app forms — validation rules:

// Create Restaurant (public onboarding):
name: string, min 1, max 150
address: string, max 500, optional
billingEmail: email, max 150, optional

// Invite Staff:
name: string, min 1, max 100
email: email, max 150
role: enum ['staff', 'manager', 'admin'], default 'staff'
branchId: number, positive, optional

// Create Menu Category:
name: string, min 1, max 100
sortOrder: number, int, min 0, default 0

// Create Menu Item:
name: string, min 1, max 150
description: string, max 1000, optional
basePrice: number, positive
imageUrl: url, max 500, optional
sortOrder: number, int, min 0, default 0

// Create Variant Group:
name: string, min 1, max 100
isRequired: boolean, default true
sortOrder: number, int, min 0, default 0
options: array of { name, priceModifier: number>=0, sortOrder }

// Create Table:
sectionId: number, int, positive
tableNumber: number, int, min 1
label: string, max 50, optional

// Create Inventory Item:
name: string, min 1, max 150
unit: string, min 1, max 50
categoryId: number, int, positive, optional
quantity: number, min 0, default 0
lowStockThreshold: number, min 0, default 0

// Adjust Stock:
changeType: enum ['add', 'remove', 'adjust']
quantityDelta: number, nonzero
note: string, max 500, optional

// Create Bill:
type: enum ['electricity', 'rent', 'water', 'internet', 'other']
amount: number, positive
dueDate: date string YYYY-MM-DD
note: string, max 500, optional

// Create Parcel Order:
customerName: string, min 1, max 100
customerPhone: string, min 1, max 20
items: array min 1 of { menuItemId, variantId?, quantity 1-50, note? }
note: string, max 500, optional

// Customer forms:
// QR Scan name prompt:
name: string, min 1, max 100 (optional if joining existing session)

// Submit Feedback:
rating: number, int, 1-5
comment: string, max 1000, optional

// Waiter Request:
type: enum ['call_waiter', 'request_water', 'request_tissue']
```

---

## SECTION 21: QUERY KEY CONVENTIONS (TanStack Query)

```typescript
// Standardized query keys for cache management:
// Staff app:
['restaurant', restaurantId]
['subscription', restaurantId]
['branches', restaurantId]
['branch', branchId]
['sections', branchId]
['tables', branchId, { sectionId?, status? }]
['table', tableId]
['menu-categories', branchId]
['menu-item', itemId]
['sessions', 'active', branchId]
['session', sessionId]
['orders', branchId, filters]
['order', orderId]
['kitchen-orders', branchId]
['kitchen-queue', branchId]
['payments', 'session', sessionId]
['payments', 'order', orderId]
['invoice', 'session', sessionId]
['invoice', 'order', orderId]
['staff', restaurantId]
['staff-member', staffId]
['staff-logs', staffId]
['inventory', branchId]
['inventory-item', itemId]
['inventory-logs', itemId]
['bills', branchId]
['notifications', staffId]
['feedback', branchId]
['dashboard', branchId]
['dashboard', 'admin', restaurantId]
['analytics', 'revenue', branchId, period]
['analytics', 'orders', branchId, period]
['analytics', 'dishes-top', branchId, period]
['analytics', 'staff', branchId, period]
['analytics', 'peak-hours', branchId]
['analytics', 'branch-comparison', restaurantId, period]
['permissions']

// Customer app:
['customer-session']
['customer-menu', branchId]
['customer-menu-item', itemId]
['customer-orders']
['customer-order', orderId]
['customer-invoice']
['customer-payments']
['customer-waiter-requests']
```

---

## SECTION 22: ENVIRONMENT VARIABLES

```bash
# Staff App (.env)
VITE_API_URL=http://localhost:3000        # Backend base URL (no trailing slash)
VITE_APP_NAME=MaHaVi Staff

# Customer App (.env)
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=MaHaVi
VITE_ESEWA_URL=https://uat.esewa.com.np/epay/main   # UAT, change to prod URL for production
```

---

## SECTION 23: KDS (KITCHEN DISPLAY SYSTEM) ARCHITECTURE

KDS is a separate view within the staff app, accessible at /kitchen and /kitchen/queue.
Designed for use on a tablet or dedicated kitchen screen.
Auto-polls every 5s. Full-screen layout. No navigation sidebar.

TWO KDS modes:
1. FULL BOARD (/kitchen): Shows all active orders (confirmed/preparing/ready) grouped by order
2. QUEUE (/kitchen/queue): Shows only orders with pending or preparing items

KDS card per order shows:
- Order #ID, table number OR "PARCEL: customer name"
- Time elapsed since order created (live updating timer)
- Items grouped by status: pending (red), preparing (yellow), ready (green)
- Per-item action buttons based on current status

KDS interaction flow:
```
Item in pending state → shows "Start" button → click → PATCH /order-items/:id/preparing
Item in preparing state → shows "Ready" button → click → PATCH /order-items/:id/ready
Item in ready state → shows "Delivered" button → click → PATCH /order-items/:id/delivered
After each action: optimistic UI update + poll refresh
```

KDS color coding:
- Order waiting >10min: red border
- Order waiting 5-10min: yellow border
- Order waiting <5min: green border

---

## SECTION 24: PAGINATION CONVENTIONS

All paginated list endpoints accept:
```
?page=1&limit=20
```

Meta response:
```typescript
{ page: number, limit: number, total: number }
// Frontend derives: totalPages = Math.ceil(total / limit)
```

Standard page sizes: 20 (default), 50 (large lists)
Implement cursor-based infinite scroll for: notification list, order history
Implement traditional pagination for: analytics, staff list, inventory

---

## SECTION 25: DATE/TIME CONVENTIONS

- Backend sends all timestamps as ISO 8601 strings (UTC)
- Frontend displays in LOCAL timezone using date-fns
- Date-only fields (bills.dueDate, analytics periods): YYYY-MM-DD, display without timezone conversion
- Period labels: "Today", "This Week", "This Month", "This Year" map to:
  today, week, month, year query params

```typescript
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Display timestamp: "Jun 4, 2025 2:30 PM"
format(parseISO(isoString), 'MMM d, yyyy h:mm a')

// Display relative: "2 hours ago"
formatDistanceToNow(parseISO(isoString), { addSuffix: true })

// Date only: "Jun 4, 2025"
format(parseISO(dateString + 'T00:00:00'), 'MMM d, yyyy')
```

---

## SECTION 26: CURRENCY DISPLAY

All amounts are in Nepalese Rupees (NPR).
Display format: `Rs ${amount.toFixed(2)}` or `Rs ${amount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
Backend stores as NUMERIC(10,2) or NUMERIC(12,2).
Frontend receives as number (after Decimal.toNumber() in backend).
NEVER use floating point math for totals — use integer math (amount * 100) or toFixed(2) for display.
