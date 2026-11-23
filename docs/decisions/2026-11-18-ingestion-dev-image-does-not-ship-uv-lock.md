# The ingestion dev image does not ship ingestion/uv.lock

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `ingestion/operators/docker/Dockerfile.ci` fails the build when `uv.lock` is present
  after `COPY ingestion/ .`
- **Related:** #37748, #37858, ADR:2026-10-23-ingestion-images-pin-python-security-packages-in-tree

## Context

`Dockerfile.ci` builds the dev ingestion image, and downstream images are built `FROM` it. It copied
the whole `ingestion/` directory, so `/ingestion/uv.lock` shipped in the image.

The lockfile supports Python 3.10. The fixed releases of dnspython (2.9.x), tornado (6.6) and
filelock (4.x) need Python 3.11 or newer, so the lockfile also keeps an older entry of each with
the resolution marker `python_full_version < '3.11'`. Image scanners such as AWS Inspector read
`uv.lock` as an inventory and ignore resolution markers. They reported those 3.10-only entries as
installed vulnerabilities, although the image runs Python 3.12 and installs ingestion with `pip`,
which never reads the lockfile. Images built without a lockfile (the 2.0 branch has none) showed
no such rows.

## Decision

- `ingestion/operators/docker/Dockerfile.ci.dockerignore` excludes `ingestion/uv.lock` from the
  build context. BuildKit uses that file instead of the root `.dockerignore` for this Dockerfile
  only, so it repeats the root entries. The root `.dockerignore` is unchanged, because other
  images, such as the OSS Scanner image (ADR:2026-10-09-oss-scanner-build-image-paths-are-a-cross-repo-contract),
  keep the full checkout.
- `Dockerfile.ci` fails the build if `uv.lock` is present after the copy. This catches a build
  that ignores the file, such as the legacy builder.

## Consequences

- The scanner rows for the 3.10-only lockfile entries disappear. Scanners still report every
  package that is actually installed.
- The image cannot install from the lockfile (`uv sync --frozen`). Doing that would need this
  record revisited, and the dev image would then pin Python 3.12 entries only.
- Revisit when ingestion drops Python 3.10, because the lockfile then has no 3.10-only entries.
