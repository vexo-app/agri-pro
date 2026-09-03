# SECURITY_HARDENING_PLAN.md

## Note on prerequisite reading

The task instructions call for reading `PRODUCTION_AUDIT.md` and
`CRITICAL_FIXES_PLAN.md` before starting. Neither file was present in either
uploaded archive (`New_folder.zip`, `scripts.zip`) — only
`CRITICAL_FIXES_REPORT.md` and `CREDENTIAL_ROTATION_REQUIRED.md` were
available, and both were read in full before this plan was written. This
plan proceeds on the audit performed directly against the current codebase
rather than against the missing prior-stage documents; if those two files
exist elsewhere, worth cross-checking against them afterward.

## Method

Full read of: `firestore.rules`, `src/config/firebase.js`,
`src/config/constants.js`, `src/contexts/AuthContext.jsx`,
`src/contexts/DataContext.jsx`, `src/components/layout/ProtectedRoute.jsx`,
`src/components/layout/AdminRoute.jsx`, `src/App.jsx`, every file under
`src/services/`, `src/pages/AdminPage.jsx`, `src/pages/AdminMessagesPage.jsx`,
`src/pages/AdminErrorsPage.jsx`, `src/features/admin/BackupToExcelCard.jsx`,
`src/hooks/useAdminUsers.js`, `useAdminBackups.js`, `useAdminBroadcast.js`,
`src/pages/AuthPage.jsx`, `scripts/backfillUserProfiles.js`,
`scripts/migrate-to-subcollections.js`, `.gitignore`, `.env.local`,
`firebase.json`. Grepped the whole `src/` tree for `localStorage`/
`sessionStorage`, `dangerouslySetInnerHTML`, `collectionGroup`, and
`ADMIN_UIDS` usage. Confirmed no `serviceAccountKey.json` or other credential
file exists anywhere in either archive.

## Findings

| # | Finding | Severity | Affected | Attack scenario | Proposed fix |
|---|---------|----------|----------|------------------|--------------|
| F1 | Login/registration/reset-password error messages distinguish "email not registered" from "wrong password" (`auth/user-not-found` vs `auth/wrong-password`, and the same for `sendPasswordResetEmail`) | LOW | `src/pages/AuthPage.jsx` | An attacker can enumerate which emails have an account on this app by trying login or "forgot password" and reading which distinct error/success message comes back — a reconnaissance step, not direct data access. | Merge `user-not-found` and `wrong-password` into a single generic "email or password incorrect" message; on password-reset, always show the generic success toast even if `auth/user-not-found` is thrown, so the response is identical whether or not the email exists. |
| F2 | `/users/{uid}/{document=**}` write rule (`allow read, write: if isSignedIn() && isOwner(uid)`) has no field/type/size validation | INFO | `firestore.rules` | An authenticated owner could write arbitrarily-shaped or oversized data into their own subcollections (e.g. a huge string, unexpected types, negative amounts) by bypassing the app's client-side checks (e.g. `MAX_MONEY_VALUE`) and calling the Firestore SDK directly. This cannot cross into another user's data — the path itself is the isolation boundary — so the impact is limited to the writer's own account/data integrity, not other users' confidentiality or integrity. | Not fixing in this pass: the task scope (§6) explicitly limits validation work to fields "that affect authorization or security," and no such field exists here (there's no `userId`/role/ownership field on these documents to spoof — ownership is enforced structurally by path). Documenting as a known, low-impact, self-only limitation rather than changing rules, per "do not attempt to validate every business field in this stage." |
| F3 | Hardcoded admin UID duplicated in `src/config/constants.js` (`ADMIN_UIDS`) and `firestore.rules` (`isAdmin()`) | INFO | both files | If the two lists ever drift apart, an admin could lose UI access (rules still correctly deny/allow data either way) or a removed admin could still see admin nav links that then 403 against Firestore. In both drift directions the actual data boundary (Firestore Rules) stays correct — this is a UX/maintenance risk, not a security flaw, since the client list only ever gates UI visibility. | No code change. Confirmed both values currently match. Documenting per §4 instruction to assess whether the duplication is a security risk (it isn't, by design) rather than fixing it. |
| F4 | `scripts/.env.local` (root of the CRA project, uploaded in `scripts.zip`) contains raw `firebaseConfig` JS code pasted into a file with a `.env.local` name/extension, instead of `KEY=VALUE` env syntax | INFO | `scripts/.env.local` | None — this file is not valid CRA env syntax so React reads nothing meaningful from it; the real config lives correctly in `src/config/firebase.js`. The values inside (Firebase Web API key, project id, app id) are the normal public Web SDK config, not secrets — safe to have client-side regardless. | No fix applied (cosmetic/dead file, out of scope — no security boundary involved; flagging only so the owner can delete it if it's stray). |
| F5 | Admin-privileged Node scripts (`scripts/backfillUserProfiles.js`, `scripts/migrate-to-subcollections.js`) both already require the service-account key path as a CLI argument (no hardcoded path) and print clear guidance to keep the key out of the repo | INFO (confirmed secure) | `scripts/*.js` | N/A — re-verified the prior stage's fix (per `CRITICAL_FIXES_REPORT.md`) is intact in this bundle; no drift found. | No action. |
| F6 | No automated Firestore Rules tests exist in the project | INFO | project-wide | N/A | Per §11, since no rule-testing framework exists yet and setting one up is out of the smallest-safe-diff spirit of this pass, a manual verification checklist is provided in `SECURITY_AUDIT.md` instead of a new test harness. |

## Everything checked and found already correctly enforced (no finding)

- Firestore data isolation is structural (`users/{uid}/...` path-based),
  not field-based — confirmed no service passes a client-suppliable uid into
  a Firestore path; every service call is seeded from `useAuth().user.uid`
  (the SDK-verified current user), and `isOwner(uid)` in rules independently
  re-checks `request.auth.uid == uid` regardless of what the client sends.
- Admin authorization is enforced server-side (`isAdmin()` in
  `firestore.rules`, checked independently for every admin-only
  `get`/`list`/`create`/`update`/`delete`) — the client-side `ADMIN_UIDS`
  check (`AdminRoute.jsx`, `Sidebar.jsx`) only ever gates UI visibility, never
  the underlying data.
- No Firebase Admin SDK credentials, private keys, or other secrets are
  present anywhere in either uploaded archive.
- No Admin SDK usage outside the two one-off, CLI-key-path Node scripts.
- No `collectionGroup` queries exist, so there's no risk of the per-path
  ownership rule being bypassed via a cross-user group query.
- `localStorage` usage across the app is limited to non-sensitive UI-state
  timestamps and dismissed-notification-ID sets, namespaced per uid — no
  tokens, credentials, or privileged data stored client-side.
- No `dangerouslySetInnerHTML` anywhere in `src/` — React's default escaping
  applies to all rendered user-controlled text (backup file contents,
  imported data, error messages, etc.), so no stored/reflected XSS vector
  was found from user- or backup-supplied data.
- `errorLogs` create rule correctly ties the written `userId` field to
  `request.auth.uid`, preventing a user from logging errors under another
  user's identity; read/update/delete correctly admin-only.
- `adminMessages` read rule correctly evaluates the broadcast-vs-targeted
  condition per-document server-side rather than trusting a client query
  filter; write operations correctly admin-only.
- `backups/{userId}` rules correctly separate metadata (readable by
  owner+admin, for the admin dashboard's "last backup" column) from actual
  snapshot content (`snapshots/{snapshotId}`, owner-only) — matches the
  in-code comments' stated intent, and `BackupToExcelCard.jsx` confirms the
  admin tool only ever operates on a locally-uploaded file, never a
  cross-user Firestore read.
- Auth state is checked before any protected route renders or queries data
  (`ProtectedRoute` shows a loading screen until `loading` is false, then
  redirects to `/auth` if there's no user — no window where protected data
  could be requested pre-auth).

## Fixes to implement (this pass)

Only F1 (user enumeration via distinct auth error messages) is being fixed
— it's the only finding with an actual, confirmed information-disclosure
impact and a minimal, in-scope diff (message text only, in one file, no new
authentication features, no rules changes).
