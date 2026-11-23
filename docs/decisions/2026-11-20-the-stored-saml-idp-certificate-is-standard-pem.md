# The stored SAML IdP certificate is standard PEM: the server reads it strictly, a migration rewrites older layouts once, and the settings write step checks every new one

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `IdpCertificatePemTest` and `SamlIdpCertificateMigrationTest` (the layouts the step rewrites and the values it leaves alone); `SettingsWriteFunnelTest` (no setting is written past the write step); `SystemRepositorySecuritySettingsTest` and `SsoSamlIdpCertificateIT` (each way in refuses a bad new certificate and keeps an unchanged one); `SystemResourceSecurityConfigApplyTest` and `SsoSamlIdpCertificateIT` (a refused save puts the rows back unchanged)
- **Related:** #37056; PR #38197, PR #38219 and PR #38302 (the strict reader); ADR:2026-11-11-a-data-migration-carries-its-own-logic

## Context

Up to 2.0.9 the server read `samlConfiguration.idp.idpX509Certificate` through java-saml, which
removes the PEM markers and every whitespace character before decoding. Saving the setting checked
it the same way. So a certificate pasted on a single line, with spaces where the line breaks belong,
or with spaces before the `BEGIN` line was accepted and worked.

From 2.0.10 the server reads the certificate with the JDK `CertificateFactory`, which accepts
standard PEM (CRLF line breaks and lines of other lengths included) and bare base64, but rejects
those three layouts. The certificate is read while the server starts, so a stored value in one of
them stops the server from starting after the upgrade.

The UI saves the configuration with a PATCH, which runs the full validation, certificate included.
Other ways wrote it without that check: the first start, which seeds the setting from the
deployment (`SAML_IDP_CERTIFICATE` in `openmetadata.yaml`); on main and 2.1 every start that
reconciles it; a PUT of the security configuration; and the `update-security-config` command.
Checking each of them by hand would leave the next new way unchecked.

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
5. **The check runs in one place: the settings write step** (`SystemRepository`'s
   `prepareSettingForUpdate`), which every write of a setting's value passes before the database:
   the UI and API saves (PUT and PATCH of the security configuration, the settings endpoints), the
   administration commands, seeds and the reconciled deployment value. The step gets the new value
   and the stored value it replaces, decrypted, and runs the checks of that setting type. For the
   authentication configuration it calls `SamlValidator.validateIdpCertificate`, the check the
   full validation of a save runs, so there is one rule. `SettingsWriteFunnelTest` fails when a
   new method writes a setting's value without that step. The full validation of a save stays in
   front of it, with its network checks.
6. **Ratcheting.** The step checks only a certificate that is new or differs from the stored one. A
   stored certificate that expired since it was saved keeps working at runtime, so sending it back
   unchanged or restarting with it never fails.
7. **A refused certificate is never stored, and each way reports it as before.** An API save
   answers 400 naming the field; a command exits non-zero with that message; a first start stops
   with it; a reconciled value follows the setting's mode: in `AUTO` and `DB` the stored value
   stays and the error is logged on every start until the deployment value is fixed, in `ENV` the
   start stops.
8. **Undoing a refused save is not a new write.** When the server cannot apply a security
   configuration save (ADR:2026-11-12-a-security-configuration-save-applies-in-full-or-is-refused),
   it puts back the two rows that save replaced as they were read, compared and set against what it
   wrote, without the write step. Those rows passed the step when they were stored; checked again
   against the refused save, a certificate that expired since would be refused and the refused save
   left stored. `SettingsWriteFunnelTest` lists that method among the reviewed writers.

## Consequences

Upgraded databases hold certificates the strict reader accepts, and no write can put a
bad one back. In `AUTO` mode an unchanged `SAML_IDP_CERTIFICATE` keeps the migrated value, and so
does the stored row on 2.0, where the deployment only seeds an empty database. After the migration
the stored certificate differs from the deployment value last applied, as after an edit in the UI,
so a later change of the variable in `AUTO` mode is reported as a conflict and the stored value
wins; the UI applies it. In `ENV` mode the deployment value is applied on every start, so an old-layout
`SAML_IDP_CERTIFICATE` stops the first start after the upgrade, although the migration fixed the
stored copy, until it is given in standard PEM or as the base64 body alone.
Revisit if the server ever has to accept these layouts again at runtime, for example from IdP
metadata it fetches itself.
