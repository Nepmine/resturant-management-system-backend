PROJECT_MEMORY_V1.md
MaHaVi Restaurant SaaS — Complete Implementation Memory
Stack: Node.js · TypeScript · PostgreSQL · Prisma · Express · Google OAuth · JWT

Document authority: The API Design document (§3 Prisma models, §4–24) is the authoritative/evolved spec. The DBML schema predates it. Where the two conflict, the API design wins — conflicts are flagged inline with [CONFLICT] notes so an implementer can reconcile the DBML file.


PART 0 — NON-NEGOTIABLE IMPLEMENTATION RULES
These rules are absolute. They override any local inference an implementer might make.
AUTHORITY & CONFLICTS
  API design > DBML schema > any inference
  Prisma model > raw SQL example if definitions conflict

DATA INTEGRITY
  Never hard-delete any record with deleted_at — use soft delete
  Never update payment rows — append-only; refund = new negative row
  Never store computed invoice content — generate on-demand, track number only
  Prices snapshot at order creation — menu changes never alter existing order_items
  Order history is immutable after creation

QUERYING
  Every query on a soft-deletable table MUST include WHERE deleted_at IS NULL
  Every write is tenant-scoped (restaurant_id or branch_id on all relevant tables)
  Analytics queries read snapshot tables ONLY — never aggregate raw orders/payments

AUTH ISOLATION
  Staff JWT (JWT_ACCESS_SECRET) and Member JWT (JWT_MEMBER_SECRET) are completely separate
  Member tokens carry sessionId — never grant access outside that session
  is_active on staff is re-checked every request, not just at login

SESSION & TABLE RULES
  Sessions are created ONLY via QR scan — never by staff directly
  Maximum one active session per table — enforced by partial unique index + FOR UPDATE
  Table status transitions: available→occupied (QR scan), occupied→cleaning (session close), cleaning→available (staff action)
  Table status is NEVER set via generic PATCH — only via dedicated transition endpoints

ORDER RULES
  Order status is DERIVED from item statuses — never set independently (except pending→confirmed)
  pending→confirmed is the only manual order transition (sets accepted_by_staff_id)
  All further order status changes are auto-derived when item statuses change via KDS

ARCHITECTURE
  Controllers hold zero business logic — only parse req/res, call service, return response
  Services own all business logic and transaction boundaries
  All customer routes derive branchId from req.member.branchId — no branch URL param
  Inventory is manual-only — no automatic deduction on order placement (v1 scope decision)

PART A — PROJECT STRUCTURE & CONFIGURATION
A1. Directory Structure
mahavi-api/
├── src/
│   ├── config/
│   │   ├── env.ts                    # Zod-validated env vars (single source of truth)
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
│   ├── modules/                      # Staff-facing feature modules
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
│   ├── customer/                     # Dedicated customer-facing module
│   │   ├── customer.router.ts        # All /customer/* routes
│   │   ├── qr/
│   │   ├── session/
│   │   ├── menu/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── invoices/
│   │   └── waiter-requests/
│   ├── jobs/
│   │   ├── snapshotMetrics.ts        # Daily branch/item/staff metrics (00:05 daily)
│   │   ├── expireSubscriptions.ts    # Expire grace periods (every hour)
│   │   ├── lowStockAlerts.ts         # Low stock notifications (every 6 hours)
│   │   └── markBillsOverdue.ts       # Mark overdue bills (nightly)
│   ├── utils/
│   │   ├── jwt.ts                    # Staff JWT + member JWT (separate secrets)
│   │   ├── pagination.ts
│   │   ├── apiResponse.ts
│   │   ├── pdf.ts                    # Invoice PDF generation (pdfkit or puppeteer)
│   │   └── auditLog.ts
│   ├── types/
│   │   ├── express.d.ts              # req.user, req.tenant, req.member
│   │   └── enums.ts
│   └── app.ts / server.ts
├── prisma/schema.prisma
├── tests/
├── .env.example
└── docker-compose.yml
A1b. Module File Layout & Layer Conventions
Every module under src/modules/<name>/ and src/customer/<name>/ follows this structure:
orders/
  orders.routes.ts     # Express router: mounts middleware chain, calls controller
  orders.controller.ts # Thin: parse req → call service → send response. Zero business logic.
  orders.service.ts    # Owns all business logic, transactions, and side effects
  orders.repository.ts # Wraps Prisma only. No logic — just DB calls
  orders.dto.ts        # TypeScript interfaces for request/response shapes
  orders.schema.ts     # Zod schemas (colocated with DTOs); imported by validate() middleware
Layer rules:

routes → only wires middleware: authenticate → authorize → validate(schema) → controller
controller → calls one service method per handler; never touches Prisma directly
service → owns prisma.$transaction, business rules, audit log calls, notification inserts
repository → thin Prisma wrappers; reused by service to avoid duplicated queries
dto/schema → Zod schema is the single source for both runtime validation and TypeScript types via z.infer<>

typescriptconst envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_MEMBER_SECRET: z.string().min(32),     // separate secret for customer member tokens
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

PART B — DATABASE SCHEMA

ID type note: DBML uses uuid PKs with gen_random_uuid(). API Prisma models use Int with autoincrement(). The Prisma model is authoritative for implementation — use Int IDs. DBML UUIDs reflect an earlier design.

B1. Enums — Canonical List (Authoritative: API Prisma)
All enums below are the final authoritative values from the API design. DBML variants that differ are noted with [DBML had: ...].
prismaenum SubscriptionPlan   { trial monthly yearly }                         // DBML: missing
enum SubscriptionStatus { active grace_period expired cancelled }         // DBML: missing

enum StaffRole          { staff manager admin }                          // DBML had: admin | staff (no manager)
enum TableStatus        { available occupied cleaning }                  // DBML: same
enum SessionStatus      { active completed abandoned }                   // DBML had: active | completed | cancelled
enum OrderType          { dine_in parcel }                               // DBML: missing
enum OrderStatus        { pending confirmed preparing ready delivered cancelled } // DBML had 4 values: pending|preparing|completed|cancelled
enum ItemStatus         { pending preparing ready delivered cancelled }   // DBML: missing (item-level status)
enum PaymentStatus      { pending completed failed refunded }            // DBML had: pending|paid|failed|refunded (paid→completed)
enum PaymentMethod      { esewa cash }                                   // DBML: same
enum RequestType        { call_waiter request_water request_tissue }     // DBML had: waiter|water|tissue (renamed)
enum RequestStatus      { pending acknowledged resolved }                // DBML had: pending|resolved (no acknowledged)
enum BillType           { electricity rent water internet other }         // DBML: missing
enum BillStatus         { unpaid paid overdue }                          // DBML: missing
enum InvChangeType      { add remove adjust }                            // DBML: inv_change_type (same values)
B1b. Prisma Relation Definitions (Complex Models)
Only the models with non-obvious relation wiring are shown. Simple FK-only models (inventory_logs, activity_logs, etc.) follow the same pattern.
prismamodel Branch {
  id           Int      @id @default(autoincrement())
  restaurantId Int      @map("restaurant_id")
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  staff        StaffUser[]
  sections     Section[]
  tables       Table[]
  menuCategories MenuCategory[]
  orders       Order[]
  diningSession DiningSession[]
  @@map("branches")
}

model StaffUser {
  id       Int     @id @default(autoincrement())
  branchId Int?    @map("branch_id")
  branch   Branch? @relation(fields: [branchId], references: [id])
  acceptedOrders Order[] @relation("AcceptedBy")
  @@map("staff_users")
}

model DiningSession {
  id         Int      @id @default(autoincrement())
  tableId    Int      @map("table_id")
  branchId   Int      @map("branch_id")
  table      Table    @relation(fields: [tableId], references: [id])
  branch     Branch   @relation(fields: [branchId], references: [id])
  members    SessionMember[]
  orders     Order[]
  payments   Payment[]
  @@map("dining_sessions")
}

model Order {
  id                 Int            @id @default(autoincrement())
  sessionId          Int?           @map("session_id")
  branchId           Int            @map("branch_id")
  memberId           Int?           @map("member_id")
  acceptedByStaffId  Int?           @map("accepted_by_staff_id")
  session            DiningSession? @relation(fields: [sessionId], references: [id])
  branch             Branch         @relation(fields: [branchId], references: [id])
  member             SessionMember? @relation(fields: [memberId], references: [id])
  acceptedBy         StaffUser?     @relation("AcceptedBy", fields: [acceptedByStaffId], references: [id])
  items              OrderItem[]
  payments           Payment[]
  @@map("orders")
}

model OrderItem {
  id       Int    @id @default(autoincrement())
  orderId  Int    @map("order_id")
  order    Order  @relation(fields: [orderId], references: [id])
  options  OrderItemOption[]
  @@map("order_items")
}

model Payment {
  id        Int           @id @default(autoincrement())
  sessionId Int           @map("session_id")
  orderId   Int?          @map("order_id")
  memberId  Int?          @map("member_id")
  session   DiningSession @relation(fields: [sessionId], references: [id])
  order     Order?        @relation(fields: [orderId], references: [id])
  member    SessionMember? @relation(fields: [memberId], references: [id])
  @@map("payments")
}

B2. Core Tables — Full Schema (DBML + API Prisma merged)

For each table: DBML is the field-level definition. API Prisma snippets are shown where they add/change fields. The Implementation column is what to build.


B2.1 staff / staff_users

DBML name: staff. Prisma name: StaffUser / staff_users.

FieldTypeConstraintsNotesidInt / uuidPK, autoincrementuuid in DBMLnamevarchar(100)NOT NULLemailvarchar(150)UNIQUE, NOT NULLroleStaffRoleNOT NULL, default: staffDBML had only admin|staff; API adds manageroauth_providervarchar(50)NOT NULLe.g. 'google'oauth_idvarchar(255)UNIQUE, NOT NULLSet on first Google loginis_activebooleanNOT NULL, default: trueWhitelist flag; checked on every requestbranch_idIntnullable FK → branches[API adds] staff scoped to a branchcreated_attimestamptzNOT NULL, default: now()deleted_attimestamptznullableSoft delete
DBML Indexes: none beyond PK/unique.

B2.2 restaurants
FieldTypeConstraintsNotesidInt / uuidPKnamevarchar(150)NOT NULLaddresstextnullablebilling_emailvarchar(150)nullable[API adds, for subscription billing]created_attimestamptzNOT NULL, default: now()deleted_attimestamptznullableSoft delete

B2.3 subscriptions

Not in DBML — fully defined in API design. This is the tenant gate.

sqlCREATE TABLE subscriptions (
  id              SERIAL PRIMARY KEY,
  restaurant_id   INT NOT NULL REFERENCES restaurants(id),
  plan            subscription_plan NOT NULL DEFAULT 'trial',
  status          subscription_status NOT NULL DEFAULT 'active',
  max_branches    INT NOT NULL DEFAULT 1,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  grace_expires_at TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (restaurant_id, status)
);
Branch creation guard: Row-level lock on subscriptions table prevents race conditions when two concurrent requests try to create the nth+1 branch.
typescriptasync createBranch(restaurantId: number, dto: CreateBranchDto) {
  return prisma.$transaction(async (tx) => {
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

B2.4 branches

Not in DBML. Defined in API design. The tenant's operational unit — all analytics, orders, and staff are branch-scoped.

sqlCREATE TABLE branches (
  id            SERIAL PRIMARY KEY,
  restaurant_id INT NOT NULL REFERENCES restaurants(id),
  name          VARCHAR(150) NOT NULL,
  address       TEXT,
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  INDEX (restaurant_id)
);

B2.5 sections (formerly floors)

DBML name: floors. API name: sections. These are the same concept — named areas within a branch (e.g. "Ground Floor", "Rooftop").

FieldDBML (floors)API (sections)Notesiduuid PKInt PKrestaurant_idFK → restaurants—DBML scoped to restaurantbranch_id—FK → branchesAPI scoped to branch (finer)floor_numberint NOT NULL—DBML had numeric; API drops thislabel / namevarchar(50) nullablevarchar(100) NOT NULLRenamed to name in APIsort_order—int default 0API addscreated_attimestamptztimestamptzdeleted_attimestamptztimestamptz
DBML Index: (restaurant_id, floor_number) UNIQUE.
API Index: (branch_id, sort_order).

B2.6 tables
FieldTypeConstraintsNotesidInt / uuidPKsection_id / floor_idIntNOT NULL, FK → sectionsDBML: floor_id; API: section_idbranch_idIntNOT NULL, FK → branches[API adds] denormalized for fast queriestable_number / table_nointNOT NULLlabelvarchar(50)nullableHuman-readable labelstatusTableStatusNOT NULL, default: availableavailable → occupied → cleaning → availableqr_tokenvarchar(255)UNIQUE, NOT NULLGenerated via crypto.randomBytes(32).toString('hex') → 64-char hex string. Never sequential, never predictable. Regenerated via dedicated endpoint only — never as part of a generic PATCH.created_attimestamptzNOT NULLdeleted_attimestamptznullableSoft delete
Indexes: (section_id, table_number) UNIQUE; qr_token; (branch_id, status).
Table status lifecycle:

available → occupied: automatically when customer scans QR and no active session exists (atomic in QR scan transaction)
occupied → cleaning: when session is completed (customer clicks "Complete Meal" or staff closes session)
cleaning → available: explicit staff action via POST /tables/:id/available
Status transitions enforced via dedicated endpoints only — generic PATCH is not used for status


B2.7 session_members

Not in DBML. Added by API design. Tracks individual customers within a session (multiple people can scan the same QR).

sqlCREATE TABLE session_members (
  id           SERIAL PRIMARY KEY,
  session_id   INT NOT NULL REFERENCES dining_sessions(id),
  name         VARCHAR(100) NOT NULL,
  phone        VARCHAR(20),                    -- optional
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (session_id)
);

DBML customers table comparison: DBML had a customers table (id, session_id, name, phone, created_at). The API renames this concept to session_members. The fields are equivalent. Use session_members in implementation.


B2.8 dining_sessions
FieldDBMLAPI PrismaImplementationiduuidInt autoincrementInttable_iduuid FK NOT NULLInt FK NOT NULLInt FKbranch_idmissingInt NOT NULL denormalizedAdd branch_idstatussession_status (active/completed/cancelled)SessionStatus (active/completed/abandoned)Use API enumstarted_attimestamptz NOT NULLDateTime default now()completed_attimestamptz nullableDateTime?completed_byuuid FK → staff nullablenot in Prisma snippetKeep from DBML — null means customer completedcreated_attimestamptz NOT NULL—Keep
Indexes: (branch_id, status); (table_id, status).
Active session uniqueness — DB-level enforcement (Issue 4):
sqlCREATE UNIQUE INDEX dining_sessions_one_active_per_table
  ON dining_sessions (table_id)
  WHERE status = 'active';
This partial unique index guarantees at most one active session per table at the database level. The QR scan transaction's FOR UPDATE lock on the table row handles the concurrent-creation race, but this index is the final backstop — even if two transactions slip through simultaneously, only one INSERT will succeed. Both mechanisms are required.
Note: Sessions are never manually created by staff. Creation is automatic on first QR scan (atomic transaction). No staff_id required for creation.

B2.9 menu_categories
FieldTypeConstraintsNotesidInt / uuidPKbranch_idIntNOT NULL, FK → branches[API: scoped to branch, not restaurant]restaurant_iduuidDBML had restaurant-scoped[CONFLICT: DBML scoped to restaurant, API scopes to branch]namevarchar(100)NOT NULLsort_orderintNOT NULL, default: 0created_attimestamptzNOT NULLdeleted_attimestamptznullableSoft delete
Index: (branch_id).

B2.10 menu_items
FieldTypeConstraintsNotesidInt / uuidPKcategory_idIntNOT NULL, FK → menu_categoriesnamevarchar(150)NOT NULLdescriptiontextnullablebase_pricenumeric(10,2)NOT NULLBase before variant modifiersimage_urltextnullableExternal URL only — not stored locallyis_availablebooleanNOT NULL, default: trueStaff-controlled visibility toggledisable_notevarchar(255)nullablee.g. "Out of stock today" — shown to customerssort_orderintNOT NULL, default: 0created_attimestamptzNOT NULLdeleted_attimestamptznullableSoft delete
Indexes: (category_id); (is_available).

B2.11 menu_item_option_groups (Variant Groups)
Variant groups define axes of customization: e.g. "Type" (Steam/Fried/Jhol), "Protein" (Veg/Chicken).
FieldTypeConstraintsNotesidInt / uuidPKmenu_item_idIntNOT NULL, FK → menu_itemsnamevarchar(100)NOT NULLe.g. "Type", "Protein"is_requiredbooleanNOT NULL, default: truesort_orderintNOT NULL, default: 0deleted_attimestamptznullable
Index: (menu_item_id).

B2.12 menu_item_options (Individual Options within a Group)
Individual options within a group: e.g. Steam (+0), Jhol (+30).
FieldTypeConstraintsNotesidInt / uuidPKgroup_idIntNOT NULL, FK → menu_item_option_groupsnamevarchar(100)NOT NULLe.g. "Steam", "Chicken"price_modifier / extra_pricenumeric(10,2)NOT NULL, default: 0Added to base_price at order timesort_orderintNOT NULL, default: 0deleted_attimestamptznullable
Index: (group_id).

B2.13 orders
The API Prisma model is authoritative here — it has significant additions over DBML.
FieldDBMLAPI PrismaNotesiduuidInt autoincrementUse Intsession_idNOT NULL FKnullable — null for parcel orders[CONFLICT: DBML required session; API allows null]branch_idmissingInt NOT NULL denormalizedAdd — set immutably at creationcustomer_idNOT NULL FK → customersreplaced by member_id nullable[CONFLICT: DBML had customer_id required]member_idmissingInt? FK → session_membersnull for parcel/staff-placed ordersorder_typemissingOrderType default dine_inAPI addsis_parcelboolean default falseboolean default falseSamecustomer_namemissingString?For parcel orderscustomer_phonemissingString?For parcel ordersstatusorder_status (4 vals)OrderStatus (6 vals)Use 6-value API enumnotes / notetextString?Same purposeaccepted_by_staff_idmissingInt? FK → staff_usersSet when staff advances status pending→confirmed; drives staff_daily_metricscreated_attimestamptzDateTimeupdated_attimestamptzDateTime @updatedAtdeleted_attimestamptz—Keep from DBML
Indexes: (branch_id, status); (branch_id, order_type); (branch_id, created_at); (session_id).

B2.14 order_items
FieldTypeConstraintsNotesidInt / uuidPKorder_idIntNOT NULL, FK → ordersmenu_item_idIntNOT NULL, FK → menu_itemsvariant_idIntnullable, FK → menu_item_options[API adds — DBML used order_item_options join table instead]quantityintNOT NULL, default: 1unit_pricenumeric(10,2)NOT NULLSnapshot at time of order — menu edits never affect historyitem_name_snapshotvarchar(150)NOT NULL[API adds] snapshot of namevariant_name_snapshotvarchar(100)nullable[API adds] snapshot of variant namestatusItemStatusNOT NULL, default: pending[API adds] per-item lifecyclenotetextnullablee.g. "less spicy, extra chutney"created_attimestamptzNOT NULLdeleted_attimestamptznullable
Index: (order_id).

B2.15 order_item_options

DBML had this as a separate join table storing snapshots of which options were selected. The API Prisma model inlines the variant onto order_items via variant_id + variant_name_snapshot. Keep order_item_options from DBML for multi-option scenarios (when a customer picks multiple options from multiple groups).

FieldTypeNotesiduuid / IntPKorder_item_idFK → order_itemsNOT NULLmenu_item_option_idFK → menu_item_optionsNOT NULLoption_namevarchar(100)NOT NULL — snapshotprice_modifiernumeric(10,2)NOT NULL — snapshot
Index: (order_item_id).

B2.16 payments
FieldDBMLImplementationNotesiduuidInt PKsession_idFK NOT NULLFK NOT NULLcustomer_id / member_idFK nullableFK nullable → session_membersnull = whole-table paymentorder_idmissingInt? FK → orders[API adds] per-order payment linkamountnumeric(10,2)numeric(10,2)NOT NULLmethodpayment_methodPaymentMethodesewa | cashstatuspayment_status (paid)PaymentStatus (completed)DBML had paid, API has completedesewa_ref_idvarchar(255) nullablevarchar(255) nullableeSewa transaction referenceesewa_pidvarchar(255) nullablevarchar(255) nullableeSewa product ID for verificationpaid_attimestamptz nullabletimestamptz nullablecreated_attimestamptz NOT NULLtimestamptz NOT NULL
Payments are append-only. Refund = new row with negative amount. Never update existing rows.
Overpayment prevention (Issue 2): Before inserting any payment row, the payment service MUST verify:
typescriptconst invoiceTotal = /* sum of unit_price * quantity for all non-cancelled order_items in session */;
const alreadyPaid  = /* sum(amount) FROM payments WHERE session_id = ? AND status = 'completed' */;
const remaining    = invoiceTotal - alreadyPaid;
if (requestedAmount > remaining) throw new AppError('Payment exceeds balance due', 400, 'OVERPAYMENT');
This check runs inside the same transaction as the INSERT to prevent race conditions between concurrent payers.
Indexes: (session_id); (status); (esewa_ref_id).

B2.17 waiter_requests
FieldDBMLAPIImplementationiduuidIntIntsession_idFK NOT NULLFK NOT NULLtyperequest_type (waiter|water|tissue)RequestType (call_waiter|request_water|request_tissue)Use API valuesstatusrequest_status (pending|resolved)RequestStatus (pending|acknowledged|resolved)Use 3-value API enumresolved_byFK → staff nullableFK → staff nullableresolved_attimestamptz nullabletimestamptz nullableacknowledged_atmissingtimestamptz nullable[API adds for acknowledged state]created_attimestamptztimestamptz
Indexes: (session_id); (status).

B2.18 inventory_categories

Not in DBML. Added by API design. Groups inventory items within a branch.

sqlCREATE TABLE inventory_categories (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id),
  name        VARCHAR(80) NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  INDEX (branch_id, sort_order)
);
-- inventory_items.category_id → inventory_categories(id) nullable FK

B2.19 inventory_items
FieldDBMLImplementationNotesiduuidInt PKrestaurant_idFK NOT NULLbranch_id FK NOT NULL[CONFLICT: DBML was restaurant-scoped; API branch-scoped]category_idmissingInt? FK → inventory_categories[API adds]namevarchar(150) NOT NULLvarchar(150) NOT NULLunitvarchar(50) NOT NULLvarchar(50) NOT NULLe.g. "kg", "litre", "pcs"quantitynumeric(10,3) default 0numeric(10,3) default 0Current stock levellow_stock_thresholdnumeric(10,3) default 0numeric(10,3) default 0Triggers alerts when quantity ≤ thiscreated_attimestamptztimestamptzupdated_attimestamptztimestamptz @updatedAtdeleted_attimestamptztimestamptz
Index: (branch_id).

B2.20 inventory_logs
FieldTypeConstraintsNotesidInt / uuidPKitem_idIntNOT NULL, FK → inventory_itemschanged_byIntNOT NULL, FK → staffchange_typeInvChangeTypeNOT NULLadd | remove | adjustquantity_deltanumeric(10,3)NOT NULLPositive = added, negative = removednotetextnullablecreated_attimestamptzNOT NULL
Indexes: (item_id); (created_at).

B2.21 activity_logs
FieldTypeConstraintsNotesidInt / uuidPKstaff_idIntNOT NULL, FK → staffbranch_idIntFK → branches[API adds — DBML missing]actionvarchar(100)NOT NULLe.g. "order.status.updated", "menu_item.hidden"target_typevarchar(50)NOT NULLe.g. "order", "menu_item"target_idIntNOT NULLmetajsonbnullableold/new values or any extra contextcreated_attimestamptzNOT NULLaction_typevarchar(50)NOT NULL[API adds] e.g. "order_placed", "item_cancelled"
Indexes: (staff_id); (target_type); (created_at); (branch_id).

B2.22 bills

Not in DBML. Defined in API design. Tracks branch operational expenses.

sqlCREATE TABLE bills (
  id          SERIAL PRIMARY KEY,
  branch_id   INT NOT NULL REFERENCES branches(id),
  type        bill_type NOT NULL,         -- electricity | rent | water | internet | other
  status      bill_status NOT NULL DEFAULT 'unpaid',  -- unpaid | paid | overdue
  amount      NUMERIC(12,2) NOT NULL,
  due_date    DATE NOT NULL,
  paid_date   DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  INDEX (branch_id, status),
  INDEX (branch_id, due_date)
);

B2.23 invoice_references

Invoices are generated on-demand (not stored), but this table tracks issued invoice numbers for accounting continuity.

sqlCREATE TABLE invoice_references (
  id               SERIAL PRIMARY KEY,
  invoice_number   VARCHAR(30) NOT NULL UNIQUE,  -- e.g. INV-2025-00042
  session_id       INT REFERENCES dining_sessions(id),
  order_id         INT REFERENCES orders(id),    -- null = session invoice
  branch_id        INT NOT NULL REFERENCES branches(id),
  total_amount     NUMERIC(12,2) NOT NULL,
  issued_at        TIMESTAMPTZ DEFAULT now(),
  issued_to        VARCHAR(150),                 -- customer name (parcel orders)
  INDEX (branch_id, issued_at),
  INDEX (session_id),
  INDEX (order_id)
);

B2.24 daily_branch_metrics (Analytics Snapshot)

Populated by snapshotMetrics job at 00:05 daily. All analytics endpoints except peak-hours read from this table — never from raw orders.

sqlCREATE TABLE daily_branch_metrics (
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

B2.25 daily_item_metrics (Analytics Snapshot)
sqlCREATE TABLE daily_item_metrics (
  id                SERIAL PRIMARY KEY,
  branch_id         INT NOT NULL REFERENCES branches(id),
  menu_item_id      INT NOT NULL REFERENCES menu_items(id),
  snapshot_date     DATE NOT NULL,
  quantity_sold     INT NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (branch_id, menu_item_id, snapshot_date),
  INDEX  (branch_id, snapshot_date)
);

B2.26 staff_daily_metrics (Analytics Snapshot)
sqlCREATE TABLE staff_daily_metrics (
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

B2.27 notifications
sqlCREATE TABLE notifications (
  id             BIGSERIAL PRIMARY KEY,
  restaurant_id  INT NOT NULL REFERENCES restaurants(id),
  branch_id      INT REFERENCES branches(id),
  staff_id       INT REFERENCES staff_users(id),
  type           VARCHAR(50) NOT NULL,
  -- type values: low_stock | waiter_called | sub_expiring | bill_overdue | staff_invited | meal_completed
  title          VARCHAR(150) NOT NULL,
  message        TEXT,
  reference_type VARCHAR(30),            -- e.g. "inventory_item", "waiter_request"
  reference_id   INT,
  is_read        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now(),
  INDEX (staff_id, is_read, created_at),
  INDEX (branch_id, created_at)
);

B2.28 refresh_tokens (Security)
SHA-256 hashed token storage with family tracking for reuse detection and logout-everywhere support.
sqlCREATE TABLE refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  staff_id    INT NOT NULL REFERENCES staff_users(id),
  family_id   UUID NOT NULL,         -- same family = same login session; reuse detected per family
  token_hash  VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  INDEX (staff_id, revoked_at),
  INDEX (family_id)
);

B2.29 login_history (Security)
sqlCREATE TABLE login_history (
  id               BIGSERIAL PRIMARY KEY,
  staff_id         INT REFERENCES staff_users(id),
  attempted_email  VARCHAR(150),  -- populated on failed login attempts
  ip_address       INET,
  user_agent       TEXT,
  login_at         TIMESTAMPTZ DEFAULT now(),
  logout_at        TIMESTAMPTZ,
  success          BOOLEAN NOT NULL DEFAULT true,
  INDEX (staff_id, login_at)
);

B2.30 customer_feedback
sqlCREATE TABLE customer_feedback (
  id          SERIAL PRIMARY KEY,
  session_id  INT NOT NULL REFERENCES dining_sessions(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  INDEX (session_id)
);

PART C — AUTH & MIDDLEWARE
C1. Two Auth Contexts
C1.1 Staff JWT (access token, 15 min)
typescriptinterface AccessTokenPayload {
  sub: number;           // staff_users.id
  restaurantId: number;
  branchId: number | null;
  role: StaffRole;
  jti: string;
}
Signed with JWT_ACCESS_SECRET. Verified on every staff request. is_active flag re-checked on every request (not just at login).
C1.2 Member JWT (customer token, 6 h)
typescript// Issued when customer scans QR and joins a session.
// Signed with JWT_MEMBER_SECRET — completely separate from staff auth.
// No privilege escalation possible between staff and customer tokens.
interface MemberTokenPayload {
  sub: number;        // session_members.id
  sessionId: number;
  tableId: number;
  branchId: number;
  restaurantId: number;
}
memberAuth middleware verifies Authorization: Bearer <memberToken> on all /customer/* routes and attaches req.member.

C2. Middleware Stack
typescript// Protected staff route pipeline:
authenticate()          // verify staff JWT, check is_active
→ resolveTenant()       // verify active subscription
→ authorize(role)       // role hierarchy check (staff=1, manager=2, admin=3)
→ assertBranchAccess()  // staff role scoped to own branch only
→ validate(schema)      // Zod parse body/query/params
→ handler

// Customer route pipeline:
memberAuth()            // verify member JWT, attach req.member
→ validate(schema)
→ handler

// Public routes (QR scan entry point):
validate(schema)
→ handler

C3. Authorization
typescriptconst ROLE_HIERARCHY = { staff: 1, manager: 2, admin: 3 };

export function authorize(minRole: RoleLevel) { ... }
// Requires req.user.role >= minRole in hierarchy

// Staff role: scoped to their assigned branch only
export function assertBranchAccess(req, res, next) { ... }

// Customer invoice access guard
// Ensures member can only access invoices from their own session
// Prevents sessionId param spoofing — member JWT contains sessionId claim
export function assertMemberSessionAccess(req, res, next) {
  const { sessionId } = req.member;
  if (parseInt(req.params.sessionId) !== sessionId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  next();
}

C4. Google OAuth + Staff Whitelist
No self-signup allowed. Admin must pre-create staff records (is_active = false). Google OAuth only sets oauth_id — the email must already be whitelisted.
typescriptpassport.use(new GoogleStrategy({ ... }, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails?.[0].value;
  const staff = await prisma.staffUser.findFirst({ where: { email, isActive: true, deletedAt: null } });
  if (!staff) return done(null, false, { message: 'Account not whitelisted' });
  if (!staff.oauthId) {
    await prisma.staffUser.update({ where: { id: staff.id }, data: { oauthProvider: 'google', oauthId: profile.id } });
  }
  done(null, staff);
}));

C5. GET /me/permissions — Frontend Permission Object
Returns a flat permission object for frontend route/button gating. Shape driven by StaffRole.

PART D — API REFERENCE
Base URL: /api/v1
Role notation: Staff+ = staff | manager | admin; Manager+ = manager | admin; Admin = admin only

D1. Authentication (Staff)
MethodPathAuthDescriptionGET/auth/googlePublicRedirect to Google OAuthGET/auth/google/callbackPublicOAuth callback — issues JWT access + refresh token pairPOST/auth/refreshRefresh token (cookie)Rotate access token; invalidates old refresh token (family tracking)POST/auth/logoutBearerInvalidate refresh tokenGET/auth/meBearerCurrent user profileGET/me/permissionsStaff+Flat permission object for frontend gating

D2. Restaurants
MethodPathRoleDescriptionPOST/restaurantsPublicOnboard new restaurant — creates trial subscription automaticallyGET/restaurants/:idAdminGet restaurant detailsPATCH/restaurants/:idAdminUpdate name, billing emailDELETE/restaurants/:idAdminSoft-delete

D3. Subscriptions
MethodPathRoleDescriptionGET/restaurants/:id/subscriptionAdminCurrent active subscriptionPOST/restaurants/:id/subscription/upgradeAdminUpgrade planPOST/restaurants/:id/subscription/cancelAdminCancel subscriptionGET/restaurants/:id/subscriptionsAdminFull billing history

D4. Branches
MethodPathRoleDescriptionGET/branchesStaff+List branches (scoped by role — staff sees own, admin sees all)POST/branchesAdminCreate branch — enforces max_branches with row-level lockGET/branches/:idStaff+Branch detailPATCH/branches/:idManager+Update branch infoDELETE/branches/:idAdminSoft-deletePATCH/branches/:id/toggleAdminActivate / deactivate branch

D5. Sections
MethodPathRoleDescriptionGET/branches/:branchId/sectionsStaff+List sections for a branchPOST/branches/:branchId/sectionsManager+Create sectionPATCH/branches/:branchId/sections/:idManager+Rename sectionDELETE/branches/:branchId/sections/:idManager+Soft-delete

D6. Dining Tables
Status lifecycle: available → occupied → cleaning → available

occupied: set automatically by QR scan atomic transaction (not by staff)
cleaning: set when session is completed
available: explicit staff action

MethodPathRoleDescriptionGET/branches/:branchId/tablesStaff+List tables — filterable by section, statusPOST/branches/:branchId/tablesManager+Create table — auto-generates qr_tokenPATCH/branches/:branchId/tables/:idManager+Update table_no / labelDELETE/branches/:branchId/tables/:idManager+Soft-deletePOST/tables/:id/cleaningStaff+Mark table cleaning (after session close)POST/tables/:id/availableStaff+Mark table available (cleaning done)GET/tables/:id/qrManager+Return QR SVG/PNG for current qr_tokenPOST/tables/:id/regenerate-qrManager+Issue new qr_token — invalidates all existing QR codes for this table

D7. Menu (Staff-managed)
MethodPathRoleDescriptionGET/branches/:branchId/menu/categoriesStaff+Full category list with sort orderPOST/branches/:branchId/menu/categoriesManager+Create categoryPATCH/branches/:branchId/menu/categories/:idManager+Update name, sort_order, visibilityDELETE/branches/:branchId/menu/categories/:idManager+Soft-deletePATCH/branches/:branchId/menu/categories/reorderManager+Bulk sort_order updatePOST/menu/categories/:categoryId/itemsManager+Create menu itemGET/menu/items/:idStaff+Item detail + all variantsPATCH/menu/items/:idManager+Update item — writes audit log with old/new valuesPATCH/menu/items/:id/availabilityStaff+Toggle is_available + set disable_noteDELETE/menu/items/:idManager+Soft-deletePOST/menu/items/:itemId/variantsManager+Create variant (option group + option)PATCH/menu/items/:itemId/variants/:idManager+Update variantDELETE/menu/items/:itemId/variants/:idManager+Soft-delete

D8. Sessions (Staff-managed)

Sessions are never manually created by staff. Creation is automatic via customer QR flow (§E).

MethodPathRoleDescriptionGET/branches/:branchId/sessions/activeStaff+All active sessions for branchGET/sessions/:idStaff+Session detail + members + all ordersPOST/sessions/:id/closeStaff+Close session → table goes to cleaning

D9. Orders (Staff-managed)
MethodPathRoleDescriptionGET/branches/:branchId/ordersStaff+List orders — filter by status, type, date, ?updatedAfter=GET/orders/:idStaff+Order detail + itemsPATCH/orders/:id/statusStaff+Advance order statusPATCH/orders/:id/cancelStaff+Cancel order — logs reason to activity_logsPATCH/orders/:orderId/items/:id/statusStaff+Update single item statusPATCH/orders/:orderId/items/:id/cancelStaff+Cancel single item
Parcel Orders (Staff-placed)
MethodPathRoleDescriptionPOST/orders/parcelStaff+Create parcel order — requires customer_name, customer_phone; no session, no memberGET/branches/:branchId/orders?orderType=parcelStaff+Filter parcel-only orders

D10. Payments (Staff-managed)
MethodPathRoleDescriptionGET/sessions/:sessionId/paymentsStaff+All payments for a sessionGET/orders/:orderId/paymentsStaff+Payments for a specific orderPOST/payments/esewa/verifyPubliceSewa webhook callback — verifies and updates payment rowPOST/payments/:id/refundManager+Refund — creates new row (append-only), no update to existing

D11. Invoices (Staff-managed)
MethodPathRoleDescriptionGET/sessions/:sessionId/invoiceStaff+Full session invoice — all orders + paymentsGET/orders/:orderId/invoiceStaff+Single order invoiceGET/sessions/:sessionId/invoice/pdfStaff+Download session invoice as PDF (streamed, application/pdf)GET/orders/:orderId/invoice/pdfStaff+Download order invoice as PDF

D12. Kitchen Display System (KDS)
All KDS endpoints support ?updatedAfter=<ISO> for polling.
MethodPathRoleDescriptionGET/branches/:branchId/kitchen/ordersStaff+Active orders grouped by statusGET/branches/:branchId/kitchen/queueStaff+Pending + preparing items onlyPATCH/order-items/:id/preparingStaff+Mark item preparingPATCH/order-items/:id/readyStaff+Mark item readyPATCH/order-items/:id/deliveredStaff+Mark item delivered

D13. Waiter Requests (Staff-managed)
MethodPathRoleDescriptionGET/branches/:branchId/waiter-requestsStaff+Pending requests — supports ?updatedAfter=PATCH/waiter-requests/:id/acknowledgeStaff+Acknowledge requestPATCH/waiter-requests/:id/resolveStaff+Resolve + set resolved_at

D14. Staff Management
MethodPathRoleDescriptionGET/staffAdminList staff — restaurant-scopedPOST/staff/inviteAdminPre-create record with is_active = false (whitelist pending)PATCH/staff/:id/whitelistAdminSet is_active = true — allows Google OAuth loginPATCH/staff/:id/suspendAdminSuspend staff memberPATCH/staff/:id/roleAdminUpdate role + branch assignmentDELETE/staff/:idAdminSoft-deleteGET/staff/:id/logsAdminStaff activity timeline from activity_logs

D15. Inventory
MethodPathRoleDescriptionGET/branches/:branchId/inventory/categoriesStaff+List inventory categoriesPOST/branches/:branchId/inventory/categoriesManager+Create categoryPATCH/branches/:branchId/inventory/categories/:idManager+Rename / reorderDELETE/branches/:branchId/inventory/categories/:idManager+Soft-deleteGET/branches/:branchId/inventoryStaff+List items — includes low_stock boolean flagGET/branches/:branchId/inventory/low-stockStaff+Items below threshold onlyPOST/branches/:branchId/inventoryManager+Create itemPATCH/branches/:branchId/inventory/:idManager+Update metadataPOST/branches/:branchId/inventory/:id/adjustStaff+Log stock adjustment (+/-) — writes inventory_logs rowGET/branches/:branchId/inventory/:id/logsManager+Item adjustment historyDELETE/branches/:branchId/inventory/:idManager+Soft-delete

D16. Bills
MethodPathRoleDescriptionGET/branches/:branchId/billsManager+List bills — filterable by statusPOST/branches/:branchId/billsManager+Create billPATCH/branches/:branchId/bills/:idManager+Update amount, due_date, notePATCH/branches/:branchId/bills/:id/payManager+Mark paid + set paid_dateDELETE/branches/:branchId/bills/:idAdminSoft-delete

D17. Dashboard
Reads exclusively from snapshot tables — zero real-time aggregation on raw orders.
MethodPathRoleDescriptionGET/dashboardStaff+Staff view: active orders, sessions, table status counts, pending waiter calls, today's revenue, today's order count, low stock countGET/dashboard/branch/:branchIdManager+Branch metrics from daily_branch_metricsGET/dashboard/adminAdminRestaurant-wide: cross-branch revenue, top branch, subscription status
GET /dashboard response shape:
json{
  "activeOrders": 12,
  "activeSessions": 8,
  "tables": { "available": 10, "occupied": 8, "cleaning": 2 },
  "pendingWaiterCalls": 3,
  "revenueToday": 14500.00,
  "ordersToday": 47,
  "lowStockItems": 2
}

D18. Analytics

All endpoints accept ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?period=today|week|month|year.
All endpoints read from snapshot tables except /peak-hours which queries raw orders grouped by EXTRACT(HOUR FROM created_at) using (branch_id, created_at) index.

MethodPathRoleDescriptionGET/branches/:branchId/analytics/revenueManager+Revenue by period: total, cash, online, dine-in, parcelGET/branches/:branchId/analytics/ordersManager+Order counts: total, cancelled, dine-in, parcelGET/branches/:branchId/analytics/paymentsManager+Payment breakdown: cash vs eSewa, completed vs failedGET/branches/:branchId/analytics/peak-hoursManager+Hourly order distribution (last 30 days) — queries raw ordersGET/branches/:branchId/analytics/top-dishesManager+Top N items by quantity + revenueGET/branches/:branchId/analytics/worst-dishesManager+Bottom N items by quantityGET/branches/:branchId/analytics/dish-salesManager+Per-item: quantity_sold, revenue_generated by periodGET/branches/:branchId/analytics/table-utilizationManager+Sessions per table, avg occupancy %, busiest tablesGET/branches/:branchId/analytics/session-durationManager+Avg session duration by periodGET/branches/:branchId/analytics/customer-trendsManager+Customer count by period, avg party sizeGET/branches/:branchId/analytics/staff-performanceManager+Staff leaderboard from staff_daily_metricsGET/restaurants/:id/analytics/branch-comparisonAdminSide-by-side revenue/orders across all branches

D19. Notifications
Delivery model: Phase 1 = HTTP polling. All staff clients call GET /notifications?updatedAfter=<ISO> every 10 seconds. The updatedAfter filter returns only new/updated rows, keeping payload small. WebSocket/SSE is a future upgrade path — the table schema and endpoint contract are compatible with it.
MethodPathRoleDescriptionGET/notificationsStaff+Notifications for current userPATCH/notifications/:id/readStaff+Mark one notification readPATCH/notifications/read-allStaff+Mark all notifications read

D20. Customer Feedback (Staff read)
MethodPathRoleDescriptionGET/branches/:branchId/feedbackManager+List all feedback with avg rating

D21. Utility
MethodPathRoleDescriptionGET/healthPublic{ status, db, uptime }

PART E — CUSTOMER MODULE (/api/v1/customer)
All routes use member JWT via memberAuth() middleware, except the QR entry point which is public. Branch is always resolved from req.member.branchId — no branch param needed in customer routes.

E1. QR Entry Point (Public — single entry for all customer interactions)
POST /customer/qr/scan
Body: { qr_token: string }

Atomic transaction logic:
1. Resolve table by qr_token → verify exists + not deleted
2. Find active session for table OR create new:
   - No active session → CREATE dining_session + SET table.status = 'occupied' + CREATE session_member
   - Active session exists → JOIN it (add new session_member row)
3. Issue member JWT { sub: memberId, sessionId, tableId, branchId, restaurantId }
4. Return: { memberToken, session, menu_url }
MethodPathAuthDescriptionPOST/customer/qr/scanPublicScan QR → auto-create/join session, receive member token

E2. Customer Session
MethodPathAuthDescriptionGET/customer/sessionMember JWTCurrent session state: status, members, table infoPOST/customer/session/leaveMember JWTLeave session — removes session_member rowPOST/customer/session/completeMember JWTCustomer clicks "Complete Meal"
Last-member-leaves rule (Issue 1): When POST /customer/session/leave removes the final session_member row (member count reaches 0), apply this decision tree inside the same transaction:
count(non-cancelled orders for session) == 0
  → session.status = 'abandoned', table.status = 'available'   // no trace of activity; clean up immediately
count(non-cancelled orders for session) > 0
  → session stays 'active', table stays 'occupied'             // orders exist; staff must close manually
  → create notification for branch staff: type='abandoned_session_with_orders'
This prevents ghost sessions with orphaned orders while also preventing data loss if customers leave mid-meal.
POST /customer/session/complete flow:

Begin transaction; acquire row lock: SELECT * FROM dining_sessions WHERE id = ? AND status = 'active' FOR UPDATE — if row not found (already completed by concurrent request), return 409
Verify all orders for session are in terminal state (delivered / cancelled)
Verify no pending payments
Set session.status = completed, completed_at = NOW()
Set table.status = cleaning
Notify staff via notifications table


E3. Customer Menu
MethodPathAuthDescriptionGET/customer/menuMember JWTFull menu for branch: categories + available items + variantsGET/customer/menu/categoriesMember JWTCategories onlyGET/customer/menu/items/:idMember JWTItem detail + all variants

E4. Customer Orders
Flow: Order Created → Items Served → Customer Pays (pay after fulfillment, not pre-payment)
MethodPathAuthDescriptionPOST/customer/ordersMember JWTPlace new order — items are price-snapshotted atomicallyGET/customer/ordersMember JWTAll orders in current sessionGET/customer/orders/:idMember JWTSingle order detail + per-item statusesPOST/customer/orders/:id/itemsMember JWTAdd items to an existing pending orderPOST/customer/orders/:id/cancelMember JWTCancel order if still in pending status
All GET endpoints accept ?updatedAfter=<ISO> for incremental polling.

E5. Customer Payments
MethodPathAuthDescriptionGET/customer/session/invoiceMember JWTFull session invoice — pre-payment reviewPOST/customer/paymentsMember JWTInitiate payment for sessionGET/customer/paymentsMember JWTPayment status for current sessionPOST/customer/payments/esewa/initiateMember JWTGet eSewa payment form parameters
POST /customer/payments body:
json{
  "method": "cash" | "esewa",
  "sessionId": 123,       // validated against req.member.sessionId
  "orderIds": [1, 2, 3]   // specific orders, or empty array for full session
}

E6. Customer Invoices
Access control: assertMemberSessionAccess() verifies sessionId in route matches req.member.sessionId. Param spoofing is impossible — claim is in the JWT.
MethodPathAuthDescriptionGET/customer/invoiceMember JWTCurrent session invoice — read-only, member-scopedGET/customer/invoice/pdfMember JWTDownload invoice PDFGET/customer/orders/:id/invoiceMember JWTSingle order invoice

E7. Customer Waiter Requests
MethodPathAuthDescriptionPOST/customer/waiter-requestsMember JWTSubmit request: call_waiter | request_water | request_tissueGET/customer/waiter-requestsMember JWTStatus of all requests from this session

E8. Customer Feedback
MethodPathAuthDescriptionPOST/customer/feedbackMember JWTSubmit rating (1–5) + optional comment

E9. Customer Polling Summary
All customer GET endpoints support ?updatedAfter=<ISO> for incremental polling (avoids re-fetching unchanged data).
EndpointPoll intervalWhat changesGET /customer/orders?updatedAfter=5sItem status changes: preparing / ready / deliveredGET /customer/session?updatedAfter=10sSession status, member countGET /customer/waiter-requests?updatedAfter=10sRequest acknowledgement / resolutionGET /customer/payments?updatedAfter=5seSewa payment confirmation

PART F — BUSINESS LOGIC & FLOWS
F1. Complete Session Lifecycle
Customer scans QR code on table
         ↓
POST /customer/qr/scan  { qr_token }
         ↓
Server (atomic transaction):
  1. Lookup table by qr_token
  2. Active session exists for table?
     YES → add member to existing session
     NO  → CREATE dining_session
             SET table.status = 'occupied'
             CREATE first session_member
  3. Issue member JWT (6h)
         ↓
Customer receives: memberToken + sessionId + menu_url
         ↓
Customer browses menu → POST /customer/orders
         ↓
Staff KDS receives order → prepares items → updates item statuses
         ↓
Customer polls order status (5s intervals)
         ↓
All items delivered → Customer reviews invoice
         ↓
Customer pays → POST /customer/payments
         ↓
Payment confirmed → Customer clicks "Complete Meal"
         ↓
POST /customer/session/complete
  → session.status = completed, completed_at = NOW()
  → table.status = cleaning
  → staff notified via notifications
         ↓
Staff completes cleaning → POST /tables/:id/available
  → table.status = available

F2. Payment Flow (Order → Fulfillment → Payment)
1. Customer places order       (POST /customer/orders)
2. Kitchen prepares + serves   (KDS status updates: pending→preparing→ready→delivered)
3. Customer reviews invoice    (GET /customer/session/invoice)
4a. Cash payment:
    POST /customer/payments { method: "cash" }
    → staff confirms cash received (optional confirmation step)
4b. eSewa payment:
    POST /customer/payments/esewa/initiate
    → customer completes eSewa UI flow
    → POST /payments/esewa/verify (webhook from eSewa)
    → payment row updated to status = completed
5. Payment confirmed → session completable

"Pay → Order" clarification: In requirements this referred to the customer journey sequence (they think about paying last), not pre-authorization. The order is always created before payment.


F3. Order Service — Core Implementation
typescriptexport class OrderService {
  async placeOrder(dto: PlaceOrderDto, member: MemberTokenPayload): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      // 1. Validate session is active and belongs to this member
      const session = await tx.diningSession.findUnique({
        where: { id: member.sessionId, status: 'active' }
      });
      if (!session) throw new AppError('Session not active', 400);

      // 2. Validate + snapshot menu items (only available, not deleted)
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

      // 4. Create items with price + name snapshots (immutable order history)
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

      // 5. Write audit log (fire-and-forget acceptable; use EventEmitter)
      await auditLog(tx, {
        staffId: null,
        branchId: member.branchId,
        actionType: 'order_placed',
        targetType: 'order',
        targetId: order.id
      });

      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    });
  }

  async createParcelOrder(dto: ParcelOrderDto, staffUser: StaffUser): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      // Parcel orders: no session, no member — staff-placed
      const order = await tx.order.create({
        data: {
          sessionId: null,           // no dining session
          branchId: staffUser.branchId!,
          memberId: null,            // no customer member
          orderType: 'parcel',
          isParcel: true,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          status: 'pending',
          note: dto.note,
        }
      });
      // snapshot items same as placeOrder above
      return order;
    });
  }
}

F4. Order Status Aggregation Rule (Issue 9)
Order status is derived from item statuses — it is not an independent field staff set directly. Whenever any order_item.status changes, the parent order.status must be recalculated using this rule (run inside the same transaction as the item update):
items = all non-deleted order_items for this order

IF any item.status == 'preparing'              → order.status = 'preparing'
ELSE IF all items.status == 'ready'            → order.status = 'ready'
ELSE IF all items in {'delivered','cancelled'}
     AND at least one item.status == 'delivered' → order.status = 'delivered'
ELSE IF all items.status == 'cancelled'        → order.status = 'cancelled'
ELSE IF any item.status == 'ready'
     AND none == 'preparing'                   → order.status = 'ready'
ELSE                                           → order.status = 'preparing'  // mixed in-progress
confirmed status is set manually by staff via PATCH /orders/:id/status (pending→confirmed) and is the only manual transition. All subsequent transitions are derived. PATCH /orders/:id/status for stages beyond confirmed is blocked — use KDS item endpoints instead.
Staff accepted_by_staff_id is populated on the pending→confirmed transition.

F5. Invoice Number Generation (Issue 10)
Invoice numbers are generated transactionally inside the same transaction that inserts the invoice_references row. Format: INV-{YYYY}-{branchId}-{NNNNN} where NNNNN is a zero-padded 5-digit per-branch sequence.
typescript// Inside the invoice creation transaction:
const lastInvoice = await tx.$queryRaw<{ invoice_number: string }[]>`
  SELECT invoice_number FROM invoice_references
  WHERE branch_id = ${branchId}
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE
`;
const lastSeq   = lastInvoice[0]
  ? parseInt(lastInvoice[0].invoice_number.split('-')[3]) : 0;
const nextSeq   = String(lastSeq + 1).padStart(5, '0');
const invoiceNo = `INV-${new Date().getFullYear()}-${branchId}-${nextSeq}`;
// then INSERT invoice_references with invoiceNo
FOR UPDATE on the last row serializes concurrent invoice creation per branch. If no prior row exists, the lock is on the branch itself (obtained via the session/order row already locked upstream).

F6. Invoice Module
Invoices are generated on-demand (not stored). The invoice_references table only tracks invoice numbers for accounting.
Invoice response shape:
json{
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
PDF generation: pdfkit or puppeteer. Streamed as Content-Type: application/pdf.

PART G — BACKGROUND JOBS
typescript// 00:05 daily — populate all three snapshot tables atomically per branch
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

PART H — CROSS-CUTTING CONCERNS
H1. Standard Response Envelope
json// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 142 } }

// Error
{ "success": false, "error": "Validation failed", "code": "VALIDATION_ERROR",
  "details": [{ "field": "email", "message": "Invalid email format" }] }
H2. Error Handling
typescriptexport class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public code = 'INTERNAL_ERROR'
  ) { super(message); }
}

export function globalErrorHandler(err, req, res, next) {
  if (err instanceof AppError)
    return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002')
      return res.status(409).json({ success: false, error: 'Already exists', code: 'CONFLICT' });
    if (err.code === 'P2025')
      return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  }

  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

H3. Security Checklist

 Staff JWT (15 min) + member JWT (6 h) on separate secrets — no cross-contamination possible
 Member JWT contains sessionId — invoice access guard compares param vs token claim (param spoofing blocked)
 Refresh token family tracking — reuse detection, logout-everywhere support
 Staff whitelist model — no self-signup; admin must pre-approve via POST /staff/invite
 is_active re-checked on every staff request (not just at login)
 All routes tenant-scoped — no cross-restaurant data leakage
 Branch access guard for staff role — cannot access other branches
 Subscription enforcement on branch creation (row-level lock prevents race conditions)
 Session creation is atomic — no duplicate sessions per table
 Table status transitions enforced via dedicated endpoints (not generic PATCH)
 Price snapshots on order_items — menu edits never affect order history
 Payments append-only — refund = new row, no updates to existing rows
 Invoice numbers tracked in invoice_references for accounting trail
 Zod validation on all inputs
 Per-tenant rate limiting
 Helmet.js security headers
 Audit log on all destructive + financial operations
 Partial unique index on dining_sessions(table_id) WHERE status='active' — DB-level one-active-session-per-table guarantee
 Overpayment guard in payment service — sum(completed payments) + requested ≤ invoice total, checked inside transaction
 Session complete uses FOR UPDATE — prevents concurrent double-completion
 QR tokens are crypto.randomBytes(32).toString('hex') — 64-char hex, 256-bit entropy


H4. Key Architectural Decisions
DecisionRationaleSession auto-created on QR scanCustomer-driven flow; staff never need to "open" a table manuallyMember JWT on separate secretCustomer tokens revocable independently; no staff privilege escalation possibleassertMemberSessionAccess() guardPrevents member token from accessing another session's invoice via param manipulationTable lifecycle via dedicated endpointsPOST /tables/:id/cleaning and /available enforce valid transitions; generic PATCH was too permissiveParcel orders: null sessionId, null memberIdParcel orders are staff-placed; they bypass the customer flow entirelyPayment after fulfillmentMatches real restaurant workflow; pre-payment not applicable for dine-inAnalytics read from snapshot tablesAll analytics except peak-hours are O(1) date-range scans on pre-aggregated rowsInvoice generated on-demand, number trackedAvoids storing redundant data; invoice_references gives accounting trail without duplicating order dataCustomer module isolated under /customer/*Clean separation; different auth middleware, different guards, independently deployableorders.branch_id denormalizedAvoids 5-join analytics queries; set immutably at creationdining_sessions.branch_id denormalizedFast branch-scoped session queries without joining through tables → sections3-role hierarchy (staff / manager / admin)Added manager role over original DBML 2-role design; enables middle-tier permissionsInventory is manual-onlyNo automatic stock deduction on order placement. No recipe/ingredient mapping table. Staff adjusts stock manually via POST /inventory/:id/adjust. This is a deliberate scope decision — auto-deduction requires a recipes table which is out of scope for v1.

PART I — SCHEMA CONFLICT REGISTER
All places where DBML and API Prisma spec diverge. API Prisma is authoritative in all cases.
#TableFieldDBML (original)API (authoritative)Impact1staffrole enumadmin|staffstaff|manager|adminAdd manager role; update RBAC2staffbranch_idmissingnullable FK → branchesAdd column3dining_sessionsbranch_idmissingInt NOT NULLAdd denormalized column4dining_sessionsstatus cancelled valuecancelledabandonedRename enum value5menu_categoriesscoperestaurant_idbranch_idChange FK reference6inventory_itemsscoperestaurant_idbranch_idChange FK reference7orderssession_idNOT NULL requirednullable (parcel orders)Make nullable8orderscustomer_idNOT NULL FK → customersreplaced by nullable member_id FK → session_membersRename + relax9ordersbranch_idmissingInt NOT NULLAdd denormalized column10ordersorder_type, customer_name, customer_phonemissingadded for parcelAdd columns11ordersstatus enum4 values6 values (+ confirmed, ready, delivered)Expand enum12order_itemsvariant_id, item_name_snapshot, variant_name_snapshot, statusmissingaddedAdd columns13paymentsstatus paid valuepaidcompletedRename enum value14waiter_requeststype enum valueswaiter|water|tissuecall_waiter|request_water|request_tissueRename values15waiter_requestsstatus enumpending|resolvedpending|acknowledged|resolvedAdd acknowledged16customers tablewhole tableexists as customersrenamed to session_membersRename table17floors tablewhole tableexists as floorsrenamed to sectionsRename table + change parent FK from restaurant to branch18All PKstypeuuidInt autoincrementChange PK type throughout19Missing tables—not in DBMLbranches, subscriptions, bills, invoice_references, daily_branch_metrics, daily_item_metrics, staff_daily_metrics, notifications, refresh_tokens, login_history, customer_feedback, inventory_categories, session_membersAdd all20ordersaccepted_by_staff_idmissingnullable Int FK → staff_users; set on pending→confirmed transitionAdd column; required for staff_daily_metrics

End of PROJECT_MEMORY_V1.md