# Settings defined in both the deployment configuration and the database

Fixes #31786, #32904, #30882 and collate#4484. Supersedes the closed #25652 and #32251.

Seven settings exist both in the server configuration (`openmetadata.yaml`, or `operations.yaml`
for email and the server URL, plus environment variables) and in `openmetadata_settings`:
- `authenticationConfiguration`;
- `authorizerConfiguration`;
- `emailConfiguration`;
- `openMetadataBaseUrlConfiguration`;
- `scimConfiguration`;
- `mcpConfiguration`;
- `appConfiguration`.

Until 2.1 these rows were seeded once and the server then read only the database. That caused
three problems:
- Helm/GitOps changes were silently ignored.
- Fields added to a schema after the row was seeded lost to the POJO default
  (`maxActiveSessionsPerUser` stayed 5 although the environment said 1000).
- A change saved on one server never reached the others.

This document describes how the server now decides which source wins, how it reports what it
ignored, and how changes travel between servers. Code: `openmetadata-service/.../config/source/`.

## Inputs

| Name | What it is | Where it comes from |
|---|---|---|
| **E** | The deployment value | The bound configuration POJO, captured at the start of `run()` before anything mutates it (`DeploymentConfig.capture`) |
| **E0** | Per-field defaults of the deployment | The configuration file before environment substitution (`RawConfigCapture` → `DeploymentTemplate`): `${VAR:-default}` gives the variable name and E0 = `default` |
| **D** | The stored value | The raw row JSON (`SystemDAO.getStoredSettingRow`); secrets are decrypted only for comparison |
| **L** | The deployment value applied last time | The `openmetadata_settings.deployment_snapshot` column (2.1.0 migration), with `meta`: mode, app version, applied JSON hash, warnings already logged, value before switching to ENV |

**Deliberate.** Helm charts and compose files set every variable explicitly, usually to the
default. So a field counts as deliberately configured only when E ≠ E0 after normalization, or
when the file holds a literal value. Without a captured file (configuration built in code), nothing
is deliberate and the merge still works.

**Normalization** (`SettingValues`):
- `null`, `""` and absent are equal; so are `[]`, `{}` and absent.
- Numbers compare by value.
- PEM newlines are normalized.
- JSON held in strings is compared parsed.

## Modes

```yaml
configSource:                  # optional; a missing block means these defaults
  security:  ${SECURITY_CONFIG_SOURCE:-AUTO}   # authentication + authorizer
  email:     ${EMAIL_CONFIG_SOURCE:-AUTO}
  serverUrl: ${SERVER_URL_CONFIG_SOURCE:-AUTO}
  scim:      ${SCIM_CONFIG_SOURCE:-AUTO}
  mcp:       ${MCP_CONFIG_SOURCE:-AUTO}
  app:       ${APP_CONFIG_SOURCE:-DB}
  confirmProviderChange: ${SECURITY_CONFIG_SOURCE_CONFIRM_PROVIDER_CHANGE:-false}
  watchIntervalSeconds: ${CONFIG_SOURCE_WATCH_INTERVAL_SECONDS:-10}
```

| Mode | At start | API writes |
|---|---|---|
| **AUTO** | Per-field three-way merge (below). The UI value wins a conflict, with a WARN. | Allowed |
| **ENV** | The fields the configuration file defines are set from E; the rest keep D. The whole setting if no file was captured. A setting that cannot be applied stops the start. | Changing a file-defined field returns **409** `SETTINGS_MANAGED_BY_ENVIRONMENT`; other fields stay editable |
| **DB** | A present stored value is never overwritten. Fields the stored value lacks are filled from deliberate deployment values. Later deployment changes are logged as ignored. | Allowed |

- ENV on a group without a deployment block fails the start (`validateConfiguration`).
- The first start that switches the security group to ENV refuses to replace an identity provider
  configured in the UI with a different one, unless `confirmProviderChange` is true. The replaced
  value is kept in `meta.previousStored`.
- The mode a server reconciled with is persisted in `meta.mode`. Processes that do not reconcile,
  such as CLI jobs, read it from there, so they honour ENV mode without the variable.

## Field policies (`SettingsFieldPolicies`)

Merging leaf by leaf produced unsafe hybrids, for example one provider's secret combined with
another provider's client id. Each field therefore belongs to a merge unit:

| Kind | Fields | Rule |
|---|---|---|
| DEPLOYMENT_OWNED | auth `forceSecureSessionCookie`; authorizer `className`, `containerRequestFilter` | Always E (all three are read once at start) |
| IDP_IDENTITY | `provider`, `clientType`, `authority`, `clientId`, `oidcConfiguration.id`/`discoveryUri`, `samlConfiguration.idp.entityId`, `ldapConfiguration.host` | Decides whether D and E describe the same identity provider |
| IDP_DEPENDENT | the `oidc`/`saml`/`ldap` blocks, `responseType`, `providerName`, `callbackUrl`, `tokenValidationAlgorithm`, `publicKeyUrls`; the claims group; the LDAP roles group | Follows the identity guard; a group moves as one value |
| SET_MERGE | authorizer `adminPrincipals`, `adminEmails`, `allowedEmailRegistrationDomains` | `D − (L − E) ∪ (E − L)`: entries the deployment removed or added since last time, UI entries kept |
| Group (INDEPENDENT) | authorizer domains: `enforcePrincipalDomain`, `principalDomain`, `allowedDomains`, `allowedEmailDomains` | All or nothing (half a restriction can lock everyone out) |
| Single value | `oidcConfiguration.customParams`, `ldapConfiguration.trustStoreConfig` | Compared and replaced whole |
| INDEPENDENT | everything else, including every field of email, server URL, SCIM, MCP and app | Per leaf |

## AUTO merge (`SettingsMerge`)

For each unit:
- **First time the unit is reconciled** (upgrade, a field added in a later release, a new key in
  the file): fill it from E only when E is deliberate and non-blank, D lacks a value, and E differs
  from D's effective value.
  - "D lacks a value" also covers D equal to the schema default for `maxActiveSessionsPerUser`,
    `sessionExpiry`, the token validities and LDAP `maxPoolSize`, because PATCH used to persist
    in-memory defaults. This fixes collate#4484.
  - Otherwise keep D, and WARN when E is deliberate and differs from it (DRIFT).
- **E changed, D did not** (D = L): apply E.
  - A change to a default the operator never set logs "deployment default changed".
  - Blocks of inactive providers are never created.
- **E and D both changed**: keep D and WARN (CONFLICT), unless they converged.
- **E unchanged**: keep D, and WARN when deliberate E ≠ D (DRIFT).
- **A blank E never overwrites a non-blank D**, so a missing Kubernetes secret cannot wipe a
  working password (KEPT_OVER_BLANK).
- **Identity guard** (`ProviderChange`):
  - If the UI switched the identity provider, deployment changes to the identity units and the
    provider-dependent units are ignored, with a WARN.
  - If the deployment switched it, all of those units change together.
  - While the two name different providers, the deployment's provider fields count as overriding
    the stored ones only when the deployment names its provider on purpose. Otherwise they belong
    to a provider nobody set up: Helm's own JWKS address, for example, makes `publicKeyUrls`
    deliberate while the provider is still the default `basic`. The same rule keeps DB mode from
    filling one provider's fields into another's on first sight.
- The merged value goes through the API write validation (`prepareReconciled`): base URL, active
  provider, token validity, authorizer schema. In AUTO and DB modes a value that fails keeps D and
  logs an ERROR; the server still starts.
- WARNs name the field and its environment variable, never values. Each is logged once per
  (outcome, unit, deployment value); later starts log a count and point to the status endpoint.
  CONFLICT and DRIFT warnings name the remedies: "Use deployment value" on the settings page,
  `./bootstrap/openmetadata-ops.sh adopt-deployment-config --type <configType> --path <field>`, or
  `<GROUP>_CONFIG_SOURCE=ENV`.
- Finally L := E.

## Start, seeding and writes

1. `initialize` wraps the configuration source in `RawConfigCapture`.
2. `run()` installs `ConfigSources` (E, templates, modes).
3. `SettingsCache.initialize` seeds missing rows with an SQL insert-if-absent that also writes L.
   - An unparsable row is never overwritten.
   - CLI commands use `initializeWithoutDeploymentSettings` and never seed these settings, so a job
     with a reduced environment cannot store `basic` authentication for the live servers.
4. `DeploymentConfigReconciler.reconcileAll` (server only):
   - It writes with compare-and-set (bounded retries).
   - The CAS statement also records the database's hash of the written value in
     `meta.appliedJsonHash`, in the same statement.
   - A server older than `meta.appVersion` does not write.
5. `SecurityConfigurationManager.initialize`, then the `SettingsChangeWatcher`.

API writes:
- **Write guard.** `SystemRepository.updateSetting` and `updateSettingIfCurrent` run the guard
  first (`SettingsWriteGuard`). That covers REST, the CLI and Collate administration jobs.
  `createOrUpdate` rethrows the rejection instead of turning it into a 500 response, so a job that
  ignores the returned response still fails.
- **Security endpoints.** PUT and PATCH `/system/security/config` check both settings before
  validating or writing anything, so a 409 is never preceded by unrelated validation errors and a
  write never stops halfway.
- **PATCH** applies the patch to a fresh database read and writes with compare-and-set, returning
  412 if another writer got there first. PUT restores masked secrets from a fresh read too.
- `remove-security-config` deletes by key, which also works for an unparsable row. The next start
  seeds the deployment configuration again.

## Secrets

- Secret fields are those marked `"format": "password"` in the schema (`@PasswordField`, found by
  `SettingsSecrets` through Jackson):
  - OIDC `secret`;
  - LDAP `dnAdminPassword` and `trustStoreFilePassword`;
  - SAML `spPrivateKey` and `keyStorePassword`;
  - SMTP `password`.
- The SAML certificates are public, so they are no longer masked.
- Authentication secrets are Fernet-encrypted at rest, in the row and in L. Encryption is
  idempotent and skipped when no key is configured. The 2.1.0 data migration
  `AuthenticationSecretsEncryptionMigration` encrypts existing rows.
- Reads decrypt, so `SecurityConfigurationManager` and Collate get plaintext.
- GET `/system/security/config` masks every secret. PUT, PATCH and Test Login put the stored
  secret back in place of the mask. Test Login does so only when the candidate targets the same
  client, directory or IdP.
- A value that cannot be decrypted (the key changed) is never compared or applied; it is logged.

## Changes made on another server (#30882)

- **Polling.** `SettingsChangeWatcher` polls `listSettingsFingerprints` every `watchIntervalSeconds`
  (MySQL `SHA2(CAST(json AS CHAR),256)`, Postgres `md5(json::text)`). With Redis, writers also
  publish `CacheInvalidationPubSub.TYPE_SETTINGS`, which triggers a poll at once.
- **Refresh.** A changed row is refreshed locally (`LocalSettingsRefresher`):
  - The cache entry is invalidated.
  - Security and MCP reload only if the stored value differs from the running one.
  - Login and workflow settings re-initialize.
  - A failed refresh keeps the running value and is reported as `lastReloadError`.
- **Another server's start is not followed.** A change is skipped when it was written by another
  server's start-up reconciliation: its hash equals `meta.appliedJsonHash` *and* that mark is new
  since the last poll. Each server applies its own deployment configuration when it starts, the way
  a rolling update replaces servers, so a bad configuration does not reach every server at once.
  An admin who undoes a change back to that value is still followed, because the mark did not move.
- **Restart-only state.** The authenticator and the JWT filters (REST, websocket, MCP) are rebuilt
  on reload. These still need a restart:
  - the Jetty session-cookie flags;
  - MCP servlet registration;
  - admin and bot bootstrap;
  - the authorizer class.

## Status and adopt

- **`GET /api/v1/system/settings/source`** (admin) returns, per setting (`settingsSourceResponse.json`):
  - `source` and `sourceVariable`;
  - `editable` and `managedPaths` (ENV);
  - `overriddenFields[{path, envVariable}]`: the deliberate deployment values the stored value
    overrides (AUTO, DB);
  - `lastReloadError`.
- **`POST /api/v1/system/settings/source/{configType}/adopt {paths}`** stores the deployment value
  of the given fields. In ENV mode it returns 409, since the start already applied E.
  - No paths means exactly the fields `overriddenFields` lists; when it lists none, nothing changes.
  - A blank deployment value means "not set" and never replaces a stored value.
  - When stored and deployment name the same identity provider, a provider field is taken on its
    own. When they name different providers, taking any provider field replaces the provider as a
    whole, blanks included, so the result never mixes two providers. That is refused (400) unless
    the deployment names its provider on purpose; the status then lists `/provider` too, so the
    admin sees the switch before confirming it.
- **CLI.** `./bootstrap/openmetadata-ops.sh adopt-deployment-config --type <configType> [--path <pointer>]...`
  does the same from a process that has the server's environment, for example inside a server pod.
  Running servers pick the change up through the watcher.

## Upgrade behavior (release notes)

- No present stored value changes at upgrade, with two exceptions:
  - deliberate deployment values for fields the row lacks are filled (collate#4484);
  - authentication secrets are encrypted in place.
- Each deliberate value the database overrides is logged once with its environment variable and
  the remedies, and listed by the status endpoint.
- **After the upgrade:**
  - A configuration change applies at the next start unless the UI changed the same field.
  - UI changes reach every server within `watchIntervalSeconds`.
  - Admin bootstrap reads the effective (stored) authorizer configuration.

## Testing

- **Unit tests** (`openmetadata-service/src/test/.../config/source/`):
  - `SettingsMergeTest`: every rule above.
  - `DeploymentConfigReconcilerTest`: CAS retries, ENV failures, seeding.
  - `SettingsChangeWatcherTest`: start-up skip, undo, failed refresh, deleted row.
  - `SettingsSourceServiceTest`: status, overridden fields, adopt (single field, all, identity
    provider together, ENV refusal).
  - `ConfigSourcesTest`: mode precedence (test override, persisted, deployment, default).
  - `SettingsSecretsTest`, `SettingsWriteGuardTest`, `DeploymentConfigTest`.
  - Outside the package: `SystemRepositorySecuritySettingsTest` (encryption at rest, CAS 412, ENV
    rejections rethrown, reconciled-value validation), `ActiveProviderValidatorTest`,
    `OpenMetadataOperationsSettingsSourceTest` (CLI adopt and remove by key).
- **`ConfigSourceIT`** replays starts against the real server and database. It covers:
  - deployment change vs UI change;
  - the upgrade case of collate#4484 (stored row without the field, or with the schema default);
  - a blank deployment value never clearing a stored one;
  - overridden fields and adopt, admin-only (403 otherwise);
  - ENV 409 on PUT and PATCH, the generic settings endpoint and MCP; validate still allowed;
  - another server's writes (start-up skip, change, undo);
  - secrets encrypted at rest.

  Run it on both engines:
  ```bash
  mvn verify -Pmysql-elasticsearch -pl :openmetadata-integration-tests -am \
    -Dit.test=ConfigSourceIT -DintegrationTests.skipIsolated=true \
    -Dfailsafe.failIfNoSpecifiedTests=false -Dtest=NoSuchTest -Dsurefire.failIfNoSpecifiedTests=false
  ```
  Repeat with `-Ppostgres-opensearch`.

## Follow-ups outside this repository

- **Collate.** Several changes are needed:
  - add the `configSource` block, defaulting every group to DB, so fleet-wide environment changes
    do not become tenant writes;
  - add the parity keys;
  - map the 409 in the administration jobs and write there with compare-and-set;
  - read live configuration in the onboarding, SCIM and hybrid-runner code;
  - restore the provider in `AdminOpsApiIT`.
- **Helm chart.** Expose the `*_CONFIG_SOURCE` variables.
- **Documentation site.** Add a page on precedence, modes, adopt and reset.
