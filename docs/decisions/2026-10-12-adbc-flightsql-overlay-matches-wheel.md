# The ADBC Flight SQL native overlay must match its Python wheel

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** The image install step checks the wheel version and loads the rebuilt library;
  the builder checks its embedded Go and module versions.
- **Related:** [#35231](https://github.com/open-metadata/OpenMetadata/issues/35231),
  [#35232](https://github.com/open-metadata/OpenMetadata/pull/35232)

## Context

The published `adbc-driver-flightsql` 1.12.0 wheel includes a native library built with vulnerable
Go dependencies. Rebuilding that library from the matching `apache-arrow-adbc-24` source with
patched dependencies lets the IOMETE connector retain its Python 1.12.0 API. CI images install
this checkout's `setup.py`, but production images install a published `openmetadata-ingestion`
release whose dependency metadata does not contain this checkout's pin. An unconstrained
production build could select a later wheel that is incompatible with the 1.12.0 overlay.

## Decision

- Build the native library from `apache-arrow-adbc-24`, verify the source archive checksum, and
  require the patched Go and module versions in its build metadata.
- Pin `adbc-driver-flightsql==1.12.0` in `ingestion/setup.py` for source builds. Constrain the
  published ingestion package's dependency resolution to the same wheel version in both
  production Dockerfiles. The constraint applies to all ingestion extras install steps and does
  not install Flight SQL when the selected extras do not require it.
- Overlay the rebuilt library only after the final `pip install` in each image. The install step
  requires wheel version 1.12.0 and loads the replacement library; an unexpected wheel version
  fails the build rather than assuming a newer release has fixed the vulnerabilities.

## Consequences

The source tag, Python wheel pin, embedded driver version, and install check must change together.
The native rebuild adds a Docker build stage until an upstream wheel is verified to contain the
patched dependencies. When that happens, remove the overlay and its pins in one change, then
rescan the resulting production images.
