# Shipped JVM images run on Amazon Corretto

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** @mohityadav766
- **Guard:** `scripts/docker_smoke_test.sh`, which fails while the server's Java runtime is older than 21.0.13.1; `reviewer` for the CA list
- **Related:** ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots

## Context
OpenJDK 21.0.13.1 (November 2026) carries security fixes for the JVM. The server image jlinked its
runtime from `eclipse-temurin:21-jdk` and the k8s operator ran on `eclipse-temurin:21-jre-alpine`,
and Temurin had not published 21.0.13.1. Amazon Corretto 21.0.13.1.2 had, as the official
`amazoncorretto` images.

## Decision
- The server image jlinks its runtime in `amazoncorretto:21-al2-generic`, Corretto's generic
  Linux build. Only the runtime leaves that stage. Not `amazoncorretto:21`: that is Amazon Linux
  2023's own build, which links system freetype, libjpeg and libpng that distroless does not ship.
- The k8s operator jlinks its runtime in `amazoncorretto:21-alpine`.
- Both trust the CA list Corretto ships, as it ships it: OpenJDK's roots plus Amazon's own. Nothing
  is copied over it.
- The tags float, as Temurin's did: a rebuild picks up Corretto's next release. The smoke test
  fails while the runtime is older than 21.0.13.1.
- Moving back to Temurin reverses the `FROM` and `COPY --from` lines.

## Consequences
- The trusted roots change from Temurin's list, which is Mozilla's, to Corretto's.
  - 32 newer roots that Mozilla trusts are not in Corretto's list, among them D-TRUST 2020/2023,
    HARICA 2021, Telekom Security, TrustAsia, SECOM 2024 and Telia v3. Those vendors' older roots
    are in it. A server endpoint whose chain ends only at one of the 32 needs a custom truststore.
  - Corretto's list keeps older roots that Mozilla dropped. The JDK's
    `jdk.security.caDistrustPolicies` still rejects new TLS certificates from the Symantec, Entrust,
    Camerfirma and Chunghwa roots among them.
- Corretto's list holds none of the six roots of
  ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots, so that step deletes nothing
  and only checks.
- Corretto links the system zlib, which Temurin bundles, so the runtime base has to ship
  `libz.so.1`. Distroless `base` and Alpine do.
- CI keeps building on Temurin through `actions/setup-java`, and the ingestion images keep Debian's
  JDK package.
