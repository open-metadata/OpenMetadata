# Image JDKs distrust a compromised CA by deleting its roots from cacerts, not by fingerprint-blocking its intermediates

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial) · v2 2026-10-26 (three more roots that Oracle's JDK removes)
- **Deciders:** @mohityadav766
- **Guard:** the image build, which the step fails while any root in its list is still in the JDK's `cacerts`; `reviewer` for the rest
- **Related:** #36087, #36088, open-metadata/openmetadata-collate#7792, open-metadata/openmetadata-collate#7816, open-metadata/ai-platform#1856, #36234, #36235

## Context
CVE-2026-91403: eight eMudhra intermediate CAs were compromised, and their chains end at emSign
ECC Root CA - G3, emSign ECC Root CA - C3 and emSign Root CA - C1. Oracle's and OpenJDK's fix adds
the intermediates to `blocked.certs`; Temurin 21.0.13 instead removes the three roots from
`cacerts`. When this was decided the images' Temurin bases were still 21.0.12.1, which trusts the
chains. The olivaw and oss-scanner bases are pinned by digest, so they would never pick up
21.0.13 on their own.

The advisory's 16 fingerprints are not a safe substitute. Re-encoding an intermediate's ECDSA
signature as (r, n-s) gives a certificate with a new fingerprint that still verifies under the
issuer key: Temurin 21.0.12.1 with the 16 fingerprints added rejects `EM DV TLS CA - G3B` but
trusts its re-encoded twin.

## Decision
- A Dockerfile that ships a JDK deletes a compromised CA's roots from that JDK's `cacerts`,
  matched by SHA-256, and fails the build if any is still there. A jlinked runtime is fixed in
  its builder stage, because a distroless runtime stage has no shell.
- Fingerprints in `blocked.certs` are not used as the fix.
- An image that deletes roots this way does not re-import a system CA store into the JVM at
  startup. Temurin's entrypoint does that when `USE_SYSTEM_CA_CERTS` is set.

## Consequences
Every chain that ends at the three roots stops validating, legitimate ones included: the same set
Temurin 21.0.13 and Mozilla NSS 3.131.1 already distrust. Once every base ships Temurin 21.0.13 or
later, the step deletes nothing; it can then be dropped, or kept as the check that the roots stay
gone. A later CA compromise is handled the same way, by adding its roots' SHA-256 to the step.

## Amendment
**v2, 2026-10-26.** Oracle JDK 21.0.13.0.3 removes four roots from `cacerts`:
emSign Root CA - G1, emSign Root CA - G2, emSign ECC Root CA - G3 and Comodo's AAA Certificate
Services. The step now lists six roots: the three from v1 plus G1, G2 and AAA.

- A root that a JDK vendor removes from `cacerts` after the compromise is deleted too, even when
  no compromised chain we can see ends at it.
- A root is listed even when no base ships it today (G2 and AAA), so the step removes it if a
  base later brings it in. The build fails only if a listed root remains after deletion.
- This replaces the v1 consequence that the step deletes nothing once every base is on Temurin
  21.0.13. Temurin is not known to remove G1, G2 or AAA, so the step can only be dropped once no
  base ships any root in its list.
