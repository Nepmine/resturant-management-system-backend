# Graph Report - resturant-management-system-backend  (2026-06-21)

## Corpus Check
- 198 files · ~76,299 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1205 nodes · 2242 edges · 89 communities (85 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3c60124`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]

## God Nodes (most connected - your core abstractions)
1. `PART A: STAFF APP — SCREEN SPECIFICATIONS` - 38 edges
2. `sendSuccess()` - 35 edges
3. `This file: every endpoint, request shapes, response shapes, enums, error codes, business rules, query params` - 35 edges
4. `AppError` - 33 edges
5. `asyncHandler()` - 30 edges
6. `validate()` - 29 edges
7. `This file: stack decisions, auth flows, state machines, routing trees, permission matrices, global patterns, polling contracts, API client architecture` - 28 edges
8. `authenticate()` - 26 edges
9. `MaHaVi Restaurant SaaS — Complete API Architecture` - 26 edges
10. `resolveTenant()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `refreshTokens()` --calls--> `verifyRefreshToken()`  [EXTRACTED]
  src/modules/auth/auth.service.ts → src/utils/jwt.ts
- `start()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.ts → src/config/database.ts
- `start()` --calls--> `disconnectDatabase()`  [EXTRACTED]
  src/server.ts → src/config/database.ts
- `authenticate()` --calls--> `extractBearerToken()`  [EXTRACTED]
  src/middleware/auth.ts → src/utils/jwt.ts
- `authenticate()` --calls--> `verifyAccessToken()`  [EXTRACTED]
  src/middleware/auth.ts → src/utils/jwt.ts

## Import Cycles
- 1-file cycle: `src/customer/orders/orders.service.ts -> src/customer/orders/orders.service.ts`

## Communities (89 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (40): KdsItemDto, KdsOrderDto, KdsQueueDto, kitchenRepository, TxClient, KDS_TRANSITIONS, kitchenService, RawKdsOrder (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (31): connectDatabase(), disconnectDatabase(), Env, envSchema, _parsed, expireSubscriptions(), lowStockAlerts(), markBillsOverdue() (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (36): sectionController, CreateSectionDto, SectionDto, UpdateSectionDto, sectionRepository, TxClient, managerPipeline, router (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (34): categoryController, CategoryDto, CreateCategoryDto, ReorderCategoriesDto, UpdateCategoryDto, categoryRepository, TxClient, managerPipeline (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (35): billController, BillDto, CreateBillDto, UpdateBillDto, billRepository, TxClient, adminPipeline, managerPipeline (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (45): dependencies, cookie-parser, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (34): COOKIE_OPTIONS, extractIp(), googleCallback(), logoutHandler(), me(), permissions(), refresh(), AuthCallbackDto (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (38): PART A: STAFF APP — SCREEN SPECIFICATIONS, SCREEN A10: CREATE PARCEL ORDER (/orders/parcel/new), SCREEN A11: ORDER DETAIL (/orders/:orderId), SCREEN A12: KITCHEN DISPLAY (KDS) (/kitchen), SCREEN A13: KDS QUEUE (/kitchen/queue), SCREEN A14: TABLES GRID (/tables), SCREEN A15: TABLE DETAIL MODAL (manager+), SCREEN A16: MENU MANAGEMENT (/menu) (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (24): restaurantController, CreateRestaurantDto, RestaurantDto, UpdateRestaurantDto, restaurantRepository, TxClient, router, createRestaurantSchema (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (24): inventoryController, AdjustStockDto, CreateInvCategoryDto, CreateInventoryItemDto, InventoryCategoryDto, InventoryItemDto, InventoryLogDto, UpdateInvCategoryDto (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (21): itemRepository, TxClient, variantController, CreateOptionDto, CreateVariantDto, OptionDto, UpdateOptionDto, UpdateVariantDto (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (15): permissionsRoute, router, LogoutBody, logoutSchema, refreshTokenSchema, router, customerMenuItemParamSchema, globalErrorHandler() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (24): 7.10 Payments (Staff-managed), 7.11 Invoices (Staff-managed), 7.12 Kitchen Display System (KDS), 7.13 Waiter Requests (Staff-managed), 7.14 Staff Management, 7.15 Inventory, 7.16 Bills, 7.17 Dashboard (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (15): adminPipeline, managerPipeline, router, staffPipeline, dashboardBranchParamSchema, orderInvoiceRouter, sessionInvoiceRouter, staffPipeline (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (15): staffController, ActivityLogDto, InviteStaffDto, StaffDto, UpdateRoleDto, staffRepository, TxClient, adminPipeline (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (20): 10. Payment Flow (Clarified), 12. Order Service (Core Business Logic), 13. Branch Creation Guard (Subscription Enforcement), 14. Google OAuth + Staff Whitelist, 15. Background Jobs, 17. Notifications Table, 19. Customer Feedback Table, 1. Project Structure (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (21): SECTION 0: SYSTEM OVERVIEW, SECTION 11: TABLE STATUS STATE MACHINE, SECTION 12: ORDER STATUS STATE MACHINE, SECTION 13: ORDER ITEM STATUS STATE MACHINE (KDS), SECTION 14: SESSION LIFECYCLE STATE MACHINE, SECTION 15: SUBSCRIPTION STATUS GATING (Admin Only), SECTION 16: WAITER REQUEST STATE MACHINE, SECTION 18: ESEWA PAYMENT FLOW (Customer App) (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (16): analyticsDateQuery, branchIdParam, intIdParam, orderIdParam, RequestSchemas, sessionIdParam, updatedAfterQuery, branchWaiterRequestsRouter (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (14): BranchComparisonDto, CustomerTrendsDto, DishSalesDto, OrderAnalyticsDto, PaymentAnalyticsDto, PeakHoursDto, RevenueAnalyticsDto, SessionDurationDto (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (19): API GROUP 22: FEEDBACK (Staff View), API GROUP 23: CUSTOMER QR SCAN (Public), API GROUP 24: CUSTOMER SESSION, API GROUP 29: CUSTOMER WAITER REQUESTS, API GROUP 30: CUSTOMER FEEDBACK, ENUM DEFINITIONS (authoritative — mirrors backend Prisma enums), GET /branches/:branchId/feedback, GET /customer/session (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (12): authenticate(), optionalAuthenticate(), memberAuth(), customerSessionController, router, AccessTokenPayload, extractBearerToken(), MemberTokenPayload (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, module, moduleDetection (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.20
Nodes (12): branchController, BranchDto, CreateBranchDto, UpdateBranchDto, adminPipeline, managerPipeline, router, staffPipeline (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (14): paymentController, PaymentDto, RefundDto, managerPipeline, orderPaymentsRouter, paymentsRouter, sessionPaymentsRouter, staffPipeline (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (10): buildLineItem(), buildOrderInvoice(), buildSessionInvoice(), toNum(), InvoiceDto, InvoiceLineItemDto, InvoiceOrderDto, generateInvoiceNumber() (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (15): PART B: CUSTOMER APP — SCREEN SPECIFICATIONS, SCREEN B10: PAYMENT STATUS (/payment/status), SCREEN B11: WAITER REQUESTS, SCREEN B12: FEEDBACK (/feedback), SCREEN B13: COMPLETE (/complete), SCREEN B14: ERROR (/error), SCREEN B1: QR SCAN LANDING (/scan), SCREEN B2: SESSION VIEW (/session) (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (8): customerMenuController, CustomerMenuCategoryDto, CustomerMenuDto, CustomerMenuItemDto, CustomerOptionDto, CustomerOptionGroupDto, customerMenuRepository, customerMenuService

### Community 27 - "Community 27"
Cohesion: 0.20
Nodes (6): waiterRequestController, WaiterRequestDto, TxClient, waiterRequestRepository, customerWaiterRequestService, waiterRequestService

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (13): API GROUP 20: ANALYTICS, GET /branches/:branchId/analytics/customer-trends, GET /branches/:branchId/analytics/dish-sales, GET /branches/:branchId/analytics/orders, GET /branches/:branchId/analytics/payments, GET /branches/:branchId/analytics/peak-hours, GET /branches/:branchId/analytics/revenue, GET /branches/:branchId/analytics/session-duration (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (9): analyticsController, adminPipeline, branchAnalyticsRouter, managerPipeline, restaurantAnalyticsRouter, analyticsBranchParamSchema, analyticsRestaurantParamSchema, periodQuerySchema (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.24
Nodes (7): branchRepository, TxClient, dashboardController, AdminDashboardDto, BranchDashboardDto, StaffDashboardDto, dashboardService

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (12): API GROUP 17: INVENTORY, DELETE /branches/:branchId/inventory/categories/:categoryId, DELETE /branches/:branchId/inventory/:itemId, GET /branches/:branchId/inventory, GET /branches/:branchId/inventory/categories, GET /branches/:branchId/inventory/:itemId/logs, GET /branches/:branchId/inventory/low-stock, PATCH /branches/:branchId/inventory/categories/:categoryId (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (9): paginationQuery, sessionController, branchSessionsRouter, sessionsRouter, staffPipeline, activeSessionsQuerySchema, sessionBranchParamSchema, sessionParamSchema (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.26
Nodes (8): SessionDetailDto, SessionMemberDto, SessionSummaryDto, sessionRepository, TxClient, formatDetail(), formatSummary(), RawSession

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (11): C10: Currency Input Component, C1: Loading States, C2: Empty States, C3: Confirmation Dialogs, C4: Toast Notifications, C5: Responsive Breakpoints, C6: Invoice PDF Download Pattern, C7: QR Code SVG Display (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (10): 8.1 QR Entry Point (Public), 8.2 Customer Session, 8.3 Customer Menu, 8.4 Customer Orders, 8.5 Customer Payments, 8.6 Customer Invoices, 8.7 Customer Waiter Requests, 8.8 Customer Feedback (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (6): router, customerOrderInvoiceParamSchema, asyncHandler(), router, esewaInitiateSchema, initiatePaymentSchema

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (7): kitchenController, branchKitchenRouter, orderItemsRouter, staffPipeline, kitchenBranchParamSchema, kitchenQuerySchema, orderItemParamSchema

### Community 38 - "Community 38"
Cohesion: 0.24
Nodes (7): notificationController, NotificationDto, notificationService, router, notificationParamSchema, notificationsQuerySchema, staffPipeline

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (8): drawHRule(), formatNPR(), InvoiceData, InvoiceItemLine, InvoiceOrder, InvoicePaymentLine, renderInvoice(), renderTotalRow()

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (9): API GROUP 6: TABLES, DELETE /branches/:branchId/tables/:tableId, GET /branches/:branchId/tables, GET /tables/:tableId/qr, PATCH /branches/:branchId/tables/:tableId, POST /branches/:branchId/tables, POST /tables/:tableId/available, POST /tables/:tableId/cleaning (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.28
Nodes (4): AppError, Errors, CustomerSessionDto, customerSessionService

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (7): router, addItemsSchema, cancelCustomerOrderSchema, customerOrderParamSchema, customerOrderQuerySchema, orderItemInputSchema, placeOrderSchema

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (8): 2.1 Token Architecture, 2.2 Auth State Machine, 2.3 Login Flow, 2.4 Token Refresh, 2.5 Logout, 2.6 Permission Enforcement (Frontend), 2.7 GET /me/permissions Response, SECTION 2: STAFF APP — AUTH FLOW STATE MACHINE

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (8): API GROUP 15: STAFF MANAGEMENT, DELETE /staff/:staffId, GET /staff, GET /staff/:staffId/logs, PATCH /staff/:staffId/role, PATCH /staff/:staffId/suspend, PATCH /staff/:staffId/whitelist, POST /staff/invite

### Community 45 - "Community 45"
Cohesion: 0.32
Nodes (5): customerInvoiceController, invoiceController, streamInvoicePdf(), customerInvoiceService, invoiceService

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (7): API GROUP 11: ORDERS (Staff), GET /branches/:branchId/orders, GET /orders/:orderId, PATCH /orders/:orderId/cancel, PATCH /orders/:orderId/items/:itemId/cancel, PATCH /orders/:orderId/status, POST /orders/parcel

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (7): API GROUP 1: AUTHENTICATION, GET /auth/google, GET /auth/google/callback, GET /auth/me, GET /me/permissions, POST /auth/logout, POST /auth/refresh

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (7): API GROUP 4: BRANCHES, DELETE /branches/:branchId, GET /branches, GET /branches/:branchId, PATCH /branches/:branchId, PATCH /branches/:branchId/toggle, POST /branches

### Community 49 - "Community 49"
Cohesion: 0.29
Nodes (7): API GROUP 9: MENU VARIANTS, DELETE /menu/items/:itemId/variants/:variantId, DELETE /menu/items/:itemId/variants/:variantId/options/:optionId, PATCH /menu/items/:itemId/variants/:variantId, PATCH /menu/items/:itemId/variants/:variantId/options/:optionId, POST /menu/items/:itemId/variants, POST /menu/items/:itemId/variants/:variantId/options

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (6): API GROUP 12: KITCHEN / KDS, GET /branches/:branchId/kitchen/orders, GET /branches/:branchId/kitchen/queue, PATCH /order-items/:itemId/delivered, PATCH /order-items/:itemId/preparing, PATCH /order-items/:itemId/ready

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (6): API GROUP 18: BILLS, DELETE /branches/:branchId/bills/:billId, GET /branches/:branchId/bills, PATCH /branches/:branchId/bills/:billId, PATCH /branches/:branchId/bills/:billId/pay, POST /branches/:branchId/bills

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (6): API GROUP 26: CUSTOMER ORDERS, GET /customer/orders, GET /customer/orders/:orderId, POST /customer/orders, POST /customer/orders/:orderId/cancel, POST /customer/orders/:orderId/items

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (6): API GROUP 7: MENU CATEGORIES, DELETE /branches/:branchId/menu/categories/:categoryId, GET /branches/:branchId/menu/categories, PATCH /branches/:branchId/menu/categories/:categoryId, PATCH /branches/:branchId/menu/categories/reorder, POST /branches/:branchId/menu/categories

### Community 54 - "Community 54"
Cohesion: 0.33
Nodes (6): API GROUP 8: MENU ITEMS, DELETE /menu/items/:itemId, GET /menu/items/:itemId, PATCH /menu/items/:itemId, PATCH /menu/items/:itemId/availability, POST /menu/categories/:categoryId/items

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): Companion files: FRONTEND_MEMORY_1_ARCHITECTURE.md, FRONTEND_MEMORY_2_API_CONTRACTS.md, MAHAVI_FRONTEND_MEMORY_3_UI_SCREENS, PART D: CRITICAL IMPLEMENTATION RULES FOR FRONTEND, This file: every screen in both apps, component behaviors, form logic, navigation flows, KDS UI, customer ordering UX, Version: 1.0 | Generated from complete backend implementation

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (5): API GROUP 13: PAYMENTS (Staff), GET /orders/:orderId/payments, GET /sessions/:sessionId/payments, POST /payments/esewa/verify, POST /payments/:paymentId/refund

### Community 57 - "Community 57"
Cohesion: 0.40
Nodes (5): API GROUP 14: INVOICES (Staff), GET /orders/:orderId/invoice, GET /orders/:orderId/invoice/pdf, GET /sessions/:sessionId/invoice, GET /sessions/:sessionId/invoice/pdf

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (5): API GROUP 28: CUSTOMER INVOICES, GET /customer/invoice, GET /customer/invoice/pdf, GET /customer/orders/:orderId/invoice, GET /customer/orders/:orderId/invoice/pdf

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (5): API GROUP 2: RESTAURANTS, DELETE /restaurants/:id, GET /restaurants/:id, PATCH /restaurants/:id, POST /restaurants

### Community 60 - "Community 60"
Cohesion: 0.40
Nodes (5): API GROUP 3: SUBSCRIPTIONS, GET /restaurants/:id/subscription, GET /restaurants/:id/subscriptions, POST /restaurants/:id/subscription/cancel, POST /restaurants/:id/subscription/upgrade

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (5): API GROUP 5: SECTIONS, DELETE /branches/:branchId/sections/:sectionId, GET /branches/:branchId/sections, PATCH /branches/:branchId/sections/:sectionId, POST /branches/:branchId/sections

### Community 62 - "Community 62"
Cohesion: 0.40
Nodes (4): AuthenticatedMemberRequest, AuthenticatedStaffRequest, Request, User

### Community 63 - "Community 63"
Cohesion: 0.50
Nodes (4): 11. Invoice Module, Invoice Response Shape, Invoice Schema, PDF Generation

### Community 64 - "Community 64"
Cohesion: 0.50
Nodes (4): 16. Analytics Snapshot Tables, `daily_branch_metrics`, `daily_item_metrics`, `staff_daily_metrics`

### Community 65 - "Community 65"
Cohesion: 0.50
Nodes (3): Companion files: FRONTEND_MEMORY_2_API_CONTRACTS.md, FRONTEND_MEMORY_3_UI_SCREENS.md, MAHAVI_FRONTEND_MEMORY_1_ARCHITECTURE, Version: 1.0 | Generated from complete backend implementation

### Community 66 - "Community 66"
Cohesion: 0.50
Nodes (4): 10.1 API Error Extraction, 10.2 Error Code → User Message Map, 10.3 Toast Configuration, SECTION 10: ERROR HANDLING PATTERNS

### Community 67 - "Community 67"
Cohesion: 0.50
Nodes (4): 17.1 Staff Invoice Access, 17.2 Customer Invoice Access, 17.3 Invoice Data Shape (used for display in both apps), SECTION 17: INVOICE FLOW

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (4): 3.1 Token Architecture, 3.2 Customer App State Machine, 3.3 Customer App Entry Points, SECTION 3: CUSTOMER APP — AUTH FLOW STATE MACHINE

### Community 69 - "Community 69"
Cohesion: 0.50
Nodes (4): 6.1 Axios Instance — Staff App, 6.2 Axios Instance — Customer App, 6.3 Response Envelope Handling, SECTION 6: API CLIENT ARCHITECTURE

### Community 70 - "Community 70"
Cohesion: 0.50
Nodes (4): 7.1 Staff App Polling, 7.2 Customer App Polling, 7.3 Polling Implementation Pattern, SECTION 7: POLLING CONTRACTS

### Community 71 - "Community 71"
Cohesion: 0.50
Nodes (4): 9.1 Staff App Auth Store, 9.2 Customer App Member Store, 9.3 Cart Store (Customer App), SECTION 9: ZUSTAND STORE CONTRACTS

### Community 72 - "Community 72"
Cohesion: 0.50
Nodes (3): Companion files: FRONTEND_MEMORY_1_ARCHITECTURE.md, FRONTEND_MEMORY_3_UI_SCREENS.md, MAHAVI_FRONTEND_MEMORY_2_API_CONTRACTS, Version: 1.0 | Generated from complete backend implementation

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (4): API GROUP 10: SESSIONS (Staff), GET /branches/:branchId/sessions/active, GET /sessions/:sessionId, POST /sessions/:sessionId/close

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (4): API GROUP 16: WAITER REQUESTS (Staff), GET /branches/:branchId/waiter-requests, PATCH /waiter-requests/:requestId/acknowledge, PATCH /waiter-requests/:requestId/resolve

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (4): API GROUP 19: DASHBOARD, GET /dashboard, GET /dashboard/admin, GET /dashboard/branch/:branchId

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (4): API GROUP 21: NOTIFICATIONS, GET /notifications, PATCH /notifications/:notificationId/read, PATCH /notifications/read-all

### Community 77 - "Community 77"
Cohesion: 0.50
Nodes (4): API GROUP 25: CUSTOMER MENU, GET /customer/menu, GET /customer/menu/categories, GET /customer/menu/items/:itemId

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): API GROUP 27: CUSTOMER PAYMENTS, GET /customer/payments, POST /customer/payments, POST /customer/payments/esewa/initiate

### Community 79 - "Community 79"
Cohesion: 0.67
Nodes (3): 18. Security Tables, `login_history`, `refresh_tokens`

### Community 80 - "Community 80"
Cohesion: 0.67
Nodes (3): 4.1 Staff JWT (access token, 15 min), 4.2 Member JWT (customer token, 6 h), 4. Two Auth Contexts

## Knowledge Gaps
- **485 isolated node(s):** `name`, `version`, `description`, `main`, `postinstall` (+480 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `Community 41` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 18`, `Community 20`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 30`, `Community 33`, `Community 38`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `This file: every endpoint, request shapes, response shapes, enums, error codes, business rules, query params` connect `Community 19` to `Community 28`, `Community 31`, `Community 40`, `Community 44`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `sendSuccess()` connect `Community 6` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 20`, `Community 22`, `Community 23`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 32`, `Community 37`, `Community 38`, `Community 45`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _485 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.051587301587301584 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06363636363636363 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06262626262626263 - nodes in this community are weakly interconnected._