# A module is published to Maven Central only when it opts in with a marker file

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** sonika-shah
- **Guard:** the `published-module-needs-published-parent` enforcer rule in the root `pom.xml` (fails the build when a published module's parent is not published); `reviewer` for adding a marker
- **Related:** `.github/workflows/publish-maven-package.yml`, `.github/workflows/docker-k8s-operator.yml`

## Context
The root pom used to publish every module in the reactor, so each new module reached Maven Central
by default. A release grew to about 670 MB, most of it artifacts no Maven consumer uses: the
Kubernetes operator's Spring Boot jar, the UI jar together with a sources jar that repeats the
built UI, and the Java client's `jar-with-dependencies`. Maven Central now limits each publishing
organization's monthly release size, file count and release count, so every unneeded artifact
counts against a shared budget. OpenMetadata's own builds, its Docker images and the downstream
distributions all build these modules from source; they do not resolve them from Central.

## Decision
- The root pom sets `skipPublishing=true` (read by `central-publishing-maven-plugin`). A module is
  published only when its folder contains a `.publish-to-maven-central` file, which activates the
  `publish-to-maven-central` profile and sets `skipPublishing=false`. This applies to releases and
  to SNAPSHOTs alike.
- A published module's parent pom must be published too, or the jar cannot be resolved. The
  enforcer rule in that profile fails the build otherwise; the repository root, which has no
  parent, is recognised by its `.github` folder.
- Today's published modules: the root (`platform`), `common`, `openmetadata-spec`,
  `openmetadata-sdk`, `openmetadata-clients`, `openmetadata-java-client`,
  `openmetadata-shaded-deps` and its `elasticsearch-deps` / `opensearch-deps`, and
  `openmetadata-service`.
- Extra artifacts inside a published module are not covered by the marker: the Java client's
  `jar-with-dependencies` is built but not attached.
- `maven.deploy.skip` does not stop this plugin and must not be relied on.

## Consequences
- A new module stays off Maven Central until someone adds its marker, which is visible in review.
- Removing a module from Central is deleting its marker; versions already on Central remain.
- The rule checks module membership, not size: an artifact attached to a published module (a
  classifier jar) still needs a reviewer to catch it.
- Workflows that resolve an unpublished module from Central break, so build it in the same job
  (`docker-k8s-operator.yml` installs its upstream modules before testing).
