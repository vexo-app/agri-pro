# 🌾 زراعي برو (Agri-Pro) — Agricultural Equipment & Operations SaaS

A production React + Firebase SaaS for agricultural contracting companies to manage
equipment, work orders (jobs), drivers, driver payroll, attendance, maintenance,
client payments, and a cash-custody ledger — with automatic backups, offline
support (PWA), and an admin back-office. Interface is fully Arabic (RTL).

This document is written so that anyone — a new engineer, an auditor, or an
acquiring/reviewing company — can understand **what the system does, how it is
built, where the data lives, and how every important flow behaves end-to-end**,
without having to read the whole codebase first.

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Project Structure](#4-project-structure)
5. [Data Model (Firestore)](#5-data-model-firestore)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Core Application Flows](#7-core-application-flows)
   - 7.1 [App Boot & Data Loading](#71-app-boot--data-loading)
   - 7.2 [Create / Update / Delete (Optimistic Writes)](#72-create--update--delete-optimistic-writes)
   - 7.3 [Offline Support & Sync Status](#73-offline-support--sync-status)
   - 7.4 [Jobs → Payments → Client Debt](#74-jobs--payments--client-debt)
   - 7.5 [Driver Payroll: Attendance + Salary Entries](#75-driver-payroll-attendance--salary-entries)
   - 7.6 [Legacy Driver-Costs Migration](#76-legacy-driver-costs-migration)
   - 7.7 [Custody (Cash-in-Hand) Ledger](#77-custody-cash-in-hand-ledger)
   - 7.8 [Maintenance Scheduling](#78-maintenance-scheduling)
   - 7.9 [Notifications Center](#79-notifications-center)
   - 7.10 [Automatic Daily Backup](#710-automatic-daily-backup)
   - 7.11 [Manual Backup, Restore & JSON Import/Export](#711-manual-backup-restore--jsonimportexport)
   - 7.12 [Reports & Dashboard](#712-reports--dashboard)
   - 7.13 [Admin Back-Office](#713-admin-back-office)
   - 7.14 [PWA / Offline Installability](#714-pwa--offline-installability)
8. [Security Model](#8-security-model)
9. [Known Dead Code / Housekeeping Notes](#9-known-dead-code--housekeeping-notes)
10. [Setup & Local Development](#10-setup--local-development)
11. [Scripts](#11-scripts)
12. [Deployment](#12-deployment)

---

## 1. What This App Does

The app is used by a farm-machinery contracting business to run its daily
operations:

- Track **equipment** (tractors, trailers, harvesters, attachments) and their
  service history.
- Log **jobs** (a piece of work done for a client with a specific machine and
  driver) and the **revenue/fuel-cost/profit** for each one.
- Track **client payments** against jobs, and see who still owes money.
- Track **drivers**, their **attendance**, and pay them through a full
  **salary ledger** (base pay, bonuses, deductions, advances, advance
  repayments).
- Track **maintenance** history and get reminded when a machine's next
  service is due.
- Track a **cash custody ledger** (an owner hands over cash periodically;
  expenses are logged against it; the app tracks the running balance).
- See a **dashboard** and **reports** (per-equipment and per-driver
  profitability).
- Get **in-app notifications** for overdue debts, due maintenance, an
  overdrawn custody balance, and admin broadcasts.
- Have data **backed up automatically every 24h**, plus **manual backup /
  restore** and a **local JSON export/import** as an extra safety net.
- Work reasonably well **offline** (Firestore's local cache + PWA install).
- Give a small **admin back-office** (visible only to specific UIDs) to see
  all companies' accounts, error logs, backup status, and send broadcast
  messages.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18, React Router 6, Tailwind CSS |
| Forms | react-hook-form |
| Charts | Recharts |
| Backend | Firebase (Auth + Firestore), no custom server |
| Offline | Firestore IndexedDB persistence + a Workbox-based service worker (PWA) |
| Excel export | SheetJS (`xlsx`) |
| Toasts | react-hot-toast |
| Build tooling | Create React App (`react-scripts`) |
| Admin scripts | Node.js scripts using `firebase-admin` (run outside the browser bundle) |

There is **no custom backend server** — the browser talks directly to
Firebase Auth and Firestore. All business rules that must be trusted (e.g.
"a user can only read their own data") are enforced by **Firestore Security
Rules** (`firestore.rules`), not by client-side code.

## 3. High-Level Architecture

The codebase follows a strict layering discipline:

```
services/   → Pure Firestore CRUD functions. No React, no state, no UI.
   ↓
contexts/   → React state that wraps the services (DataContext, AuthContext,
              PrivacyContext). This is the single source of truth for
              "what data does the signed-in user currently have".
   ↓
hooks/      → Business logic / derived data. Consume a context, compute
              something useful (totals, filters, alerts), and return a
              clean API to components. Hooks never talk to Firestore
              directly — they only ever go through DataContext / AuthContext.
   ↓
features/   → Domain-specific, reusable UI pieces (a form, a card, a modal)
              for one entity (jobs, drivers, salary, custody, ...).
   ↓
pages/      → Route-level screens that compose features + hooks into a full
              page.
```

Two contexts sit above everything:

- **`AuthContext`** — who is signed in (Firebase Auth user object), plus
  login/register/logout/reset-password.
- **`DataContext`** — once a user is signed in, this is the *only* place
  that loads and mutates the user's operational data (equipment, jobs,
  drivers, maintenance, payments, salary entries, attendance, custody,
  settings). It exposes the current state **and** every mutation function
  (`addJob`, `updateDriver`, `deleteMaintenance`, …) through a single
  `useData()` hook. This is also where the automatic daily backup and the
  legacy-data migration described in section 7 live — both need to run for
  as long as the app is open, independent of which page is mounted.

`PrivacyContext` is a small, separate concern: a "blur sensitive numbers"
toggle used across the UI (e.g. on a shared screen) — it holds no data of
its own and always resets to hidden on reload.

## 4. Project Structure

```
src/
├── config/
│   ├── firebase.js         # Firebase app init + offline persistence
│   └── constants.js        # All enums/labels used across the app (equipment
│                            # types, salary entry types, custody types, admin
│                            # UID allowlist, backup interval, etc.)
│
├── services/                # One file per Firestore subcollection. Pure
│                             # CRUD, no React. Every add/update/remove
│                             # returns { id, promise } (see §7.2) instead of
│                             # awaiting the server round-trip itself.
│   ├── equipmentService.js
│   ├── jobService.js
│   ├── driverService.js
│   ├── maintenanceService.js
│   ├── paymentService.js
│   ├── salaryService.js
│   ├── attendanceService.js
│   ├── custodyService.js
│   ├── settingsService.js
│   ├── driverCostService.js     # legacy-only, see §7.6 / §9
│   ├── backupService.js         # create/list/restore snapshots (§7.10-11)
│   ├── exportService.js         # local JSON file export/import (§7.11)
│   ├── backupToExcelService.js  # admin: snapshot → multi-sheet Excel
│   ├── userProfileService.js    # tiny per-user profile doc (for admin list)
│   ├── errorLogService.js       # global error logging (admin-only reads)
│   └── adminMessageService.js   # admin broadcast/targeted messages
│
├── contexts/
│   ├── AuthContext.jsx      # Firebase Auth state + auth actions
│   ├── DataContext.jsx      # ALL operational data + mutations (see §7)
│   └── PrivacyContext.jsx   # "hide sensitive numbers" UI toggle
│
├── hooks/                   # Business logic — consumes contexts, returns
│   │                        # a clean API to pages/features
│   ├── useEquipment.js, useEquipmentDetail.js
│   ├── useJobs.js
│   ├── useDrivers.js
│   ├── useDriverCosts.js    # ⚠️ orphaned/unreachable — see §9
│   ├── useMaintenance.js
│   ├── usePayments.js
│   ├── useSalary.js
│   ├── useCustody.js
│   ├── useClients.js
│   ├── useDashboard.js
│   ├── useNotifications.js  # derives all alerts, see §7.9
│   ├── usePWA.js             # online/offline + install-prompt state
│   ├── useConfirm.js         # promise-based confirm dialog
│   ├── useAdminUsers.js, useAdminBackups.js, useAdminErrors.js,
│   │   useAdminMessages.js, useAdminBroadcast.js   # admin back-office
│   └── useAutoBackup.js     # ⚠️ superseded/unused — see §9
│
├── features/                 # Domain UI grouped by entity
│   ├── equipment/, jobs/, drivers/, maintenance/, payments/, salary/,
│   │   attendance/, custody/, clients/, reports/, notifications/, admin/
│   ├── profile/               # ProfileModal, RestoreModal, ImportModal
│   ├── search/                # GlobalSearch
│   └── driverCosts/            # ⚠️ orphaned — see §9
│
├── pages/                     # One per route — see §6 for the full route table
│
├── components/
│   ├── ui/                    # Stateless design-system primitives (Button,
│   │                          # Input, Modal, Card, ConfirmDialog, Icons, …)
│   ├── layout/                # AppLayout, Sidebar, TopBar, BottomNav,
│   │                          # ProtectedRoute, AdminRoute
│   └── system/ErrorBoundary.jsx
│
├── utils/                     # Pure functions, fully unit-tested where it
│   │                          # matters:
│   ├── calculations.js        # job/driver/equipment financial aggregation
│   ├── salaryCalculations.js  # salary/attendance math
│   ├── findDuplicateSalaryEntries.js  # read-only duplicate detector (§7.6)
│   ├── migrateDriverCosts.js  # legacy → salaryEntries mapping (§7.6)
│   ├── formatters.js          # currency/date/number formatting
│   ├── paymentUtils.js, serviceHistory.js, pdfGenerator.js
│   └── globalErrorLogger.js   # wires window.onerror/unhandledrejection → errorLogService
│
├── App.jsx                    # Router + providers + toast host
├── index.js / serviceWorkerRegistration.js / service-worker.js  # PWA (§7.14)
└── index.css
```

## 5. Data Model (Firestore)

All operational data for a company lives under a single per-user document
path — there is **no shared top-level collection with a `userId` field**;
isolation is structural, not conditional:

```
users/{uid}                          → tiny profile doc (email, displayName,
│                                       createdAt, lastActiveAt) — for admin's
│                                       company list only
├── equipment/{id}
├── jobs/{id}
├── drivers/{id}
├── maintenance/{id}
├── payments/{id}
├── salaryEntries/{id}
├── attendance/{id}
├── custodyTransactions/{id}
├── driverCosts/{id}                 → legacy collection, read/cleaned up
│                                       only by the one-time migration (§7.6)
└── meta/settings                    → { fuelPrice, ... }

backups/{uid}                        → { lastBackupAt, lastBackupId }  (metadata only)
└── snapshots/{snapshotId}           → { data: <JSON string>, counts, createdAt }

errorLogs/{id}                       → { userId, message, stack, page, createdAt, resolved }
adminMessages/{id}                   → { title, body, severity, targetUserId|null, createdAt }
```

Why this shape:
- **`users/{uid}/...`** means every read/write is naturally scoped to one
  company by the *path* itself. The Firestore rule for it is a single
  wildcard rule (`users/{uid}/{document=**}`) instead of a repeated
  `resource.data.userId == request.auth.uid` condition per collection.
- **`backups/{uid}`** sits at the top level (not nested under `users/{uid}`)
  specifically so the admin dashboard can read every company's *backup
  metadata* (last backup date) in one pass, without a Firestore
  collection-group query. The actual backup *content* (`snapshots/*`) stays
  locked to the owner.
- **`errorLogs`** and **`adminMessages`** are top-level by necessity — they
  are cross-user by design (an admin reading all errors, or a broadcast
  reaching every company).

## 6. Authentication & Authorization

- **Auth**: Firebase Auth, email/password only (`AuthContext.jsx`). On
  sign-in/sign-up, a small profile doc is written/touched
  (`userProfileService`) so the admin can see a list of accounts and their
  last-active time (throttled to once per 6h per device, to avoid needless
  writes).
- **Routing guard**: `ProtectedRoute` redirects to `/auth` if there's no
  signed-in user, and only mounts `DataProvider` (i.e. only starts loading
  company data) once a user exists.
- **Admin gate**: `AdminRoute` + `ADMIN_UIDS` in `constants.js` control
  whether the `/admin/*` UI is shown. **This is a UX convenience only** —
  the actual authorization boundary is the `isAdmin()` function duplicated
  in `firestore.rules` (same hard-coded UID list). Hiding a button does not
  protect data; the security rules do.

### Route map (`App.jsx`)

| Path | Page | Guard |
|---|---|---|
| `/auth` | AuthPage (login/register) | none |
| `/` | DashboardPage | signed-in |
| `/equipment`, `/equipment/:id` | EquipmentPage / EquipmentDetailPage | signed-in |
| `/jobs` | JobsPage | signed-in |
| `/drivers`, `/drivers/:id` | DriversPage / DriverDetailPage | signed-in |
| `/maintenance` | MaintenancePage | signed-in |
| `/custody` | CustodyPage | signed-in |
| `/reports` | ReportsPage | signed-in |
| `/clients`, `/clients/:name` | ClientsPage / ClientDetailPage | signed-in |
| `/notifications` | NotificationsPage | signed-in |
| `/admin`, `/admin/errors`, `/admin/messages`, `/admin/backup-to-excel` | Admin pages | signed-in **and** admin UID |
| `*` | redirect to `/` | — |

## 7. Core Application Flows

This is the part most worth reading carefully — it describes *behavior*,
not just file locations.

### 7.1 App Boot & Data Loading

1. `AuthContext` resolves the current Firebase user (or `null`).
2. If signed in, `ProtectedRoute` mounts `DataProvider`, which immediately
   fires off **one parallel `Promise.all`** of all ten collection reads
   (equipment, jobs, drivers, maintenance, settings, payments, driverCosts,
   salaryEntries, attendance, custody).
3. Every read is wrapped in `safeFetch`, which **never throws** — it
   resolves to `{ ok: true, data }` or `{ ok: false, err }`. This means one
   failed collection (e.g. the device just came back online and the local
   cache hasn't settled yet) does **not** take down the whole dashboard.
4. Only collections that succeeded (`ok: true`) are written into state.
   **A failed collection is left untouched** — it is *not* overwritten with
   an empty array. This is a deliberate design choice: a transient read
   failure must never look like "your data got deleted" to the user.
5. If anything failed, `loadError` is set and an `OfflineBanner` appears;
   the app auto-retries the instant the browser reports `online` again (no
   manual refresh needed).
6. Once the collections load, a **one-time legacy migration** runs if
   needed — see §7.6.

### 7.2 Create / Update / Delete (Optimistic Writes)

Every mutation in `DataContext.jsx` (there are ~24 of them, one add/update/
delete per entity) follows the exact same pattern:

1. Call the service, which returns `{ id, promise }` — the local write to
   Firestore's client-side cache and the reducer dispatch (updating the UI)
   happen **immediately**, without waiting for the server.
2. The real network write's `promise` is handed to `trackWrite(promise,
   { rollback, errorMessage })`.
3. If the write is **genuinely rejected** by the server (permission denied,
   validation failure — not just "offline"), `trackWrite` automatically
   reverses the optimistic UI change via `rollback` and shows an error
   toast. While offline, the promise simply stays pending (Firestore queues
   it) — it does not reject just because there's no connection, so nothing
   is rolled back for that.

This is why the UI never "hangs" waiting for the network on save/edit/
delete, both online and offline, while still being safe against a write
that is truly refused by the server.

One extra guard worth noting: **deleting a job is blocked** if any payment
still references it (`hasPayments` check in `deleteJob`), to avoid leaving
a payment pointing at a job that no longer exists.

### 7.3 Offline Support & Sync Status

`DataContext` tracks `pendingWrites` (how many writes are still unconfirmed
by the server) via `waitForPendingWrites(db)`, plus `lastSyncedAt` and
`firstPendingWriteAt`. This powers the `OfflineBanner` component, which can
distinguish:
- "just went offline a second ago" (normal, ignorable), from
- "been unsynced for hours" (worth nudging the user to reconnect or take a
  manual backup).

Firestore's own IndexedDB persistence (`config/firebase.js`) is what makes
the app usable offline at all — reads come from the local cache, writes are
queued locally and flushed once connectivity returns.

### 7.4 Jobs → Payments → Client Debt

- A **job** records one unit of work: client, equipment, driver, work type,
  date, revenue, and fuel usage. `utils/calculations.js` derives
  profit = revenue − fuel cost (using the configurable `fuelPrice` in
  settings) for a single job and aggregates it per equipment/driver/client.
- A **payment** is linked to a job (`jobId`) and represents money actually
  collected from the client.
- "Debt" is not a stored field — it's computed: a job's outstanding balance
  = its revenue minus the sum of its payments. `checkOverdueDebts` (used by
  the notifications hook) flags jobs whose balance is still outstanding
  after a configurable number of days.
- The **Clients** pages group jobs/payments by client name and show a
  paid/partial/unpaid badge per client.

### 7.5 Driver Payroll: Attendance + Salary Entries

The current payroll system (this replaced an older, simpler one — see
§7.6) has two independent pieces:

- **Attendance** (`attendanceService` / `attendance` state): one record per
  driver per day — present / absent / late / half-day.
- **Salary entries** (`salaryService` / `salaryEntries` state): a ledger of
  discrete monetary events per driver — `base`, `bonus`, `deduction`,
  `advance`, `advance_repay` — each with an amount, date, and optional
  reason (`config/constants.js` lists the standard bonus/deduction
  reasons). `salaryCalculations.js` sums these into a driver's running
  balance / monthly totals.

This gives an auditable, append-only history instead of a single "current
salary" number — every raise, bonus, advance, and repayment is its own
record.

### 7.6 Legacy Driver-Costs Migration

**Background**: an earlier version of the app tracked driver costs (salary,
fuel allowance, housing allowance, bonus, advance, deduction) in a separate
`driverCosts` collection, edited from a page (`DriverCostsPage`) that was
never actually linked into navigation. That system has been superseded by
the `salaryEntries` + `attendance` model in §7.5.

**The migration** (`utils/migrateDriverCosts.js`, invoked from
`DataContext.jsx`'s load effect) runs automatically, once, per account:

1. After the parallel load in §7.1, if both `driverCosts` and
   `salaryEntries` loaded successfully **and** there are leftover
   `driverCosts` docs, the migration begins.
2. For each legacy doc: map its Arabic `type` label to the new
   `SALARY_ENTRY_TYPES` schema, write a new `salaryEntries` doc stamped
   with `legacyDriverCostId: <original id>`, then delete the legacy doc.
3. A synchronous `migratingDriverCostsRef` guard prevents two overlapping
   loads (e.g. a retry firing mid-migration) from both migrating the same
   doc.
4. An **idempotency check** (`alreadyMigratedIds`, built from existing
   `legacyDriverCostId` values) means that if a previous run's *delete*
   step failed after the *create* step succeeded, the leftover legacy doc
   is simply deleted on the next run — not migrated again.
5. The whole thing is wrapped in try/catch and is **non-fatal**: if
   anything fails, the legacy docs are simply left in place and the
   migration retries on the next load. It never blocks the rest of the app
   from loading.

**Duplicate detection (safety net for pre-existing data)**:
`utils/findDuplicateSalaryEntries.js` is a read-only classifier (used by
`useNotifications.js`) that looks for `salaryEntries` that carry the
migration's note marker and flags:
- **`highConfidence`** — two+ entries share the exact same
  `legacyDriverCostId` (can only happen from the bug window described
  above, never from normal user action).
- **`needsReview`** — entries that match on driver/type/amount/date but
  don't share a `legacyDriverCostId` (typically because one predates that
  field). These are surfaced for a human to check, never auto-resolved.

Nothing in the app auto-deletes a "needs review" duplicate — the only
delete path for those is a person removing the record manually from the
driver's page after checking it.

There is also a standalone, admin-only, opt-in CLI script,
`scripts/reportDuplicateSalaryEntries.js`, that runs the same
classification across **all accounts** using `firebase-admin` (outside the
browser). It defaults to a dry-run report; only with an explicit `--clean`
flag does it delete anything, and even then only the `highConfidence` case.

### 7.7 Custody (Cash-in-Hand) Ledger

The business owner periodically hands the operating team a cash float
("العهدة"). `custodyTransactions` records two kinds of entries:
`deposit` (money handed over) and `expense` (money spent, optionally
categorized as equipment / driver / other for reporting). The running
balance = sum(deposits) − sum(expenses); `useNotifications.js` raises a
high-severity alert the moment that balance goes negative (no arbitrary
"low balance" threshold — only true overdraft).

### 7.8 Maintenance Scheduling

Maintenance records are logged per equipment (type, date, cost, notes).
`checkMaintenanceDue` (`utils/calculations.js`) compares each machine's
last service against `MAINTENANCE_INTERVALS` to compute days-until-due, and
feeds both the equipment detail page and the notifications system.

### 7.9 Notifications Center

`useNotifications.js` is a **pure derivation** — it does not read any extra
Firestore collection. It recomputes a merged, sorted alert list from data
already in `DataContext`, on every relevant change:

- Maintenance due/overdue
- Overdue client debts
- Custody overdrawn
- Possible duplicate salary entries (see §7.6)
- Admin broadcast/targeted messages (always shown first, sorted by date,
  kept visually separate from the severity-sorted list above)

Read/dismissed state is **per-device**, stored in `localStorage`
(`readNotifs:<uid>` / `hiddenNotifs:<uid>`) — these are derived alerts, not
Firestore documents, so there's nothing to sync across devices for them.

### 7.10 Automatic Daily Backup

Lives inside `DataContext.jsx` (not a separate hook) specifically so it
keeps running for as long as the tab is open, regardless of which page is
mounted, and so any component can read its status via `useData()`
(`backupFailCount`, `retryBackupNow`) the same way it reads `pendingWrites`.

Behavior:
1. Only runs once the current load finished **without** any collection
   failure (`!state.loading && !loadError`) — never backs up a
   known-incomplete/partial in-memory state.
2. Checks a local timestamp (`lastBackupAt:<uid>` in `localStorage`); skips
   if less than `BACKUP_INTERVAL_MS` (24h) has passed.
3. Also cross-checks the **server's** `lastBackupAt` (in case another
   device/tab already backed up recently) to avoid redundant writes.
4. On success, writes a full snapshot via `backupService.createBackup`
   (see the collection list in §5) and prunes old snapshots beyond
   `MAX_BACKUPS_KEPT` (7).
5. On failure, increments a **consecutive-failure counter**
   (`localStorage` + state). A single failed attempt stays quiet (it will
   retry); only after more than one failure in a row does the UI surface it
   — so a one-off blip doesn't alarm the user.
6. Re-checks hourly (`setInterval`) and immediately on `online` events, so
   a backup that was due while offline runs as soon as connectivity
   returns.

### 7.11 Manual Backup, Restore & JSON Import/Export

Three independent safety mechanisms exist, deliberately separate:

1. **Automatic Firestore snapshots** (§7.10) — inside the same Firebase
   project.
2. **Manual restore from a Firestore snapshot** (`RestoreModal.jsx`) — pick
   a past snapshot, review its record counts against current live counts,
   type a literal confirmation word (`"استرجاع"`), then
   `backupService.restoreSnapshot` runs.
3. **Local JSON export/import** (`exportService.js`, `ImportModal.jsx`) — a
   fully offline, dependency-free JSON file the user downloads to their own
   device. This is the one safety net that survives even total loss of the
   Firebase project itself (suspension, billing issue, accidental project
   deletion).

**Restore safety** (`backupService.restoreSnapshot`): before touching
Firestore at all, it validates that *every* required collection key in the
snapshot is actually an array. If any is missing or malformed, it throws
immediately and **aborts before any write happens** — this specifically
prevents a corrupt/partial snapshot from silently wiping a collection
(which would otherwise happen if a missing key fell through to `|| []`).
The restore itself deletes any live doc not present in the snapshot and
upserts every snapshot item back under its original id, batched in chunks
of 450 writes (Firestore's batch limit).

### 7.12 Reports & Dashboard

`useDashboard.js` aggregates KPIs and chart series (area/pie charts on
`DashboardPage`) from live state — no separate reporting backend or
pre-computed rollups; everything is derived client-side from the same data
the rest of the app uses, so reports are always consistent with what's
actually stored. `ReportsPage` offers per-equipment and per-driver
profitability tabs with margin/performance bars.

### 7.13 Admin Back-Office

Visible only to UIDs in `ADMIN_UIDS` (and enforced server-side by
`isAdmin()` in `firestore.rules`):

- **AdminPage** — list of all companies (from `userProfileService`),
  last-active time, last-backup time (`useAdminBackups`).
- **AdminErrorsPage** — global error log (`errorLogService`); any signed-in
  user can *write* an error (via `globalErrorLogger.js`, which hooks
  `window.onerror` / `unhandledrejection`), only the admin can *read/
  resolve/delete* them.
- **AdminMessagesPage** — send a broadcast (all companies) or a targeted
  (one company) message, shown inside every affected user's normal
  notifications list (§7.9).
- **AdminBackupToExcelPage** — pick any company's latest data and export it
  as a multi-sheet Excel workbook (`backupToExcelService.js`) with IDs
  resolved to human-readable names, for offline reference.

### 7.14 PWA / Offline Installability

`service-worker.js` (Workbox: precache + runtime caching strategies) is
registered once from `index.js` at app startup — not gated behind login.
`usePWA.js` exposes online/offline status and the `beforeinstallprompt`
event so the UI can offer an "Add to Home Screen" action.

## 8. Security Model

- **No client-trusted authorization** — every rule in `firestore.rules` is
  keyed off `request.auth.uid`, never off a value the client sends.
- **Structural isolation** — a company's operational data lives entirely
  under `users/{uid}/...`; the single wildcard rule
  `match /{document=**} { allow read, write: if isSignedIn() && isOwner(uid); }`
  covers it, so a newly added subcollection is automatically protected
  without a rules change.
- **Admin allowlist duplicated in two places on purpose**:
  `ADMIN_UIDS` in `constants.js` (UI-only — shows/hides admin nav) and the
  matching UID list inside `isAdmin()` in `firestore.rules` (the actual
  enforcement). Changing who is an admin requires updating **both** and
  redeploying rules — the constants-file list alone changes nothing about
  real access.
- **Error logs**: any signed-in user may `create` (write only, own `userId`
  stamped in the doc), only admin may `read/update/delete` — a normal user
  cannot see anyone else's error log entries, including their own past
  ones, by design (write-only channel).
- **Admin messages**: Firestore itself (not just the client's query filter)
  enforces that a user can only read a broadcast (`targetUserId == null`)
  or a message addressed to them specifically.
- **Backups**: snapshot *content* is owner-only; only the small metadata
  doc (`lastBackupAt`) is admin-readable across all companies, so the admin
  dashboard never has access to any company's actual data via that path.

## 9. Known Dead Code / Housekeeping Notes

These do not affect current behavior (nothing routes to them), but are
worth knowing about if you're exploring the codebase or deciding what to
clean up:

- **`src/pages/DriverCostsPage.jsx`, `src/hooks/useDriverCosts.js`,
  `src/features/driverCosts/DriverCostForm.jsx`** — this whole cluster
  predates the `salaryEntries`/`attendance` payroll system (§7.5) and was
  never wired into any route or nav link. `useDriverCosts.js` still expects
  `driverCosts`/`addDriverCost`/etc. from `useData()`, which `DataContext`
  no longer provides — so this cluster would throw immediately if it were
  ever rendered. Since nothing imports it except itself, it is inert.
  Safe to delete outright.
- **`src/hooks/useAutoBackup.js`** — an earlier, standalone implementation
  of the daily-backup idea. It has been superseded by the inline
  implementation inside `DataContext.jsx` (§7.10), which needs to live at
  the provider level to survive page navigation. This hook is not imported
  anywhere. Safe to delete once confirmed nobody has a reason to keep it as
  reference.
- **`src/services/driverCostService.js`** — kept intentionally, but only
  for `getAll`/`remove`, exclusively by the migration in §7.6. It is not
  used to create new records anywhere in the app.

## 10. Setup & Local Development

### 1. Clone & install

```bash
git clone <your-repo>
cd agri-pro
npm install
```

### 2. Firebase project setup

1. Create a project at the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication → Email/Password**.
3. Enable **Firestore Database**.
4. Project Settings → Your Apps → Add Web App → copy the config.

### 3. Environment variables

Copy `.env.local` (or create one) with your Firebase web config — see
`src/config/firebase.js` for the exact variable names it reads.

### 4. Set the admin UID (optional)

If you need admin access, add your Firebase Auth UID to **both**:
- `ADMIN_UIDS` in `src/config/constants.js`
- the UID list inside `isAdmin()` in `firestore.rules`

then redeploy rules (step 5).

### 5. Deploy Firestore rules & indexes

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore
```

### 6. Run

```bash
npm start
```

## 11. Scripts

| Command | What it does |
|---|---|
| `npm start` | Local dev server |
| `npm run build` | Production build (`build/`) |
| `npm test` | Runs the Jest unit tests (`react-scripts test`) — currently covers `calculations.js`, `salaryCalculations.js`, and `findDuplicateSalaryEntries.js` |
| `node scripts/reportDuplicateSalaryEntries.js <serviceAccountKey.json> [--clean]` | Admin-only, offline dry-run report (or scoped cleanup) of possible duplicate salary entries across **all** accounts — see §7.6 |
| `node scripts/migrate-to-subcollections.js` | One-off historical migration script (top-level collections → `users/{uid}/...` structure described in §5) |
| `node scripts/backfillUserProfiles.js` | One-off script to backfill `users/{uid}` profile docs for accounts created before `userProfileService` existed |
| `node scripts/seedDemoAccount.js` | Seeds a demo account with sample data for demos/testing |

## 12. Deployment

```bash
npm run build
firebase init hosting   # public dir = build, configure as a single-page app = yes
firebase deploy --only hosting
```

---

*This README describes the system as of the current codebase. If you add a
new Firestore subcollection, a new page, or a new automated flow (anything
that runs without a direct user click, like the migration or the auto-
backup), please extend the relevant section above rather than letting this
document drift out of date — it is meant to always be the fastest way for
someone new to understand how the whole system actually behaves.*
