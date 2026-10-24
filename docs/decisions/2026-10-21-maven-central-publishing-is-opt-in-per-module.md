# Only an explicit list of modules is published to Maven Central

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** sonika-shah
- **Guard:** `reviewer` — the module list in `.github/workflows/publish-maven-package.yml`
- **Related:** `.github/workflows/publish-maven-package.yml`, `.github/workflows/docker-k8s-operator.yml`

## Context
The root pom used to publish every reactor module, so each new module reached Maven Central by
default. A release grew to about 670 MB, most of it artifacts no Maven consumer uses: the
Kubernetes operator's Spring Boot jar, the UI jar together with a sources jar that repeats the
built UI, and the Java client's `jar-with-dependencies`. Maven Central now limits each publishing
organization's monthly release size, file count and release count, so every unneeded artifact
counts against a shared budget. OpenMetadata's own builds, its Docker images and the downstream
distributions all build these modules from source; they do not resolve them from Central.

## Decision
- The root pom sets `skipPublishing=true` (read by `central-publishing-maven-plugin`), so a plain
  `mvn deploy` publishes nothing.
- `publish-maven-package.yml` is the only place that publishes. It deploys an explicit list with
  `-pl` and passes `-DskipPublishing=false`, which overrides the pom default for those modules.
  This applies to releases and to SNAPSHOTs alike.
- The list: the root (`platform`), `common`, `openmetadata-spec`, `openmetadata-sdk`,
  `openmetadata-clients`, `openmetadata-java-client`. These are what the Java SDK and the Java
  client need to resolve; the client is regenerated each release from the server's API spec, so it
  is published every release.
- `openmetadata-service` and its search jars (`openmetadata-shaded-deps`, `elasticsearch-deps`,
  `opensearch-deps`) are not published: the server is built from source everywhere it runs, and
  the SDK and client do not depend on them. The publish job still builds the service (`install`,
  never `deploy`) first, because the Java client is generated from the `swagger.json` that the
  service's compile writes.
- A published module's parent pom must be in the list too (`openmetadata-clients` for the Java
  client, the root for everything), or the jar cannot be resolved.
- Extra artifacts inside a published module are not controlled by the list: the Java client's
  `jar-with-dependencies` is built but not attached.
- The `-sources.jar` and `-javadoc.jar` that Maven Central requires are placeholders holding only
  `docs/maven-central-placeholder/README.md` (built by the root `release` profile). Central accepts
  placeholders, and the real ones were most of the remaining release size. Source is on GitHub at
  the version tag, and the REST API reference is each server's `/docs` page.
- `maven.deploy.skip` does not stop this plugin and must not be relied on.

## Consequences
- A new module stays off Maven Central until it is added to the list, which is visible in review.
- Removing a module from Central is removing it from the list; versions already on Central remain.
- Each release branch carries its own copy of the workflow, so the list is kept in step on every
  branch that publishes.
- Workflows that resolve an unpublished module from Central break, so build it in the same job
  (`docker-k8s-operator.yml` installs its upstream modules before testing).
