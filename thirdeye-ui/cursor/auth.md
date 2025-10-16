Cursor Task List — Authentication & User Management (OpenMetadata backend)

Context: Login isn’t working. We need Login, Signup, and Forgot/Reset Password to work against the OpenMetadata backend, plus a User Management UI. Use the existing omClient.ts + cookie storage (httpOnly) in this project. For API shapes, mirror what the official OpenMetadata UI calls (read their UI code for exact endpoints and payloads).

CP-AUTH-0 — Discovery & Audit

Branch: chore/auth-audit Goal: Understand current auth + what OM is configured for (Basic vs SSO). Identify why login fails. Do:

Read env & code: app/api/connection/route.ts, lib/cookies.ts, lib/omClient.ts, any /login page or hook.

Add a one-off diagnostic: call OM health/version + auth config endpoint (same ones used by OM UI) and log provider (Basic/JWT/OIDC/SAML).

Trace login submit → network call → cookie write → guarded route. Verify: cookie name, SameSite, Secure, Path=/.

Capture failing request in devtools and record request/response. AC: Issue is reproduced and root-caused in a small markdown checklist committed as docs/auth-audit.md with screenshots.

CP-AUTH-1 — Login (Email/Password → JWT cookie)

Branch: fix/auth-login Goal: Implement the same login request and token handling that OM UI uses. Do:

Create /login route with form (email/username + password). Use React Hook Form + Zod.

POST to the exact OM login endpoint the OM UI uses; on success, store JWT in httpOnly cookie via a Next.js route/action.

Update omClient.ts to attach Authorization: Bearer <jwt> from cookie on server. On 401/403, clear cookie and redirect to /login.

Add a tiny session banner (user email/name from token claims if exposed by OM UI helpers). AC: Valid creds land on / and API calls succeed; invalid creds show inline error without leaving the page; 401 auto-logout works.

CP-AUTH-2 — Signup (Create Account / Invite)

Branch: feat/auth-signup Goal: Implement user registration consistent with OM capabilities. Do:

Inspect OM UI to see if it supports self-signup or invite-based creation. If invite-only, build an Invite User flow in Settings (admin-only) and a Complete Signup page for invite links (token-based).

For self-signup (if enabled): create /signup form matching OM UI payload. Handle email verification if OM requires it (token link → /verify?token= page). AC:

If invite-based: Admin can invite, recipient can complete account creation.

If self-signup: New user can register and then login, following OM UI’s contract.

CP-AUTH-3 — Forgot / Reset Password

Branch: feat/auth-reset Goal: Implement “Forgot password” email trigger and token-based reset. Do:

Add /forgot page → submit email; call the same endpoint OM UI calls to issue a reset email/token.

Add /reset?token= page with new password + confirm; call reset endpoint.

Validate password strength (mirror OM UI rules) and show policy hints. AC: Email submission succeeds (stub success if SMTP off); reset page accepts valid token and updates password; errors shown for expired/invalid token.

CP-AUTH-4 — Session Middleware & Route Guards

Branch: feat/auth-guards Goal: Protect app routes and standardize redirects. Do:

Add middleware.ts to redirect unauthenticated users from app routes (/(app)/**, /settings/**) to /login.

Implement useSession() hook (client) and requireSession() helper (server) that read cookie and minimal user info.

Add a loading gate to prevent UI flicker. AC: Direct hits to protected routes bounce to /login; logged-in users stay in-app across refreshes.

CP-AUTH-5 — User Management (Read-only MVP)

Branch: feat/users-read Goal: Users & Teams lists with filters; profile drawer. Do:

Use OM UI endpoints used for users/teams index with pagination.

Columns: Name, Email/Handle, Teams, Role, Status; search box; page size.

Row click → side drawer with details (roles, tokens disabled/enabled, teams). AC: Pagination + search work; empty/error states standardized.

CP-AUTH-6 — User Management (Admin basics)

Branch: feat/users-admin Goal: Admin actions that OM allows via API. Do:

Implement actions available via OM UI (e.g., invite user, activate/deactivate, assign role/team). Hide actions if current user lacks perms.

Confirmation dialogs; optimistic updates with React Query invalidation. AC: Actions succeed against OM and reflect in UI; unauthorized actions are hidden/disabled.

CP-AUTH-7 — Security Hardening

Branch: chore/auth-security Goal: Tighten auth around cookies and inputs. Do:

Cookies: httpOnly, secure (prod), sameSite='lax', Path='/', short TTL + renewal.

Rate limit login and forgot-password endpoints (edge-friendly limiter).

Lockout/backoff after N failures; show generic error to avoid user enumeration.

CSRF: login/reset via same-site cookie; ensure POST only. AC: Automated tests cover happy path + brute/lockout; headers and cookie flags verified.

CP-AUTH-8 — Tests (Unit + E2E)

Branch: test/auth Goal: Regressions prevented. Do:

Vitest unit tests for validators, client, and guards.

Playwright flows: login success/fail, logout, forgot → reset, signup/invite.

Use MSW or recorded fixtures to emulate OM API responses. AC: CI passes; e2e runs headless in PR.

CP-AUTH-9 — Docs & Runbook

Branch: docs/auth Goal: How to configure and operate auth. Do:

docs/auth.md: envs, OM auth modes supported, SMTP setup for reset emails, known errors, and troubleshooting (JWT clock skew, cookie domain, reverse proxy headers). AC: New dev can bring up auth flows locally in <10 minutes.

Implementation Notes / OpenMetadata UI Reference

Reuse the exact request shapes OM UI uses for login, signup/invite, and password reset. Search the OM UI repo for:

login page/components

forgotPassword / resetPassword flows

users & teams list and service calls

If the deployment uses SSO (OIDC/SAML), gate self-signup and password reset, and show a “Sign in with SSO” button that redirects to the OM auth provider URL (same as OM UI).