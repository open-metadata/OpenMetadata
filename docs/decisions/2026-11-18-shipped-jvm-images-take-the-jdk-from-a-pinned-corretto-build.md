# Shipped JVM images take their JDK from a pinned Amazon Corretto build

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** @mohityadav766
- **Guard:** the image build, which fails unless the downloaded tarball matches its pinned SHA-256; `scripts/docker_smoke_test.sh`, which fails while the server's Java runtime is older than 21.0.13.1
- **Related:** ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots

## Context
OpenJDK 21.0.13.1 (November 2026) carries security fixes for the JVM. The server image jlinked its
runtime from `eclipse-temurin:21-jdk` and the k8s operator ran on `eclipse-temurin:21-jre-alpine`,
and Temurin had not published 21.0.13.1. Amazon Corretto 21.0.13.1.2 had: it is built from the
upstream `jdk-21.0.13.1+2` tag, certified against the Java SE TCK, and published for glibc and musl
on x64 and aarch64.

## Decision
- The server and k8s operator images take their JDK from the Corretto tarball for the target
  architecture: glibc for the server, Alpine (musl) for the operator. The build downloads it from
  `corretto.aws`, checks it against the SHA-256 in Corretto's release notes, and jlinks the runtime
  from it as before.
- The version and the checksums live in each Dockerfile's builder stage. Updating the JDK is a
  change to those lines when a new security release ships; nothing updates them on its own.
- Moving to a later Corretto, or back to Temurin, is the same edit to the URL and the checksums.
- The ingestion images keep Debian's JDK package, and CI keeps building on Temurin through
  `actions/setup-java`. Only the JDK these two images ship changes.

## Consequences
- A base image tag no longer brings JDK updates. The next OpenJDK security release (January 2027)
  needs the bump above.
- Corretto links the system zlib, which Temurin bundles, so the runtime base has to ship
  `libz.so.1`. Distroless `base` and Alpine do.
- The trust-store step of ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots runs
  on the Corretto runtime unchanged. Corretto 21.0.13.1.2 ships none of its six roots.
