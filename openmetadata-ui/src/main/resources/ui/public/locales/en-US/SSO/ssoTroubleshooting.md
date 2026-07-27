# SSO Troubleshooting & Recovery

Misconfiguring SSO can prevent users (including admins) from signing in. This page covers the two most common foot-guns and how to recover.

## OIDC Prompt

The `prompt` parameter controls whether the identity provider shows a login screen.

- **Recommended:** `select_account` — always shows the account picker, so a stale or expired provider session can never silently block sign-in.
- **Avoid `none` and empty.** `none` requests a *silent* sign-in that only succeeds when the user already has a live provider session; users without one are rejected (e.g. Azure `AADSTS50058`) with no login screen.
- **Supported values vary by provider:**

  | Provider | Accepted values |
  |----------|-----------------|
  | Azure / Entra | `login`, `consent`, `select_account`, `none` |
  | Google | `consent`, `select_account`, `none` (no `login`) |
  | Okta | `login`, `consent`, `select_account`, `none` |
  | AWS Cognito | `login`, `select_account`, `none` (no `consent`) |
  | Auth0 | `login`, `consent`, `select_account`, `none` |
  | Custom OIDC | `login`, `consent`, `select_account`, `none` |

  Configuration validation rejects a value the provider does not accept, and rejects `none`, with a message pointing to the recommended value.

## Principal Domain

`Principal Domain` is your organization's email domain (e.g. `yourcompany.com`) — not a URL, scheme, or email address. When **Enforce Principal Domain** is enabled, users whose email domain does not match are denied access, so an incorrect value locks everyone out. Validation checks the format when enforcement is on.

## Recovery

If a change breaks sign-in:

1. **Revert in the UI.** Your current session survives a configuration change, so if you are still signed in, open **Settings → SSO → Configure** and click **Restore Previous Configuration**. This restores the configuration that was live before your most recent change and reloads authentication.

2. **Recover from the server** (if no one can sign in). On the OpenMetadata server:

   ```bash
   # Inspect / back up the current config
   ./bootstrap/openmetadata-ops.sh get-security-config -o security-config.yaml

   # Restore a known-good config from a YAML file
   ./bootstrap/openmetadata-ops.sh update-security-config -f security-config.yaml

   # Or remove the DB security config entirely to fall back to conf/openmetadata.yaml
   ./bootstrap/openmetadata-ops.sh remove-security-config --force
   ```

   After `remove-security-config`, the server uses the authentication defined in `conf/openmetadata.yaml` (typically basic auth) on the next reload.

## Validate before you commit

Use **Test Configuration** (checks reachability, credentials, and field values) and, for OIDC public clients, **Test Login** (completes a real sign-in against the unsaved config in a separate window) before saving. Saving a *new* SSO configuration signs you out, so confirm sign-in works first.
