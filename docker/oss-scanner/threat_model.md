<!-- Maintainers: anthropics/oss-scanner reads this file by path. See
ADR:2026-10-09-oss-scanner-build-image-paths-are-a-cross-repo-contract before moving or renaming it. -->
# OpenMetadata threat model for Anthropic's OSS Scanner

The scanner reads this file before it starts. It covers the OpenMetadata **server**, the part
`docker/oss-scanner/Dockerfile` builds. For the general deployment guidance see
[THREAT_MODEL.md](../../THREAT_MODEL.md).

## Security reporting scope

The scanner's private security reports must follow [SECURITY.md](../../SECURITY.md): only
authentication vulnerabilities that let an unauthenticated attacker access OpenMetadata or its
protected data are eligible. Reproduce the issue on a supported release with authentication enabled
and the documented production security configuration in place.

This scope replaces the earlier rubric that treated authenticated attack outcomes and authorization
bypasses as reportable security findings. See
ADR:2026-10-14-cve-reporting-covers-unauthenticated-access-only. The input surfaces and controls below
remain relevant to understanding the server; they do not independently establish report eligibility.

## What the server does and where untrusted input enters

OpenMetadata is a metadata platform for data discovery, lineage, quality and governance. The server
(`openmetadata-service`, Java 21, Dropwizard/Jersey) is its security boundary. It exposes a REST API
under `/api/v1/...`, serves the web UI, and stores metadata together with the credentials used to
reach the organisation's databases, warehouses, dashboards and pipelines. It is usually deployed
inside a company network where every employee can reach it; some deployments put it on the Internet
behind SSO.

Untrusted input reaches the server through:

- **Unauthenticated HTTP**: every endpoint in `JwtFilter.EXCLUDED_ENDPOINTS` (login, signup,
  registration confirmation, password reset, token refresh, public system config, health, version
  and the others listed there), the SAML, OIDC and `/api/v1/auth/*` servlets, the MCP OAuth
  endpoints, and the static asset servlet.
- **The socket.io push feed** at `/api/v1/push/feed`.
- **Any authenticated user**, whatever their role. Self-signup, when enabled, creates an
  authenticated user; using that intended registration flow is not an authentication bypass. Users
  control request bodies, query parameters and headers, including JSON Patch documents, CSV and YAML
  imports, search queries, and content the server stores and later processes for other users.
- **Metadata written by others**: names, descriptions, tags, lineage and sample data sent by
  ingestion bots or other users, which the server later renders, evaluates or forwards.
- **Responses to outbound requests** the server makes: webhooks and alert destinations, OIDC
  discovery and JWKS documents, the pipeline service (Airflow), secrets managers, and LLM or
  embedding providers.
- **MCP clients**: AI agents calling the `openmetadata-mcp` tools on a user's behalf.

## Trust model

- **Admins** are trusted to configure the server, its services, connections, workflows, apps and
  policies. They supply or manage service connection details and know what their connected source
  systems hold. Their connection tests, ingestion and integration operations are privileged
  capabilities; outcomes requiring legitimate admin credentials are outside the reporting scope.
- **Bots** (ingestion, profiler, usage, application bots) are trusted service accounts. By design they
  receive unmasked connection secrets. Users and bots explicitly delegated service-management
  capabilities are trusted to perform them within their granted permissions.
- **Every other user** must stay within what their roles and policies grant: RBAC rules and their
  conditions, ownership, teams and domains. By default the Organization policy lets every user view
  all metadata (`ViewAll`), so reading metadata through that rule is expected. Authorization defects
  affecting already authenticated users are product bugs, outside CVE and private advisory scope.
- **Unauthenticated clients** are untrusted.
- `conf/openmetadata.yaml` and the environment are trusted operator input.

## Components that matter most

1. Authentication: `openmetadata-service/.../security/` (`JwtFilter`, `JWTTokenGenerator`, basic
   auth, LDAP, SAML, the OIDC code flow, sessions, personal access tokens, bot tokens,
   impersonation).
2. Authorization: `DefaultAuthorizer`, `PolicyEvaluator`, `CompiledRule`, `ExpressionValidator`,
   `RuleEvaluator`, domain access, the authorization calls in every resource under `resources/`, and
   the RBAC filtering of search results.
3. Secrets: Fernet encryption, the secrets managers, and the masking of connection secrets in API
   responses.
4. Data access: the JDBI DAOs and repositories in `jdbi3/` and the search query builders in
   `search/`.
5. Features that fetch URLs or evaluate stored content: event subscriptions and webhooks
   (`OutboundUrlPolicy`), notification and email templates, governance workflows (Flowable), Data
   Insights formulas, the apps framework, CSV and YAML import and export, and the RDF/SPARQL
   endpoints.
6. `openmetadata-mcp`: the MCP server, its OAuth endpoints, and the authorization of its tools.
7. The socket.io/websocket push feed.

## Components that matter less, or are out of scope

- Lower priority, and not built in this image: the UI (`openmetadata-ui`,
  `openmetadata-ui-core-components`), the Python ingestion framework (`ingestion/`) and
  `openmetadata-airflow-apis`, which run inside the operator's own infrastructure with credentials
  the operator gives them, and the Kubernetes operator, SDKs and clients. Stored XSS or another
  content-processing defect is eligible only if it independently meets the authentication reporting
  scope above; accepting or returning unsanitized content alone is insufficient.
- Out of scope: tests (`**/src/test/**`, `openmetadata-integration-tests`, Playwright), `examples/`,
  `scripts/`, `docker/` development and quickstart files, documentation, and CI workflows.

## How to build and exercise it in this image

- `/src` is the checkout. The image ran
  `mvn -DskipTests install -pl openmetadata-service,openmetadata-mcp -am`, so those modules and the
  ones they depend on are compiled and installed in `/root/.m2`. JDK 21 and Maven 3.9.9 are on the
  `PATH`. There is no network, database or search engine, so the server itself cannot start here.
- Run unit tests offline without `-am`:
  `mvn -o -pl openmetadata-service test -Dtest=JwtFilterTest` (or `-pl openmetadata-mcp`).
  Do not combine `-am` with the `compile` or `test` phases: the shaded Elasticsearch and OpenSearch
  clients only exist after `package`. After changing `common` or `openmetadata-spec`, run
  `mvn -o -DskipTests install -pl openmetadata-service -am` first.
- Write proofs of concept as JUnit 5 and Mockito tests beside the existing ones, which mock the
  database and search layers. `JwtFilterTest` and `DefaultAuthorizerTest` are good models; the
  module's other tests show how each area is set up.
- When an issue needs a running server, give the exact HTTP requests against a supported deployment
  with production authentication configured and sample accounts and keys replaced, as described in
  SECURITY.md. State every credential, role and configuration change used in the reproduction.

## How we rate eligible findings

Apply the reporting scope before assigning severity. A severe outcome does not make a finding that
requires a legitimate authenticated account eligible for a CVE or private advisory.

- **Critical**: an authentication failure gives an unauthenticated attacker admin or bot access,
  server code execution, SQL injection, or access to protected connection secrets, bot tokens or
  password hashes.
- **High**: an authentication failure gives an unauthenticated attacker access to protected metadata
  or platform operations without one of the Critical outcomes above.

Supported production authentication configurations, including SAML or OIDC, are eligible under the
same rule. Disabled authentication, intentionally public features and unchanged test defaults do
not meet that rule. Out-of-scope findings do not receive an advisory severity under this rubric;
product bugs can be reported through the normal issue tracker with sensitive data removed.

## Please do not report

- Findings requiring an existing legitimate user or bot credential, including an authenticated
  non-admin or self-signed-up user obtaining server code execution, SQL injection, unmasked
  connection secrets, bot tokens, password hashes, or escalation to admin or bot privileges. If a
  report also alleges an authentication bypass, reproduce that bypass independently without
  assuming a legitimate account or previously obtained access.
- Policy or authorization defects affecting authenticated users: role, permission, ownership and
  visibility bypasses, metadata access or modification denied by a policy, and feed author spoofing.
- Expected administrator or delegated-operator capabilities, including service connections,
  ingestion and outbound requests to configured destinations. SSRF claims, including access to
  internal responses, must independently demonstrate an authentication failure giving an
  unauthenticated attacker access to OpenMetadata or its protected data.
- Known development defaults that production deployments are documented to replace: the initial
  password of the default `admin` user, and the JWT key pair and Fernet key bundled in `conf/`, or
  deployments with authentication disabled or omitted. A replaced production setting that does not
  take effect is eligible only when it demonstrably permits unauthenticated protected access.
- Intentionally enabled self-signup, public login configuration, JWKS public keys, OAuth client IDs
  and other credential identifiers, without a demonstrated authentication failure.
- Findings that assume database, filesystem or container access, or stolen credentials, without
  demonstrating how an authentication vulnerability gives the attacker that access.
- Dependency scan results, third-party CVE lists, static warnings or source snippets without a
  working reproduction of unauthenticated protected access through OpenMetadata; dependency CVEs
  are tracked separately.
- Login failures, denial of service, username enumeration, missing rate limiting, missing security
  headers, clickjacking, XSS, open redirects or CSRF without the authentication failure and protected
  access required above.

## Reports and patches

- Submit only eligible findings privately through the reporting procedure in SECURITY.md.
- One report per root cause, listing every affected endpoint or class.
- State the affected supported version, production authentication configuration, every prerequisite,
  and the expected and observed authentication behavior.
- Include a reproducer (a unit test as described above, or HTTP requests) and a minimal patch against
  `main` with a regression test. The reproducer must demonstrate protected access starting without
  legitimate credentials; scanner output or a missing authorization call alone is insufficient.
  Match the surrounding code style.
