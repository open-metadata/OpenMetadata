# The stored SAML IdP certificate is standard PEM: the server reads it strictly, and a migration rewrites older layouts once

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `IdpCertificatePemTest` and `SamlIdpCertificateMigrationTest` (the layouts the step rewrites and the values it leaves alone)
- **Related:** #37056; PR #38197, PR #38219 and PR #38302 (the strict reader); PR #37535 (a data migration carries its own logic)

## Context

Up to 2.0.9 the server read `samlConfiguration.idp.idpX509Certificate` through java-saml, which
removes the PEM markers and every whitespace character before decoding. Saving the setting checked
it the same way. So a certificate pasted on a single line, with spaces where the line breaks belong,
or with spaces before the `BEGIN` line was accepted and worked.

From 2.0.10 the server reads the certificate with the JDK `CertificateFactory`, which accepts
standard PEM (CRLF line breaks and lines of other lengths included) and bare base64, but rejects
those three layouts. The certificate is read while the server starts, so a stored value in one of
them stops the server from starting after the upgrade.

## Decision

1. **The server keeps the strict reader.** It reads the certificate the way Keycloak, Spring Boot
   and OpenSSL do, rather than carrying a lenient parser of its own.
2. **The 2.0.10 data migration rewrites the stored value once.** It reads the value the way 2.0.9
   did and writes it back as standard PEM: each marker on its own line, base64 wrapped at 64
   characters, certificates in their stored order, each once, joined by a line break. Bare base64
   becomes PEM as well.
3. **The step never loses data.** A value with anything besides certificates (text outside the
   markers, invalid base64, bytes that are not a certificate) is left as stored with a warning. A
   value that is already standard, ignoring trailing whitespace, is not written. Only that one field
   of the authentication configuration changes.
4. The step lives in 2.0.10 on every branch, so a database upgraded from 2.0.9 to 2.0.10 does not
   run it again on 2.1, and a database already on 2.1.0 runs it on its next upgrade.

## Consequences

Upgraded databases hold certificates the strict reader accepts. A certificate that comes from the
deployment configuration (`SAML_IDP_CERTIFICATE`) is not in the database the migration reads, or
is replaced on start when the setting is managed from the environment, so the operator fixes that
value at its source. Revisit if the server ever has to accept these layouts again at runtime, for
example from IdP metadata it fetches itself.
