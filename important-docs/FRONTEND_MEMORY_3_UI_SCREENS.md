# MAHAVI_FRONTEND_MEMORY_3_UI_SCREENS
# Version: 1.0 | Generated from complete backend implementation
# Companion files: FRONTEND_MEMORY_1_ARCHITECTURE.md, FRONTEND_MEMORY_2_API_CONTRACTS.md
# This file: every screen in both apps, component behaviors, form logic, navigation flows, KDS UI, customer ordering UX

---

## PART A: STAFF APP — SCREEN SPECIFICATIONS

---

### SCREEN A1: LOGIN PAGE (/login)

Layout: centered card, full viewport, brand logo at top
Components:
- MaHaVi logo + tagline "Restaurant Management Platform"
- "Sign in with Google" button → window.location.href = /api/v1/auth/google
- No other auth options. No email/password fields.
- Loading state during OAuth redirect

State handling:
- If already authenticated (valid accessToken in Zustand): redirect to default route immediately
- After OAuth callback: /auth/callback route extracts token, stores in Zustand, redirects

---

### SCREEN A2: OAUTH CALLBACK (/auth/callback)

No UI — invisible redirect handler.
Logic:
```typescript
// 1. Extract token from URL
const params = new URLSearchParams(location.search);
const token = params.get('token');
if (!token) navigate('/login?error=oauth_failed');

// 2. Decode JWT (do NOT verify — backend verified it)
const decoded = jwtDecode(token);

// 3. Store in Zustand
useAuthStore.setState({ accessToken: token, role: decoded.role, branchId: decoded.branchId, restaurantId: decoded.restaurantId });

// 4. Fetch full profile
const user = await api.get('/auth/me');
const permissions = await api.get('/me/permissions');
useAuthStore.setState({ user, permissions });

// 5. Clean URL and redirect
window.history.replaceState({}, '', '/');
navigate(getRoleDefaultRoute(decoded.role));
```

---

### SCREEN A3: MAIN LAYOUT (Authenticated wrapper)

Sidebar navigation (collapsible, 240px wide when expanded, 64px icons-only when collapsed)
Top bar: branch selector (admin/manager), notification bell with badge, user avatar + dropdown

SIDEBAR ITEMS (shown/hidden by permission):
```
Dashboard (staff+) → /dashboard
Sessions (staff+) → /sessions
Orders (staff+) → /orders
Kitchen (staff+) → /kitchen
Tables (staff+) → /tables
Menu (manager+) → /menu
Inventory (staff+) → /inventory
Bills (manager+) → /bills
Staff (admin) → /staff
Analytics (manager+) → /analytics
Settings → /settings (sub-items based on role)
```

NOTIFICATION BELL:
- Badge shows count of unread notifications
- Polls GET /notifications?updatedAfter=<ISO> every 10s
- Dropdown: last 10 notifications, click → navigate to referenceType/referenceId page
- "Mark all read" button

BRANCH SELECTOR (top bar):
- Visible to manager+ 
- Staff role: no selector (auto-uses their branchId)
- Admin: shows all branches dropdown, changing selection re-fetches all branch-scoped queries
- Selected branchId stored in Zustand (NOT URL param — persisted across navigation)

WAITER REQUEST ALERT (top bar, staff+):
- Bell icon separate from notifications
- Badge = count of pending + acknowledged waiter requests
- Click opens floating panel with request list
- Polls GET /branches/:branchId/waiter-requests?status=pending every 10s
- Sound alert option (localStorage preference)

---

### SCREEN A4: STAFF DASHBOARD (/dashboard)

For staff+ role. Fetches GET /dashboard (uses branchId from JWT).
Poll: every 30s (not real-time, just refresh)

Layout: 2x3 grid of stat cards

STAT CARDS:
1. Active Orders: number, link to /orders?status=pending,confirmed,preparing,ready
2. Active Sessions: number, link to /sessions
3. Tables: three mini badges (available/occupied/cleaning counts), link to /tables
4. Pending Waiter Calls: number with 🔔 icon, link to waiter requests panel
5. Revenue Today: Rs X.XX, subtitle "From snapshot (yesterday)"
6. Low Stock Items: number with ⚠️ icon, link to /inventory/low-stock

QUICK ACTIONS section:
- "Create Parcel Order" button → /orders/parcel/new
- "View Kitchen" button → /kitchen

---

### SCREEN A5: BRANCH MANAGER DASHBOARD (/dashboard/branch)

For manager+ role. Fetches GET /dashboard/branch/:branchId
Also fetches GET /dashboard for live operational stats (reuse A4 stats).

Additional dashboard cards beyond A4:
- Cash Revenue vs Online Revenue: split display
- Dine-in vs Parcel orders: comparison
- Total Sessions today, Total Customers today
- Avg Order Value: Rs X.XX or "N/A"

Period note: "Data from yesterday's snapshot" displayed as muted text.
If no snapshot data: show "Snapshot available after midnight" with zeros.

---

### SCREEN A6: ADMIN DASHBOARD (/dashboard/admin)

For admin role. Fetches GET /dashboard/admin.

TOP SECTION: Subscription status card
- Plan badge: trial/monthly/yearly
- Status: color-coded (active=green, grace_period=amber, expired=red)
- If grace_period: "X days remaining" countdown
- If expired: "SUBSCRIPTION EXPIRED" full red banner, "Upgrade Now" CTA

BRANCH COMPARISON TABLE:
Columns: Branch Name | Today's Revenue | Today's Orders | Active Sessions | Actions
Sortable by revenue.
"View Branch" button → sets active branch in selector, navigates to /dashboard/branch

TOTAL METRICS: sum of all branches, displayed at bottom.

---

### SCREEN A7: ACTIVE SESSIONS (/sessions)

Fetches GET /branches/:branchId/sessions/active. Poll: 15s.

Layout: grid of session cards (3 columns on desktop)

SESSION CARD:
- Table number + section name (prominent)
- Session #ID (small)
- Started: "X minutes ago" (live relative time)
- Members: N person icon
- Order count + total revenue (from SessionDetailDto)
- Status badge: active (green)
- Actions: "View" → /sessions/:id, "Close Session" (confirms then POST /sessions/:id/close)

FILTERS: none (shows all active sessions for branch)

EMPTY STATE: "No active sessions. Tables are available."

---

### SCREEN A8: SESSION DETAIL (/sessions/:sessionId)

Fetches GET /sessions/:sessionId.

TOP: Table info card (table number, section, start time, duration)
MEMBERS section: list of member names + join times
ORDERS section: list of orders with status badges (reuses order list component)
PAYMENT section: payment list (GET /sessions/:sessionId/payments)

ACTIONS (top right):
- "View Invoice" → GET /sessions/:sessionId/invoice (modal or navigate)
- "Download PDF" → fetch blob, open /sessions/:sessionId/invoice/pdf in new tab
- "Close Session" → confirm dialog → POST /sessions/:sessionId/close
  → On success: navigate to /sessions, show toast "Session closed. Table moved to cleaning."

---

### SCREEN A9: ORDER LIST (/orders)

Fetches GET /branches/:branchId/orders. Poll: 5s with updatedAfter.

FILTER BAR (horizontal):
- Status filter: All | Pending | Confirmed | Preparing | Ready | Delivered | Cancelled
- Type filter: All | Dine-in | Parcel
- Date range: from/to date pickers
- Search: by order ID or customer name

ORDER TABLE (desktop) / ORDER CARDS (mobile):
Columns: #ID | Table/Customer | Items Count | Total | Status | Time | Actions

STATUS BADGES color coding:
- pending: gray
- confirmed: blue
- preparing: yellow/amber
- ready: purple
- delivered: green
- cancelled: red strikethrough

ROW ACTIONS:
- "Confirm" button (only if pending): POST /orders/:id/status { status: 'confirmed' }
- "View" button: opens order detail modal or navigate to /orders/:id
- "Cancel" (pending/confirmed only): opens reason modal → POST /orders/:id/cancel

PARCEL ORDERS: shown with "PARCEL" badge + customer name instead of table number

---

### SCREEN A10: CREATE PARCEL ORDER (/orders/parcel/new)

Form: two-step wizard

STEP 1: Customer Info
- Customer Name (required, text input)
- Customer Phone (required, text input)
- Order Note (optional, textarea)
- Next →

STEP 2: Add Items
- Search items by name (client-side filter on fetched menu)
- Category tabs for browsing
- Item cards: name, price, variant selector (if groups exist), quantity stepper, item note
- Added items shown in right panel with running total
- Submit → POST /orders/parcel
- Back to Step 1

On success: navigate to /orders/:id (new parcel order), show success toast.

---

### SCREEN A11: ORDER DETAIL (/orders/:orderId)

Fetches GET /orders/:orderId.

HEADER: Order #ID | Status badge | Created time | Order type

IF DINE-IN: table number + session link
IF PARCEL: customer name + phone

ORDER ITEMS TABLE:
Columns: Item Name | Variant | Qty | Unit Price | Subtotal | Status | Actions

Per-item actions:
- "Cancel Item" (if not delivered/cancelled): reason modal → PATCH /orders/:id/items/:itemId/cancel

ORDER-LEVEL ACTIONS:
- "Confirm Order" (if pending): PATCH /orders/:id/status
- "Cancel Order" (if not delivered/cancelled): reason modal → PATCH /orders/:id/cancel

PAYMENT SECTION (collapsed by default):
- GET /orders/:orderId/payments
- List of payment rows
- "Refund" button (manager+, if payment completed): amount + reason → POST /payments/:id/refund

INVOICE LINKS:
- "View Invoice" | "Download PDF"

---

### SCREEN A12: KITCHEN DISPLAY (KDS) (/kitchen)

Fetches GET /branches/:branchId/kitchen/orders. Poll: 5s.
Full-screen layout. No sidebar. Top bar with: "Kitchen" title, branch name, current time, toggle to Queue view.

LAYOUT: scrollable horizontal columns or masonry grid of order cards

ORDER CARD:
```
┌─────────────────────────────────┐
│ #45 · Table T-05 · Ground Floor │  ← or "PARCEL: Sita Thapa"
│ 🕐 12 min ago                   │  ← color coded: green<5, yellow5-10, red>10
├─────────────────────────────────┤
│ [PREPARING] Momo (Buff) ×2      │  ← 🟡 yellow
│   Note: extra sauce              │
│                     [READY] →   │  ← action button
├─────────────────────────────────┤
│ [PENDING] Chowmein (Veg) ×1     │  ← 🔴 red
│                 [START COOKING] │
├─────────────────────────────────┤
│ [READY] Dal Bhat ×1             │  ← 🟢 green
│              [MARK DELIVERED] →  │
└─────────────────────────────────┘
```

ITEM STATUS BUTTONS:
- PENDING → "[START COOKING]" → PATCH /order-items/:id/preparing
- PREPARING → "[READY]" → PATCH /order-items/:id/ready
- READY → "[DELIVERED]" → PATCH /order-items/:id/delivered

All buttons: optimistic UI update immediately, revert on error.
Order card border color: red (>10min), yellow (5-10min), green (<5min).
Completed orders (all items delivered/cancelled): fade out after 3s.

---

### SCREEN A13: KDS QUEUE (/kitchen/queue)

Fetches GET /branches/:branchId/kitchen/queue. Poll: 5s.
Shows ONLY orders with pending/preparing items. Simpler layout for busy kitchens.

LAYOUT: single column list of queue cards

QUEUE CARD:
```
#45 · T-05 · 12 min      [ALL PENDING] [ALL PREPARING]
  Momo ×2 (Buff)          🔴 pending     → [START]
  Chowmein ×1 (Veg)       🟡 preparing   → [READY]
```

"Mark All Preparing" button on card: marks all pending items in that order.

---

### SCREEN A14: TABLES GRID (/tables)

Fetches GET /branches/:branchId/tables. Poll: 15s.
Also fetches GET /branches/:branchId/sections for section tabs.

SECTION TABS at top: "All" + one tab per section
Filter: by status (All / Available / Occupied / Cleaning)

TABLE GRID: responsive, 4-6 columns on desktop

TABLE CARD:
```
┌───────────┐
│    T-05   │  ← table number
│  ●  BUSY  │  ← status badge
│ 🪑 3 pax  │  ← member count (only when occupied)
│ ⏱ 45 min  │  ← session duration (only when occupied)
└───────────┘
```

Status colors: available=green border, occupied=red border, cleaning=orange border

TABLE CARD ACTIONS (on click → detail panel or modal):
- Available: "Create QR" (show QR), no other actions (sessions created only via QR scan)
- Occupied: "View Session" → /sessions/:id, "Mark Cleaning" (POST /tables/:id/cleaning)
- Cleaning: "Mark Available" (POST /tables/:id/available)

"+" FAB button (manager+): opens create table modal

---

### SCREEN A15: TABLE DETAIL MODAL (manager+)

Triggered from table card click (manager+).

SECTIONS:
1. Table Info: section, table number, label, current status
2. QR Code display: SVG rendered inline (GET /tables/:tableId/qr)
   - "Download QR" button: fetch SVG, create download link
   - "Print" button: window.print() with isolated QR + table info
   - "Regenerate QR" button (danger): confirm modal → POST /tables/:tableId/regenerate-qr
     Warning: "This will invalidate all printed QR codes for this table."
3. Edit Table (inline edit): tableNumber, label → PATCH /branches/:branchId/tables/:tableId
4. Delete Table: only if status=available → DELETE → confirm modal

---

### SCREEN A16: MENU MANAGEMENT (/menu)

Fetches GET /branches/:branchId/menu/categories with nested items.

LAYOUT: two-panel
LEFT: category list (sortable via drag-and-drop → PATCH categories/reorder)
RIGHT: items for selected category

CATEGORY LIST ITEM:
- Category name + sort order
- Item count badge
- Edit inline (click to rename)
- "Add Item" button → opens item creation modal
- Delete (with 409 guard warning)
- Drag handle for reordering

MENU ITEM CARD (in right panel):
- Item name, description snippet, base price
- Variant count badge
- Availability toggle: isAvailable (switch) → PATCH /menu/items/:id/availability
  When toggling OFF: show disableNote input modal
- "Edit" → /menu/items/:id/edit
- "View Variants" → expands inline or navigates

ITEM AVAILABILITY TOGGLE:
- Switch component
- Toggle OFF: modal "Reason for disabling (optional): [input]" → PATCH with { isAvailable: false, disableNote }
- Toggle ON: immediately PATCH { isAvailable: true } (disableNote cleared server-side)

---

### SCREEN A17: MENU ITEM EDIT (/menu/items/:itemId/edit)

Fetches GET /menu/items/:itemId for full item + optionGroups.

FORM SECTION 1: Item Details
- Name (text, required)
- Description (textarea, optional)
- Base Price (number input, positive, required)
- Image URL (text input, optional, shows preview if valid URL)
- Sort Order (number, optional)
- Category (display only — changing category not supported in v1)
- Availability toggle (same as inline toggle)

FORM SECTION 2: Variant Groups (OptionGroups)
List of existing groups with:
- Group name + isRequired toggle + sort order
- Options list (inline edit): name, price modifier
- "Add Option" row button
- Delete group button (with LAST_REQUIRED_OPTION guard)
- Delete option button (with LAST_REQUIRED_OPTION guard)
- "Add Variant Group" button → opens group creation modal

VARIANT GROUP CREATION MODAL:
- Group name (required)
- Is Required: yes/no toggle
- Initial options: add N option rows (name, priceModifier)
- POST /menu/items/:itemId/variants

SAVE: PATCH /menu/items/:itemId (item fields)
Each variant/option edit triggers its own PATCH/DELETE immediately (not batched).

---

### SCREEN A18: INVENTORY (/inventory)

Fetches GET /branches/:branchId/inventory. Poll: 60s.
Fetches GET /branches/:branchId/inventory/categories for category filter.

FILTER BAR: Category dropdown | Low Stock toggle (→ GET /inventory/low-stock)

INVENTORY TABLE:
Columns: Name | Category | Unit | Current Stock | Threshold | Status | Last Updated | Actions

STATUS COLUMN:
- isLowStock=true: 🔴 "LOW" badge
- quantity=0: ⛔ "OUT" badge
- normal: ✅ badge

ROW ACTIONS:
- "Adjust" button → opens stock adjustment modal
- "History" (manager+) → /inventory/:itemId/logs
- "Edit" (manager+) → inline edit row
- "Delete" (manager+) → confirm delete

STOCK ADJUSTMENT MODAL (staff+):
- Item name (read-only)
- Change Type: Add / Remove / Adjust (radio)
- Quantity Delta (number, required, nonzero)
  - Add: positive label "Add X [unit]"
  - Remove: negative label "Remove X [unit]"
  - Adjust: label "Set adjustment to X [unit]"
- Note (textarea, optional)
- Current stock displayed: "Current: X [unit]"
- POST /branches/:branchId/inventory/:itemId/adjust
- Error: INSUFFICIENT_STOCK → "Cannot remove X [unit] — only Y available"

"+ Add Item" button (manager+) → create item modal

---

### SCREEN A19: INVENTORY ITEM LOGS (/inventory/:itemId/logs)

Fetches GET /branches/:branchId/inventory/:itemId/logs (paginated).

TABLE:
Columns: Date/Time | Staff | Change Type | Delta | Note
changeType colored: add=green, remove=red, adjust=blue

Pagination controls at bottom.

---

### SCREEN A20: BILLS (/bills)

Fetches GET /branches/:branchId/bills. Filter by status.

BILLS TABLE:
Columns: Type | Amount | Due Date | Status | Paid Date | Note | Actions

STATUS COLORS:
- unpaid: gray (if dueDate future) or amber (if dueDate past, pre-overdue check)
- paid: green
- overdue: red

ROW ACTIONS:
- "Pay" (manager+, if not paid): confirm → PATCH /bills/:id/pay
- "Edit" (manager+): inline edit (amount, dueDate, note) → PATCH /bills/:id
- "Delete" (admin): confirm delete → DELETE /bills/:id

"+ Add Bill" FAB (manager+) → create bill modal

CREATE BILL MODAL:
- Type: select (electricity/rent/water/internet/other)
- Amount: currency input
- Due Date: date picker (cannot be in the past — show warning but allow)
- Note: textarea optional
- POST /branches/:branchId/bills

---

### SCREEN A21: STAFF MANAGEMENT (/staff)

Admin only. Fetches GET /staff (paginated).

STAFF TABLE:
Columns: Name | Email | Role | Branch | Status | Created | Actions

STATUS: isActive=true → "Active" green, isActive=false → "Pending" or "Suspended" gray/red
(Distinguish: never had oauth_id set = pending invite; had oauth_id = suspended)

ROW ACTIONS:
- "Whitelist" (if isActive=false): POST /staff/:id/whitelist
- "Suspend" (if isActive=true): POST /staff/:id/suspend
- "Change Role" → role edit modal → PATCH /staff/:id/role
- "View Logs" → /staff/:staffId
- "Delete" → confirm → DELETE /staff/:id

"Invite Staff" button (top right) → /staff/invite

---

### SCREEN A22: INVITE STAFF (/staff/invite)

Admin only.

FORM:
- Full Name (required)
- Email (required, email format)
- Role: select (staff/manager/admin)
- Branch: select (list of branches, required if role=staff or manager, optional for admin)
- Submit → POST /staff/invite
- Success: navigate to /staff, show toast "Invitation created. Staff can now sign in with Google."

Notes display: "Staff will need to sign in with Google using this email address. They will be active after their first login."

---

### SCREEN A23: STAFF DETAIL + LOGS (/staff/:staffId)

Admin only. Fetches GET /staff (find by id) + GET /staff/:staffId/logs.

TOP: Staff profile card (name, email, role, branch, status, created date)
ACTIONS: Whitelist / Suspend / Change Role / Delete

LOGS SECTION: paginated activity log table
Columns: Timestamp | Action Type | Target | Details (meta expandable)

---

### SCREEN A24: ANALYTICS HUB (/analytics)

Manager+ only.

Layout: analytics sidebar nav on left, chart area on right.
Date range selector: period buttons (Today/Week/Month/Year) + custom date range.
Active period persisted in URL query params.

SUB-PAGES:
- Revenue (/analytics/revenue)
- Orders (/analytics/orders)
- Dishes (/analytics/dishes)
- Staff Performance (/analytics/staff)
- Table Utilization (/analytics/tables)
- Customer Trends (/analytics/customers)
- Peak Hours (/analytics/peak-hours)
- Branch Comparison (/analytics/branch-comparison) [admin only]

---

### SCREEN A25: REVENUE ANALYTICS (/analytics/revenue)

Fetches GET /branches/:branchId/analytics/revenue.

COMPONENTS:
1. Summary cards row: Total Revenue | Cash Revenue | Online Revenue
2. Line chart: revenue by day (byDay array), using recharts LineChart
3. Revenue breakdown: Dine-in vs Parcel donut chart
4. Cash vs Online donut chart

Chart configs:
- X-axis: dates formatted "Jun 4"
- Y-axis: "Rs X.XX"
- Tooltip: "Rs X,XXX.XX on Jun 4"
- Responsive container (100% width)

---

### SCREEN A26: ORDER ANALYTICS (/analytics/orders)

Fetches GET /branches/:branchId/analytics/orders.

1. Summary cards: Total | Cancelled | Cancellation Rate (%)
2. Bar chart: orders by day
3. Dine-in vs Parcel comparison bar chart
4. Cancellation trend line

---

### SCREEN A27: DISH ANALYTICS (/analytics/dishes)

TWO TABS: "Top Performers" | "Worst Performers"

Top: GET /branches/:branchId/analytics/top-dishes?limit=10
Worst: GET /branches/:branchId/analytics/worst-dishes?limit=10
Full: GET /branches/:branchId/analytics/dish-sales

COMPONENTS:
1. Ranked list with rank badge, item name, quantity sold, revenue
2. Horizontal bar chart of quantities
3. Full table (dish-sales) with pagination

---

### SCREEN A28: STAFF PERFORMANCE (/analytics/staff)

Fetches GET /branches/:branchId/analytics/staff-performance.

TABLE + chart:
Columns: Rank | Staff Name | Orders Handled | Sales Amount | Cancelled | Avg Completion Time
Bar chart: sales amounts per staff member
"Leaderboard" layout with rank badges (🥇🥈🥉 for top 3)

---

### SCREEN A29: PEAK HOURS (/analytics/peak-hours)

Fetches GET /branches/:branchId/analytics/peak-hours.

Bar chart: 24 bars (hours 0-23), x-axis formatted "12 AM", "6 AM", "12 PM", "6 PM"
Highlight peak hour with different color.
Show "Last 30 days" label.
No period selector (endpoint doesn't accept period param).

---

### SCREEN A30: SETTINGS (/settings)

HUB PAGE with cards/list of setting sections:
- Restaurant Info (admin)
- Subscription (admin)
- Branches (admin)
- Sections (manager+)
- Profile (staff+)

---

### SCREEN A31: RESTAURANT SETTINGS (/settings/restaurant)

Admin only. Fetches GET /restaurants/:restaurantId.

FORM (inline edit):
- Name
- Address
- Billing Email
PATCH /restaurants/:id on save.

---

### SCREEN A32: SUBSCRIPTION SETTINGS (/settings/subscription)

Admin only.

CURRENT SUBSCRIPTION card:
- Plan badge, status, max branches, started date, expires date
- If grace_period: days remaining, "Upgrade to restore full access"
- If expired: "EXPIRED" banner

UPGRADE SECTION:
- Plan selector: Monthly / Yearly (radio)
- Max Branches slider: 1-10 (increments by 1)
- Expiry date: date picker
- "Upgrade Plan" → POST /restaurants/:id/subscription/upgrade
- "Cancel Subscription" button (danger) → confirm → POST /restaurants/:id/subscription/cancel

BILLING HISTORY: table of all subscription rows (GET /restaurants/:id/subscriptions)
Columns: Plan | Status | Started | Expires | Max Branches

---

### SCREEN A33: BRANCH MANAGEMENT (/settings/branches)

Admin only. Fetches GET /branches.

BRANCH LIST with:
- Name, address, phone
- isActive toggle: PATCH /branches/:id/toggle
- "Edit" → inline edit modal → PATCH /branches/:id
- "Delete" → soft delete → DELETE /branches/:id
- "View Dashboard" → sets active branch, navigate to /dashboard/branch

"+ Create Branch" button → modal:
- Name, address, phone → POST /branches
- Error: 403 BRANCH_LIMIT_REACHED → "Upgrade plan to add more branches"

---

### SCREEN A34: SECTION MANAGEMENT (/settings/sections)

Manager+ only. Fetches GET /branches/:branchId/sections.

SORTABLE LIST with drag-and-drop handle
Each section: name (inline edit), table count badge, delete button

"+ Add Section" → inline form: name input → POST /branches/:branchId/sections
Delete: disabled if hasActiveTables → show "Move tables first"

Reorder: drag-and-drop → PATCH /branches/:branchId/sections/:id with new sortOrder
(Note: sections don't have a bulk reorder endpoint. Update each one individually.)

---

### SCREEN A35: FEEDBACK REPORT (/feedback)

Manager+ only. Fetches GET /branches/:branchId/feedback.

SUMMARY ROW:
- Avg Rating: X.X / 5.0 with star display
- Total Responses: N
- Rating Distribution: 5-star breakdown bar chart (1★ through 5★)

RECENT FEEDBACK TABLE:
Columns: Date | Session | Rating (stars) | Comment
Paginated.

---

### SCREEN A36: NOTIFICATIONS (/notifications)

Staff+. Fetches GET /notifications (paginated). Poll: 10s.

LIST of notification cards:
- Icon based on type
- Title + message
- Time ago
- Unread: bold + colored left border
- Click: mark read + navigate to reference

"Mark All Read" button at top.
Filter tabs: All | Unread

---

### SCREEN A37: PAYMENT MANAGEMENT (/payments/:sessionId)

Staff+. Fetches GET /sessions/:sessionId/payments.

PAYMENT TABLE:
Columns: ID | Amount | Method | Status | Time | Actions

Positive amounts: revenue
Negative amounts (refunds): shown in red with "REFUND" label

REFUND BUTTON (manager+, on completed rows):
Modal: amount (max = original amount - already refunded), reason (required)
POST /payments/:paymentId/refund

SESSION INVOICE LINK at top: "View Full Invoice" | "Download PDF"

---

## PART B: CUSTOMER APP — SCREEN SPECIFICATIONS

---

### SCREEN B1: QR SCAN LANDING (/scan)

ALWAYS the entry for new customers. Handles ?token= URL param.

FLOW:
```
1. Check localStorage for valid memberToken
   → Valid: skip scan, navigate to /session
   → Invalid/expired: continue

2. Extract qrToken from URL ?token= param
   → No token: show error state "No QR code detected. Please scan the QR code on your table."
   → Token exists: check if it's 64 chars hex

3. Show name prompt modal (mandatory):
   Title: "Welcome to [Branch Name]"
   "Your name:" [text input, required, max 100]
   "Your phone:" [text input, optional]
   "Join Table" button

4. POST /customer/qr/scan { qrToken, name, phone }
   → Loading state: "Joining your table..."
   → SUCCESS: store memberToken in localStorage
               decode JWT, store in MemberStore
               if response.session.isNew: show "Table opened! Scanning menu..."
               else: show "Joined existing table."
               navigate to /menu
   → ERROR QR_NOT_FOUND: "This QR code is no longer valid. Please ask staff for help."
   → ERROR BRANCH_UNAVAILABLE: "This restaurant is temporarily unavailable."
   → RATE LIMIT (429): "Too many attempts. Please wait a moment."
```

MOBILE FIRST: large touch targets, minimal form fields, auto-focus name input.

---

### SCREEN B2: SESSION VIEW (/session)

Fetches GET /customer/session. Poll: 10s.
Shows current session state.

COMPONENTS:
- Table info card: Table T-XX | Section Name | Branch Name
- Members list: avatars/names of all people at the table
- Session duration: "You've been here for X min"
- Order status summary: N orders, total Rs X

BOTTOM NAV TABS:
Menu | My Orders | Invoice | Requests

ACTION BUTTONS:
- "Leave Table" (destructive) → confirm → POST /customer/session/leave
  Warning: "If you're the last person to leave with active orders, staff will be notified."
  Success: clear localStorage, navigate to /scan with message "See you next time!"

- "Complete Meal" (prominent, at bottom) → see completion flow
  Disabled with tooltip when: orders not all delivered OR balanceDue > 0

COMPLETION BUTTON GUARD:
- Fetch GET /customer/invoice → check balanceDue === 0
- Check all orders status in ['delivered', 'cancelled']
- If both pass: enable button
- Missing: show specific message "Pay outstanding balance first" or "Wait for all items to be delivered"

---

### SCREEN B3: CUSTOMER MENU (/menu)

Fetches GET /customer/menu. Cache: 5 min (menu rarely changes during session).

LAYOUT: full-screen mobile app feel
TOP: sticky header with branch name + table number
BELOW HEADER: horizontal category scroll tabs
MAIN: vertically scrolled items

CATEGORY TABS:
- Built from categories array
- "All" tab first
- Click category → smooth scroll to category section
- Active tab highlighted as user scrolls (intersection observer)

MENU ITEM CARD:
```
┌─────────────────────────────────┐
│ [IMAGE]  Momo                   │
│          Steamed dumplings...   │
│          Rs 180.00              │
│                    [ADD] +      │  ← if isAvailable
└─────────────────────────────────┘
```
Unavailable items: greyed out, "Currently unavailable" label, disableNote shown if present.
No ADD button for unavailable items.

TAP ITEM → SCREEN B4 (item detail modal)

BOTTOM: floating cart summary bar (if items in cart):
"N items · Rs X.XX · [View Cart]"

---

### SCREEN B4: ITEM DETAIL MODAL

Opens when customer taps a menu item.

MODAL CONTENTS:
- Item image (full width if available)
- Item name + description
- Base price: Rs X.XX
- VARIANT GROUPS (each group):
  - Group name + "(required)" or "(optional)" label
  - Option buttons (radio for single-select implied by required=true)
  - Each option: name + "+ Rs X.XX" (if priceModifier > 0) or "" (if 0)
  - Selected option highlighted

- Quantity stepper: [−] [N] [+] (min 1, max 50)
- Item note: text input "Special instructions..." (optional)
- Total price: Rs X.XX (computed: basePrice + selected variant priceModifiers)
- "Add to Order" button

VALIDATION:
- All required variant groups must have a selection before enabling "Add to Order"
- Required group with no selection: highlight red

ON ADD: push CartItem to Zustand cart, close modal, show mini toast "Added to cart", update floating bar.

---

### SCREEN B5: CART REVIEW (/cart)

Shows CartStore items before placing order.

CART ITEMS LIST:
- Item name + variant + quantity + price
- [−] [N] [+] quantity stepper (update CartStore)
- Item note display
- Remove button (trash icon) → remove from CartStore

ORDER SUMMARY:
- Subtotal: Rs X.XX (client-computed from cart)
- Note for order: optional textarea

BOTTOM: "Place Order" button (Rs X.XX)
→ POST /customer/orders { items, note }
→ Loading: disable button, show spinner
→ SUCCESS: clear cart, navigate to /orders, show toast "Order placed!"
→ ERROR ITEM_UNAVAILABLE: "Some items are no longer available. Please review your cart."
→ ERROR SESSION_NOT_ACTIVE: redirect to /scan

EMPTY CART: "Your cart is empty. Browse the menu to add items."

---

### SCREEN B6: CUSTOMER ORDERS (/orders)

Fetches GET /customer/orders. Poll: 5s.

ORDERS LIST (newest first):
ORDER CARD:
```
Order #45                  🟡 Preparing
Jun 4, 2:30 PM             Rs 360.00
Momo (Buff) ×2             🟡 preparing
Chowmein ×1                🔴 pending
```

STATUS COLORS: pending=red, preparing=yellow, ready=green/purple, delivered=green, cancelled=gray

CANCELLED ORDER: show dimmed with "Cancelled" label.

TAP ORDER → SCREEN B7 (order detail)

ACTIONS (on pending orders only):
- "Cancel Order" button → confirm → POST /customer/orders/:id/cancel

"Order More" FAB button → navigate to /menu

---

### SCREEN B7: ORDER DETAIL (/orders/:orderId)

Fetches GET /customer/orders/:orderId. Poll: 5s.

ITEMS LIST:
Each item shows:
- Item name + variant + quantity
- Unit price + subtotal
- Status badge with live color
- Item note if present

ORDER STATUS PROGRESS BAR:
pending → confirmed → preparing → ready → delivered
(highlight current status, completed steps in green)

ACTIONS:
- "Add More Items" (if status=pending) → opens /cart pre-filled OR go to menu
- "Cancel This Order" (if status=pending): confirm → POST /customer/orders/:id/cancel
- "View Invoice" → GET /customer/orders/:id/invoice (modal)

---

### SCREEN B8: SESSION INVOICE (/invoice)

Fetches GET /customer/invoice. No poll needed.

SHOWS BEFORE PAYMENT:
- Invoice number
- Branch info
- Table + session info
- Orders breakdown (all orders with items)
- Subtotal / Tax / Total
- Already paid section (if any payments)
- BALANCE DUE: Rs X.XX (prominent)

If balanceDue = 0: "Fully Paid ✓" green banner
If balanceDue > 0: "Pay Now" button → navigate to /payment

"Download Receipt" button → fetch /customer/invoice/pdf as blob → open in browser

---

### SCREEN B9: PAYMENT (/payment)

Shows payment options.

SHOWS:
- Balance Due: Rs X.XX (large, prominent)
- Invoice breakdown (collapsed by default, expandable)

PAYMENT OPTIONS:
1. CASH option card:
   - Icon: 💵
   - Label: "Pay with Cash"
   - Subtitle: "Tell staff you're paying with cash"
   - Select → confirm dialog "Notify staff you'll pay Rs X.XX with cash"
   - POST /customer/payments { method: 'cash' }
   - Success: navigate to /invoice, show "Payment recorded! Rs X.XX"

2. ESEWA option card:
   - Icon: eSewa logo
   - Label: "Pay with eSewa"
   - Select → see eSewa flow below

ESEWA FLOW:
```
1. POST /customer/payments/esewa/initiate
   { successUrl: CUSTOMER_APP_URL + '/payment/status?success=true',
     failureUrl: CUSTOMER_APP_URL + '/payment/status?success=false' }

2. Receive formParams

3. Dynamically create + submit HTML form to eSewa:
   const form = document.createElement('form');
   form.method = 'POST';
   form.action = VITE_ESEWA_URL;
   Object.entries(formParams).forEach(([k, v]) => {
     const input = document.createElement('input');
     input.name = k; input.value = String(v);
     form.appendChild(input);
   });
   document.body.appendChild(form);
   form.submit();
   
4. eSewa redirects back to /payment/status?success=true|false
```

---

### SCREEN B10: PAYMENT STATUS (/payment/status)

AFTER ESEWA REDIRECT:

IF success=false in URL:
- Show "Payment Failed" with retry button → navigate back to /payment
- Do not poll

IF success=true in URL:
- Show "Verifying payment..." with spinner
- Start polling GET /customer/payments every 5s
- Wait for any payment with status='completed'
- On completed: show "Payment Confirmed! ✓" green screen, navigate to /invoice after 2s
- Timeout after 60s: "Payment is being processed. You can check back in a moment."
  Show "Contact staff for assistance" link

---

### SCREEN B11: WAITER REQUESTS

Available as overlay/modal from any screen (via bottom nav "Requests" tab).

Shows request list (GET /customer/waiter-requests).

REQUEST STATUS DISPLAY:
- pending: "⏳ Requested..." gray
- acknowledged: "🚶 On the way!" amber
- resolved: "✅ Done" green

REQUEST BUTTONS (one per type):
- 🔔 "Call Waiter" → POST { type: 'call_waiter' }
- 💧 "Request Water" → POST { type: 'request_water' }
- 📄 "Request Tissue" → POST { type: 'request_tissue' }

DUPLICATE GUARD:
- If request of same type is pending or acknowledged: button disabled + "Already requested"
- Enable only after resolved

Success toast: "Request sent! Staff will be with you shortly."

---

### SCREEN B12: FEEDBACK (/feedback)

Shown AFTER session completion. Also accessible from /complete screen.

FORM:
- Large star rating: 1-5 stars (tap to select)
- Stars: ☆☆☆☆☆ → clicking 3rd star → ★★★☆☆
- Comment textarea: "Tell us about your experience..." (optional, max 1000)
- "Submit Feedback" button → POST /customer/feedback { rating, comment }
- Success: "Thank you for your feedback!" → navigate to /complete

SKIP: "Skip for now" link → navigate to /complete

---

### SCREEN B13: COMPLETE (/complete)

Shown after session completion.

LARGE SUCCESS DISPLAY:
- ✅ checkmark animation
- "Thank you for dining with us!"
- Branch name
- "We hope to see you again soon."

SESSION SUMMARY (if accessible):
- Duration, items ordered, amount paid

ACTIONS:
- "Leave Feedback" → /feedback (if not yet submitted)
- "Download Receipt" → fetch /customer/invoice/pdf as blob

After 30 seconds: fade to "Scan a new QR code to start a new session"
Clear localStorage (member token) after user leaves this screen or after 10 min.

---

### SCREEN B14: ERROR (/error)

Generic error screen.

Query params: ?reason=<string>

Common messages:
- no_token: "No QR code found. Please scan the QR code on your table."
- invalid_qr: "This QR code is invalid. Please ask staff for assistance."
- session_ended: "Your session has ended."
- branch_unavailable: "This restaurant is temporarily unavailable."

Large icon, message, "Scan Again" button → navigate to /scan.

---

## PART C: SHARED UI PATTERNS

### C1: Loading States

FULL SCREEN: centered spinner for initial page loads
INLINE: skeleton cards for list content
BUTTON: loading spinner replacing text, button disabled
OVERLAY: semi-transparent overlay for form submissions

### C2: Empty States

Each list has an empty state:
- Orders: "No orders yet. Browse the menu to order!"
- Sessions: "No active sessions. Tables are available."
- Notifications: "You're all caught up!"
- Bills: "No bills recorded."
- Inventory: "No inventory items."
- Staff: "No staff members."

### C3: Confirmation Dialogs

Required for destructive actions:
- "Close Session" → "Are you sure you want to close this session? Table will be marked for cleaning."
- "Cancel Order" → requires reason input (textarea, min 1 char)
- "Delete Staff" → "This action cannot be undone."
- "Regenerate QR" → "All existing QR codes for this table will no longer work."
- "Suspend Staff" → "Staff member will lose access immediately."
- "Cancel Order (customer)" → "Cancel this order? This cannot be undone."

Dialog pattern: modal with title, message, optional input, [Cancel] and [Confirm] buttons.
Confirm button: red/destructive styling.

### C4: Toast Notifications

SUCCESS (green, 2s): "Order confirmed.", "Staff invited.", "Payment recorded.", etc.
ERROR (red, 5s): extracted from API error response
WARNING (amber, 3s): "Subscription expires in 3 days.", etc.
INFO (blue, 3s): "Refreshing..." (after action)

### C5: Responsive Breakpoints

Both apps:
- Mobile: <768px (primary for customer app)
- Tablet: 768-1024px (KDS, primary for customer browsing)
- Desktop: >1024px (primary for staff app)

Staff app: sidebar collapses to icon-only at <1024px, bottom nav at <768px.
Customer app: mobile-only layout, max-width 480px on large screens (centered card).

### C6: Invoice PDF Download Pattern

```typescript
// Pattern for PDF endpoints that need auth header:
async function downloadPdf(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
// OR for view-in-browser:
window.open(objectUrl, '_blank');
```

### C7: QR Code SVG Display

```typescript
// Render QR SVG from API response:
// GET /tables/:tableId/qr returns { svg: string }
// Render: <div dangerouslySetInnerHTML={{ __html: svgString }} />
// Or: create SVG blob URL for download
function downloadQrSvg(svgString: string, tableNumber: number) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `table-T${tableNumber}-qr.svg`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### C8: Optimistic Updates Pattern (KDS, Availability Toggle)

```typescript
// Pattern for KDS item status changes:
const mutation = useMutation({
  mutationFn: (itemId: number) => api.patch(`/order-items/${itemId}/preparing`),
  onMutate: async (itemId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['kitchen-orders', branchId] });
    // Snapshot
    const previous = queryClient.getQueryData(['kitchen-orders', branchId]);
    // Optimistic update
    queryClient.setQueryData(['kitchen-orders', branchId], (old: any) => {
      return updateItemStatus(old, itemId, 'preparing');
    });
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['kitchen-orders', branchId], context?.previous);
    toast.error(extractApiError(err).message);
  },
  onSettled: () => {
    // Always refetch after mutation
    queryClient.invalidateQueries({ queryKey: ['kitchen-orders', branchId] });
  },
});
```

### C9: Period Selector Component (Analytics)

Reusable component across all analytics screens:

```typescript
// Props: value: string, onChange: (period: string) => void
// Options: Today | This Week | This Month | This Year | Custom
// Custom: shows date range picker (from + to)
// Persists selection to URL search params
// Default: 'month' (30 days)
```

### C10: Currency Input Component

```typescript
// Displays: "Rs " prefix
// Input type: number with step=0.01 and min=0
// On change: parse float, store as number
// Display: toFixed(2)
// Never allow negative (except for internal refund form which checks against original)
```

---

## PART D: CRITICAL IMPLEMENTATION RULES FOR FRONTEND

D1. NEVER store accessToken in localStorage/sessionStorage. Memory (Zustand) only.
D2. NEVER call /payments/esewa/verify from frontend. Backend-only.
D3. ALWAYS include Authorization: Bearer header on all protected endpoints.
D4. ALWAYS decode memberToken on page load to hydrate customer session state.
D5. ALWAYS show session invoice balanceDue before showing payment button.
D6. NEVER allow adding items to cart from unavailable (isAvailable=false) menu items.
D7. ALWAYS use itemNameSnapshot and unitPrice from order (NOT from menu) when displaying existing orders.
D8. NEVER attempt to set table status via PATCH /tables/:id — always use dedicated transition endpoints.
D9. ALWAYS clear customer cart when session changes or on /scan.
D10. POLL only when tab is focused (refetchIntervalInBackground: false in TanStack Query).
D11. ALWAYS handle 429 (rate limit) gracefully with retry-after delay and user message.
D12. NEVER show "Confirm Order" button for order statuses beyond 'pending'.
D13. ALWAYS re-check session status before showing "Complete Meal" button (server guards are final authority).
D14. ALWAYS submit eSewa payment as HTML form POST (not fetch/XHR) to ESEWA_URL.
D15. Use ONLY the API responses as displayed quantities — never compute totals from menu prices for existing orders (prices may have changed).
D16. For customer app, if 401 received on ANY request: clear localStorage, redirect to /scan immediately.
D17. Staff branchId is NULL for admin role — admin must select branch from UI for branch-scoped operations.
D18. If POST /customer/qr/scan returns session.isNew=false (joining existing), do NOT show "table created" messaging.
D19. ALWAYS show disableNote to customers when isAvailable=false — this is the intended communication channel.
D20. For analytics period="today": data may be from previous day's snapshot if 00:05 job hasn't run. Show "Data updated daily at midnight" disclaimer.
