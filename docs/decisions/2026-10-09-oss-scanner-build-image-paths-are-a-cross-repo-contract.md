# The OSS Scanner build image's paths, build context and /src layout are a contract with anthropics/oss-scanner

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** reviewer. Nothing in this repository fails when the contract breaks; the OSS Scanner's
  own build fails and emails `security@open-metadata.org`. `tools/check openmetadata` in
  anthropics/oss-scanner reproduces that build locally.
- **Related:** open-metadata/OpenMetadata#34992, anthropics/oss-scanner#91, `docker/olivaw/Dockerfile`

## Context

OpenMetadata is enrolled in Anthropic's OSS Scanner, which scans the project for vulnerabilities and
privately emails each finding to our security contact. The enrolment is
`projects/openmetadata/project.yaml` in anthropics/oss-scanner. That file points at this repository
by path, and the scanner clones `main` and builds what the paths name. Nothing in this repository
refers back to that file, so a rename, a move or a `.dockerignore` change here breaks the enrolment
silently. The only signal is a failure email to the security contact.

## Decision

- **`docker/oss-scanner/Dockerfile` and `docker/oss-scanner/threat_model.md` are read by path** from
  the `dockerfile:` and `threat_model:` keys of that `project.yaml`, on the `main` branch. Moving,
  renaming or deleting either file, or renaming `main`, needs a matching PR to
  anthropics/oss-scanner.
- **The image is built with the repository root as the build context**, as
  `docker build -f docker/oss-scanner/Dockerfile .`. The root `.dockerignore` stays in effect for
  this build, so anything it excludes is missing from the image.
- **The image keeps the checkout, `.git` included, at `/src`.** The scanner then adds its own layer
  (Claude Code, compilers, debuggers) with the distribution's package manager, so the final stage
  stays Debian or Ubuntu based. It audits `/src` as root with `HOME=/root` and no network, which is
  why the build installs the server modules into `/root/.m2` and runs the security unit tests once:
  `-DskipTests` never downloads surefire's JUnit provider, and without it `mvn -o test` fails.
- **The build must finish within the scanner's 45 minutes** (16 CPUs, 64 GB). It takes about
  10 minutes today because only the server modules are built. The UI, the Python ingestion
  framework and the Kubernetes operator are in `/src` as source only.

## Consequences

- An agent auditing the server can compile it and run, or write, its unit tests offline.
- Changing any of the four points above means changing `project.yaml` in anthropics/oss-scanner in
  step and re-running `tools/check openmetadata` there. The JDK base and Maven pins follow
  `docker/olivaw/Dockerfile`.
- Scanning the UI or the ingestion framework in depth would mean building them here too. That costs
  build time and image size against the 45-minute limit, so it is a new decision, not an edit.
