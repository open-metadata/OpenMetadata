# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.13.x  | :white_check_mark: |
| 1.12.x  | :white_check_mark: |

## CVE and Security Advisory Scope

This policy applies to all OpenMetadata products. **Our CVE and GitHub Security
Advisory process is limited to authentication vulnerabilities that allow an
unauthenticated attacker to access the platform or its protected data.** The
issue must be reproducible on a supported version with authentication enabled
and the documented production security configuration in place.

Authentication establishes a user's identity. Authorization determines what an
authenticated user may do. **We do not consider policy or authorization issues
to be CVE vulnerabilities**, including RBAC/ABAC, role, permission, ownership,
and visibility enforcement issues affecting already authenticated users. A
logged-in user with insufficient permissions is still an authenticated user.

Examples within scope include reading protected data without authentication or
bypassing login or token validation to obtain access without legitimate
credentials. A report must demonstrate that authentication boundary being
crossed; an unexpected permission or missing authorization call does not
demonstrate an authentication bypass.

### Administrators and Service Connections

Administrators are trusted operators and have permissions that ordinary users
do not have. These include configuring services and their credentials, testing
connections, managing ingestion, and configuring integrations and webhooks.
Users or bots explicitly delegated these capabilities are trusted to perform
them within their granted permissions.

An administrator connecting a service already supplies or manages its
connection details and knows what the source system holds. Connecting to that
system, accessing its connection details, and ingesting its metadata or
configured sample data are expected capabilities. Demonstrating these actions
with an administrator's credentials does not establish a vulnerability within
our CVE scope.

For example, a connection test or webhook making an outbound request to an
administrator-configured destination, including an internal service, does not
by itself establish an in-scope SSRF vulnerability. A report involving a
connector or integration must demonstrate an independent authentication bypass
that permits an unauthenticated attacker to access the platform or its data.

### Out-of-Scope Reports

We close the following submissions as outside our CVE and Security Advisory
scope:

- **Authenticated policy or authorization issues:** a logged-in user reading
  search results, lineage, attachment metadata, private content, or connection
  fields despite a restrictive policy; modifying another user's metadata; or
  bypassing permissions on ingestion or application actions. Feed author
  spoofing by an authenticated user is also an authorization issue.
- **Findings requiring an existing legitimate user or bot credential:** this
  includes authenticated injection or script execution. If a report also
  alleges an authentication bypass, reproduce that bypass independently.
- **Expected privileged operations:** administrators or delegated operators
  configuring connections, running ingestion, querying a connected source, or
  directing integrations to systems they manage.
- **Deployment configuration and test defaults:** authentication disabled or
  omitted, unchanged quickstart accounts or passwords, sample JWT signing or
  encryption keys, and test fixtures. Production deployments must follow the
  [security configuration guide](https://docs.open-metadata.org/latest/deployment/security)
  and replace the default accounts and keys as described in the
  [JWT setup guide](https://docs.open-metadata.org/latest/deployment/security/enable-jwt-tokens).
- **Intentionally public behavior:** self-signup when enabled, login bootstrap
  configuration, or JWKS public keys. OAuth client IDs, key IDs, and other
  credential identifiers are not evidence of leaked passwords or private keys.
  Demonstrating this behavior alone does not establish access to protected data.
- **Previously obtained access:** findings that assume the attacker can already
  read the backing database, access the server filesystem or container, or use
  stolen credentials, without demonstrating how an authentication vulnerability
  provides that access.
- **Unsubstantiated or unrelated findings:** dependency or container scan output,
  third-party CVE lists, static-analysis warnings, or source-code snippets without
  a working reproduction of unauthenticated access in OpenMetadata. Login
  failures, denial of service, missing hardening headers, and username enumeration
  without such access also fall outside this scope.

Out-of-scope behavior may still be a product bug. Report it through the normal
[GitHub issue tracker](https://github.com/open-metadata/OpenMetadata/issues),
with credentials and sensitive data removed, rather than creating a Security
Advisory or requesting a CVE.

## Reporting a Vulnerability

For an issue within the scope above, create a private draft
[GitHub Security Advisory](https://github.com/open-metadata/OpenMetadata/security/advisories/new).
Include:

1. The affected supported version and relevant deployment and authentication
   configuration, with secrets removed.
2. Complete reproduction steps, including requests and responses showing an
   unauthenticated attacker obtaining access to the platform or protected data.
3. All prerequisites, including any user or bot credentials, privileges,
   previously obtained access, or configuration changes used in the reproduction.
4. The expected authentication behavior, observed behavior, and concrete impact.

After the initial reply, the OpenMetadata team will keep you informed of the
progress toward a fix and announcement and may ask for additional information.
Reports outside the scope above or without sufficient reproduction evidence
will be closed.

Please do not disclose an in-scope vulnerability until it has been fixed and
announced, unless the OpenMetadata team has explicitly approved disclosure.
