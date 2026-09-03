# SECURITY_AUDIT.md

## Executive Summary

This was a dedicated security/auth/authorization/permissions hardening pass
over the VEXO / زراعي برو project (React + Firebase Auth + Firestore). It
follows a prior stage (documented in `CRITICAL_FIXES_REPORT.md` and
`CREDENTIAL_ROTATION_REQUIRED.md`, both present in the upload) that removed
an exposed Firebase Admin SDK service-account key and fixed optimistic-write
rollback.

**`PRODUCTION_AUDIT.md` and `CRITICAL_FIXES_PLAN.md`, which the task
instructions ask to be read first, were not present in either uploaded
archive.** This audit was performed directly against the current codebase in
their absence; see `SECURITY_HARDENING_PLAN.md` for how the audit was
scoped without them.

**Overall assessment:** the authorization model is sound. Data isolation is
enforced structurally (per-user Firestore subcollection paths, re-checked
server-side via `request.auth.uid` in every rule) rather than by trusting
client-supplied identifiers, and every admin-only operation is independently
gated by Firestore Rules, not just hidden in the UI. No exposed credentials,
no cross-user data leaks, and no client-side-only security boundaries were
found. One real (low-severity) issue was found and fixed: login/password-
reset error messages let an attacker enumerate which emails have an account.
Everything else is either already secure by design or an out-of-scope,
non-boundary-affecting item that's documented rather than changed.

This app is **not** claimed to be "fully secure" — see Remaining Risks.

## Authentication

- `AuthContext.jsx`: `onAuthStateChanged` correctly drives a `loading` flag;
  `ProtectedRoute` shows a loading screen and never renders protected
  content or fires a Firestore query until `loading` is false, then
  redirects unauthenticated users to `/auth`. No window exists where
  protected data could be requested before auth state is known.
- Login, registration, logout, and password reset all go through the
  Firebase Auth SDK directly (`signInWithEmailAndPassword`,
  `createUserWithEmailAndPassword`, `signOut`, `sendPasswordResetEmail`) —
  no custom credential handling.
- **Fixed this pass:** login and password-reset flows previously returned
  different messages depending on whether an email was registered
  (`auth/user-not-found` vs `auth/wrong-password`, and reset silently
  succeeding only for real emails). This allowed email enumeration. Now
  both login failure cases show one generic message, and password-reset
  always shows the same success toast regardless of whether the email is
  registered. See `src/pages/AuthPage.jsx`.
- Deleted/disabled Firebase Auth users: not specially handled in app code,
  but this is standard Firebase Auth SDK behavior (the SDK itself rejects
  sign-in for disabled accounts with `auth/user-disabled`, which now falls
  through to the generic "حدث خطأ" message) — no app-level gap found.
- Session persistence is explicit (`indexedDBLocalPersistence`), which is
  intentional and appropriate for this app's offline-first design; not a
  vulnerability.

## Authorization

- Two independent layers, correctly separated:
  - **UI-only gating:** `AdminRoute.jsx` and `Sidebar.jsx` check
    `ADMIN_UIDS.includes(user.uid)` purely to hide/redirect the admin UI.
  - **Real enforcement:** `isAdmin()` in `firestore.rules`, checked
    server-side on every admin-only `get`/`list`/`create`/`update`/`delete`.
- Confirmed no code path trusts the client-side `ADMIN_UIDS` check as if it
  were authorization for an actual data operation — every admin data call
  (`userProfileService.getAll/getCount`, `backupService.getAllMeta`,
  `adminMessageService.*`, `errorLogService.getAll/setResolved/remove`)
  is a plain Firestore SDK call that Firestore Rules would reject
  independently for a non-admin, even if the UI gate were somehow bypassed.

## Firestore Rules

Reviewed `firestore.rules` line by line:

- `users/{uid}`: `get` = owner or admin; `list` = admin only; `create`/
  `update` = owner only; `delete` = always denied. Subtree
  `{document=**}`: `read, write` = owner only. This correctly means an
  authenticated user can never read or write anything under another user's
  `uid`, and cannot enumerate the `users` collection unless they're admin.
- `backups/{userId}`: metadata `read` = owner or admin (intentional — lets
  the admin dashboard show "last backup" per company without a
  collection-group query); `write` = owner only. `snapshots/{snapshotId}`
  (the actual backup content): `read, write` = owner only, admin has no
  access. Matches the in-code comments' stated intent and confirmed no UI
  code path attempts to read another user's snapshot content.
- `errorLogs/{id}`: `create` requires `request.resource.data.userId ==
  request.auth.uid`, so a user cannot log an error under someone else's
  identity. `read`/`update`/`delete` = admin only.
- `adminMessages/{id}`: `read` is evaluated per-document server-side
  (broadcast-to-all vs targeted-to-one-uid), not trusting a client query
  filter. `create`/`update`/`delete` = admin only.
- No rule was found that trusts a client-provided UID field over
  `request.auth.uid`.
- No `collectionGroup` queries exist anywhere in the app, so there's no
  risk of the per-path ownership rules being sidestepped by a cross-user
  group query.

## User Data Isolation

Verified structurally rather than by field: every operational collection
(`equipment`, `jobs`, `drivers`, `maintenance`, `payments`, `salaryEntries`,
`attendance`, `custodyTransactions`, settings) lives under
`users/{uid}/...`, and every service (`src/services/*.js`) builds its
Firestore path from a `uid` parameter that is always sourced from
`useAuth().user.uid` — the Firebase-SDK-verified current user, never from
route params, form input, or any other client-editable source. Even if a
service were somehow called with a forged uid, `isOwner(uid)` in the rules
independently re-derives the boundary from `request.auth.uid`, which the
client cannot spoof (it's set by Firebase Auth on the server side of the
SDK, not passed by the client).

## Admin Access

- The single hardcoded admin model (per `PRODUCTION_AUDIT.md`'s original
  finding, referenced in `CRITICAL_FIXES_REPORT.md`) was preserved as
  instructed — no multi-role system was introduced.
- Confirmed the admin UID is identical in `src/config/constants.js`
  (`ADMIN_UIDS`) and `firestore.rules` (`isAdmin()`) today. This
  duplication does **not** create a security risk: the client list only
  ever controls UI visibility (`AdminRoute`, `Sidebar`), while the rules
  copy is the actual enforcement point re-checked by Firestore on every
  request. If the two values ever drifted, the worst case is a UX
  mismatch (an admin not seeing the admin UI, or a removed admin still
  seeing — but not being able to use — admin nav links), never a data
  exposure, since the rules value is what's actually authoritative.
- Confirmed every admin-only client action funnels through a Firestore
  call that Rules independently gate — see Authorization/Firestore Rules
  sections above.

## Input Validation

- Firestore write rules do not perform field-level or type validation on
  the `users/{uid}/{document=**}` subtree — an authenticated user could in
  principle write arbitrarily-shaped data into their own subcollections by
  calling the SDK directly instead of going through the app's UI (which
  does apply its own checks, e.g. `MAX_MONEY_VALUE`). This is scoped to
  the writer's own account only — there is no `userId`/ownership/role
  field on these documents that could be spoofed to affect another user
  or escalate privilege, because isolation is enforced by the document
  path itself, not by a field. Left unchanged per the task's explicit
  scope limit (§6: validate only fields that affect authorization or
  security; this subtree has none).
- `errorLogs` create correctly validates the one field that matters for
  authorization (`userId == request.auth.uid`); no other field is
  security-relevant there.
- `adminMessages` writes are admin-only, so client-side spoofing of e.g.
  `targetUserId` is not a cross-privilege concern (the writer is already
  trusted).

## Client Storage

Grepped all of `src/` for `localStorage`/`sessionStorage`/`IndexedDB`/
`AsyncStorage`. Every hit is a non-sensitive UI-state value, namespaced per
`uid`:

- Last-write throttle timestamps (`AuthContext.jsx`'s `lastActiveAt`
  throttle, `useAutoBackup.js`, `DataContext.jsx`'s backup throttling).
- Dismissed-notification/admin-message ID sets (`useNotifications.js`,
  `useAdminMessages.js`).
- Last-export timestamp (`ProfileModal.jsx`).

No credentials, tokens, private keys, or privileged/sensitive business data
are stored client-side. (Firestore's own offline persistence layer,
`persistentLocalCache` in `src/config/firebase.js`, is the SDK's standard
IndexedDB-backed cache — not custom code, not touched, not a credential
store.)

## Firebase Configuration

- `src/config/firebase.js` contains the standard public Firebase Web SDK
  config (`apiKey`, `authDomain`, `projectId`, etc.) — this is not a
  secret; Firebase Web API keys are designed to be shipped to the browser
  and are not sufficient on their own to access data (Firestore Rules are
  the actual boundary). No change made or needed.
- `scripts/.env.local` (present in the uploaded `scripts.zip`) contains
  the same public config values, but pasted in as raw JS code rather than
  `KEY=VALUE` env syntax — it is not valid CRA env format and has no
  runtime effect. Flagged as a stray/dead file (INFO only, not a security
  issue, since the values inside are the same non-secret public config)
  for the project owner to clean up if unintended; not modified in this
  pass as it carries no security risk either way.

## Admin SDK / Credentials

- No `serviceAccountKey.json` or any other credential file exists in
  either uploaded archive — consistent with the prior stage's fix
  (`CRITICAL_FIXES_REPORT.md`, `CREDENTIAL_ROTATION_REQUIRED.md`).
- Both Admin-SDK-using scripts (`scripts/backfillUserProfiles.js`,
  `scripts/migrate-to-subcollections.js`) take the service-account key
  path as a required CLI argument and exit with a usage message if it's
  missing — no hardcoded path, no way to run them without explicitly
  supplying a key from outside the project. Re-verified this fix from the
  prior stage is intact and undisturbed.
- No Admin SDK import or usage exists anywhere under `src/` (browser
  code) — confirmed via the service audit above; Admin SDK usage is
  fully confined to the two `scripts/*.js` files.
- **Reminder, not new information:** the previously-exposed key itself
  still requires manual rotation in Google Cloud Console — this cannot be
  done from a code pass. See `CREDENTIAL_ROTATION_REQUIRED.md` for exact
  steps. Nothing in this report reproduces any secret value.

## Security Fixes Implemented

| Finding | Severity | Status | Evidence | Fix |
|---|---|---|---|---|
| Auth error messages leak whether an email is registered (user enumeration) | LOW | Fixed | `src/pages/AuthPage.jsx` previously mapped `auth/user-not-found` and `auth/wrong-password` to distinct messages, and showed reset-password success only for registered emails | Merged both login-failure codes (plus `auth/invalid-credential`, which newer Firebase Auth configs return instead) into one generic message; password-reset now shows the same success toast regardless of whether the email exists, by silently swallowing `auth/user-not-found` |

All other findings (see `SECURITY_HARDENING_PLAN.md`) were either confirmed
already secure by design, or are INFO-level items explicitly out of this
pass's scope (no authorization/security field involved) and were documented
rather than changed, per the instruction to make the smallest safe diff and
avoid unrelated changes.

## Tests Performed

- No Firestore Rules test suite exists in the project today (no
  `firebase-tools` rules-unit-testing setup found). Not creating one in
  this pass per the instruction to avoid building "a huge new testing
  framework just for this stage." A manual verification checklist is
  provided below instead.
- `npm run build` / any automated test could **not** be run in this
  environment: `node_modules` is not present in the uploaded archive and
  this sandbox has no network egress to run `npm install` (same
  limitation documented in the prior stage's `CRITICAL_FIXES_REPORT.md`).
  Not claiming a build or test suite was run.
- What was actually run: a JSX-aware syntax parse of the one changed file
  (`src/pages/AuthPage.jsx`) via the TypeScript compiler's
  `transpileModule` (`allowJs`, `jsx: React`) — **0 syntax errors**. This
  validates syntactic correctness only (balanced JSX/braces/parens, valid
  ES syntax), not a full CRA build (which also runs ESLint and resolves
  the real dependency graph).
- Manual line-by-line review of the changed logic in `AuthPage.jsx`:
  confirmed the `login`/`register` success paths are unchanged, confirmed
  the new `try/catch` around `resetPassword` re-throws any error other
  than `auth/user-not-found` (so real failures like `auth/invalid-email`
  or `auth/too-many-requests` still surface correctly to the user), and
  confirmed `authErrorMsgs` now maps three codes to one string with no
  typos.
- Manual review of every other file inspected during the audit (see
  "Method" in `SECURITY_HARDENING_PLAN.md`) — no code changes were made
  to any of them, so no further syntax/behavior verification was needed
  beyond the read-through itself.

### Manual Firestore Rules verification checklist

Since no automated rules-testing harness exists, verify these manually
against the real project (e.g. via the Firebase Emulator Suite or the
Rules Playground in Firebase Console) before considering this pass fully
verified in production:

1. Unauthenticated request to `users/{any-uid}` → **denied**.
2. User A reads/writes `users/{A's uid}/equipment/...` → **allowed**.
3. User A reads `users/{B's uid}/equipment/...` → **denied**.
4. User A writes to `users/{B's uid}/equipment/...` → **denied**.
5. User A deletes a doc under `users/{B's uid}/...` → **denied**.
6. Non-admin user calls `list` on the top-level `users` collection (i.e.
   the admin dashboard's user list) → **denied**.
7. Admin UID performs the same `list` on `users` → **allowed**; and
   `read` on `backups/{any-uid}` (metadata only) → **allowed**.
8. Non-admin user creates a doc in `adminMessages` → **denied**.
9. User A creates an `errorLogs` doc with `userId` set to B's uid instead
   of their own → **denied**.

## Remaining Risks

- **C-1 (from the prior stage, still open):** the previously-exposed
  service-account key has not been rotated — only removed from the
  working tree. It remains a live credential until manually revoked in
  Google Cloud Console. See `CREDENTIAL_ROTATION_REQUIRED.md`.
- **F2 (this pass, INFO):** `users/{uid}/{document=**}` writes have no
  server-side field/type/size validation. Impact is limited to the
  writer's own data (no cross-user or privilege-escalation path exists),
  so this was documented rather than fixed, per scope. Worth a future,
  dedicated pass if data-integrity (not security-boundary) guarantees are
  wanted at the rules level.
- **No automated Firestore Rules tests exist.** The manual checklist above
  is a substitute for this pass; recommend setting up
  `@firebase/rules-unit-testing` as a dedicated follow-up if ongoing rules
  regressions are a concern.
- **`npm run build` was not run** in this environment (see Tests
  Performed) — the one code change in this pass was validated by syntax
  parse and manual review only, not a real CRA build/lint pass. Recommend
  running `npm run build` in an environment with dependencies installed
  before deploying.
- **`PRODUCTION_AUDIT.md` and `CRITICAL_FIXES_PLAN.md` were unavailable**
  for cross-referencing during this pass (see Executive Summary). If they
  exist outside this upload, worth a quick diff against this report's
  findings to make sure nothing they flagged was missed here.
- This application is not being claimed as "fully secure" — this pass
  covers auth/authorization/permissions/credential-handling specifically,
  not a full penetration test, dependency vulnerability scan, or business-
  logic review.

---

## Files changed in this pass

- `src/pages/AuthPage.jsx` — merged login-failure error messages, made
  password-reset response uniform regardless of whether the email exists.
- `SECURITY_HARDENING_PLAN.md` — new (pre-modification findings).
- `SECURITY_AUDIT.md` — new (this file).

No other files were touched. No packages were installed. No Firestore
Rules, schema, SaaS/multi-tenancy, roles, billing, or business features
were added or changed, per the scope lock.
