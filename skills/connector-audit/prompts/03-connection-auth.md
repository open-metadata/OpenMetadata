# Prompt 3: Connection & Auth

Review connection setup, auth method coverage, and test connection validation.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

Audit this connector for connection setup and authentication.

Load the connector standards with /connector-standards, then analyze against the Connection Setup standard (Standard 3).

## Where to look

**1. Connection implementation:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/connection.py` — get_connection(), test_connection()
- `ingestion/src/metadata/ingestion/connections/builders.py` — shared connection URL building, get_connection_url_common()

**2. Connection schema (CRITICAL — defines what auth methods we support):**
- `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/[SERVICE_TYPE]/[connector]Connection.json`
- Follow ALL `$ref` links to auth type schemas (e.g., in `connections/`, `security/credentials/`)
- Check `authType` field and its `oneOf` variants — this defines which auth methods users can configure

**Token lifecycle (CRITICAL for temporary credentials):** For EACH temporary credential auth type (IAM, OAuth, Azure AD, etc.), trace the full lifecycle: where is the token generated? Where stored? What is its expiration time? Is there a refresh mechanism? Check BOTH `connection.py` AND `builders.py` — IAM tokens may be generated in shared code, not the connector.

**3. Test connection steps:**
- `ingestion/src/metadata/ingestion/source/[SERVICE_TYPE]/[CONNECTOR_NAME]/connection.py` — test_connection_steps()
- Each step should validate real access, not just connectivity

**4. Source system documentation:**
- Research the official auth methods the source system supports
- Compare against what our schema offers

## What to assess

### Auth Method Coverage

1. **Research the source system's official auth methods** — check their documentation for:
   - Username/password (basic auth)
   - OAuth 2.0 / SSO
   - API keys / tokens
   - Service accounts / service principals
   - IAM roles (AWS, GCP, Azure)
   - Key pair authentication
   - Kerberos / LDAP
   - Certificate-based auth

2. **Map our schema's auth support** — from the JSON schema:
   - What `authType` variants exist?
   - Which fields does each variant expose?
   - Are field types correct (SecretStr for passwords, proper enums)?

3. **Present as a comparison table:**
   | Auth Method | Source System | Our Schema | Status | Notes |

### Test Connection Validation

For each step in `test_connection_steps()`:
1. What does it actually validate? (connectivity only, or real access?)
2. Does it test with the configured auth method?
3. Does it validate read permissions (e.g., can list schemas/tables)?
4. Are errors specific and actionable?

### Error Message Quality

Check connection error handling for:
1. **Specificity**: Does the error tell the user WHAT went wrong? (auth failure vs network vs permissions)
2. **Actionability**: Does the error tell the user HOW to fix it?
3. **Context**: Does the error include relevant details? (username, host, auth method)
4. **No credential leaks**: Are passwords/tokens excluded from error messages and logs?

### SSL/TLS Support

1. Is SSL/TLS configurable in the schema?
2. Can users provide custom CA certificates?
3. Is there a `verifySSL` option?
4. Does the connection implementation actually use these settings?

**Dead code check:** Before concluding a config field (like `sslConfig`) is dead code, trace the full initialization path — including `__init__`, shared utilities like `ssl_manager.py`, and any pre-engine setup hooks. A field may be consumed by shared infrastructure (e.g., `SSLManager.setup_ssl()` injecting values into `connectionArguments`) rather than by connector-specific code in `connection.py`.

## Rating Calibration

**Connection Setup:**
- ✅ Compliant = All major auth methods the source system supports are in our schema, test_connection validates real access with specific error messages, SSL/TLS is configurable, schema fields properly typed
- ⚠️ Partial = Primary auth method works (e.g., username/password), but missing modern methods (OAuth, SSO, IAM). Test connection checks connectivity but not full access. Error messages exist but are generic.
- ❌ Gaps = Missing auth methods customers commonly use, test_connection is superficial or broken, errors are generic "Connection failed" with no guidance

**Optimism traps:**
- "We support BasicAuth" — Most source systems support 3-5 auth methods. BasicAuth alone is ⚠️ at best if OAuth/IAM/SSO are available.
- "test_connection passes" — Does it test with a real query or just open a socket? A successful TCP connection doesn't mean the user has read permissions.
- "SSL is supported" — Is it configurable? Can users provide custom CA certs? Or is it just a boolean flag that defaults to off?
- "The schema has all the fields" — Are they the right types? Is `password` a SecretStr? Are descriptions helpful?

Present findings as:
1. Auth method comparison table (source system vs our schema)
2. Test connection step analysis
3. Connection Setup rating with evidence
4. Specific issues found with file:line references
5. Recommended fixes prioritized by customer impact

## Present & Validate

Before saving, present a summary to the user for review:
1. **Rating** — Connection Setup standard rating with one-line justification
2. **Auth coverage** — how many of the source system's auth methods we support (X of Y)
3. **Top findings** — the 3-5 most important issues, each with severity and a one-sentence description
4. **Anything you're uncertain about** — flag findings where you're not confident (e.g., "I believe SSL is wired through the base class but could not fully verify")

Then ask: *"Ready to save to `.claude/audit-results/03-connection-auth.md`? Any findings to adjust?"*

If the user requests changes, revise and re-present. Once the user confirms, **save the full report** to `.claude/audit-results/03-connection-auth.md` (create the directory if needed) — Prompt 6 reads this file.
