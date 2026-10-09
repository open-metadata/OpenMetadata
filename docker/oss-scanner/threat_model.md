# OpenMetadata threat model for Anthropic's OSS Scanner

The scanner reads this file before it starts. It covers the OpenMetadata **server**, the part
`docker/oss-scanner/Dockerfile` builds. For the general deployment guidance see
[THREAT_MODEL.md](../../THREAT_MODEL.md).

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
- **Any authenticated user**, whatever their role. With the default basic authentication anyone who
  can reach the server can sign up. They control every request body, query parameter and header,
  including JSON Patch documents, CSV and YAML imports, search queries, and content the server
  stores and later processes for other users.
- **Metadata written by others**: names, descriptions, tags, lineage and sample data sent by
  ingestion bots or other users, which the server later renders, evaluates or forwards.
- **Responses to outbound requests** the server makes: webhooks and alert destinations, OIDC
  discovery and JWKS documents, the pipeline service (Airflow), secrets managers, and LLM or
  embedding providers.
- **MCP clients**: AI agents calling the `openmetadata-mcp` tools on a user's behalf.

## Trust model

- **Admins** are trusted to configure the server, its services, connections, workflows, apps and
  policies. An admin-only issue matters only when it gives an admin something the product does not:
  code execution on the server host, or secrets that the API is designed to mask.
- **Bots** (ingestion, profiler, usage, application bots) are trusted service accounts. By design they
  receive unmasked connection secrets.
- **Every other user** must stay within what their roles and policies grant: RBAC rules and their
  conditions, ownership, teams and domains. By default the Organization policy lets every user view
  all metadata (`ViewAll`), so reading metadata through that rule is not a finding.
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
  the operator gives them, and the Kubernetes operator, SDKs and clients. Stored XSS is in scope
  when the server accepts or returns content it is meant to sanitize.
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
- When an issue needs a running server, give the exact HTTP requests against a default deployment
  (`docker/docker-compose-quickstart`), stating the user and role that sends each one.

## How we rate severity

- **Critical**: code execution on the server; authentication bypass or token forgery that works
  against a deployment configured with its own keys; reading connection secrets, bot tokens or
  password hashes; SQL injection. All without authentication.
- **High**: the same outcomes for any authenticated non-admin user, including self-signed-up users,
  as well as escalation to admin or bot privileges, and SSRF that returns the responses of internal
  services.
- **Medium**: authorization bypasses that let a user read or change metadata their policies deny,
  without escalation; blind SSRF; stored XSS reaching other users through data the server should
  sanitize; open redirect or CSRF in login and SSO flows; a non-admin user crashing or hanging the
  server.
- **Low**: information disclosure without secrets (versions, stack traces, user enumeration),
  denial of service that needs admin rights or very high request volumes, and admin-only issues that
  do not reach the server host.

A finding that needs a non-default configuration is rated as above when that configuration is
common in production (for example SSO through SAML or OIDC, or PostgreSQL instead of MySQL), and
one level lower otherwise.

## Please do not report

- Known development defaults that production deployments are documented to replace: the initial
  password of the default `admin` user, and the JWT key pair and Fernet key bundled in `conf/`. Do
  report it if a documented production setting does not take effect, or if the server keeps
  relying on one of these defaults after the operator has replaced it.
- Vulnerabilities in third-party dependencies unless OpenMetadata code reaches them in an
  exploitable way; we track dependency CVEs separately.
- Missing rate limiting beyond the existing login lockout, missing security headers, clickjacking
  and self-XSS, unless they combine into one of the outcomes above.

## Reports and patches

- One report per root cause, listing every affected endpoint or class.
- Say which role is needed and which configuration, if not the default.
- Include a reproducer (a unit test as described above, or HTTP requests) and a minimal patch against
  `main` with a regression test. Match the surrounding code style.
