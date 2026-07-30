# Independent Admin Console Preview

This repository owns the source for a new administration console. It is served
alongside the legacy compiled console so operators can migrate safely instead
of replacing a working control plane in one deployment.

## Access

The preview is available at the configured secure admin path followed by
/console. It uses the existing admin login endpoint and the same Sanctum
administrator authorization as the legacy console. No user account, database
table, secret, or public route is created. Tokens are stored in browser session
storage and are cleared when the browser session ends.

## Current coverage

- Dashboard with revenue, registration, traffic, online-user, queue and
  scheduler health signals from existing admin APIs.
- Read-only paginated browsing for user, order, ticket, coupon and audit-log
  APIs, plus the remaining modules through their existing endpoints.
- Local table search, responsive navigation, explicit loading and failure
  states.
- Confirmed write operations for user ban, subscription credential reset,
  pending-order payment or cancel, node display toggle, and node traffic reset.

Write actions call existing backend endpoints only. The backend remains the
authority for validation, permissions, order state changes and audit logging.

## Migration policy

Keep the legacy admin page as the default until the preview has been tested
against a production-like copy of your own data and remaining write forms have
been implemented. Legacy static assets remain in public/assets/admin. The new
readable source is in public/assets/console.
