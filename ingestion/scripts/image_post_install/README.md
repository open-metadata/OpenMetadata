# Runtime image post-install steps

This directory owns package mutations that run after the final ingestion-extra install that can
replace their target packages. Build-tool-only cleanup may follow. Dockerfiles copy the directory
and invoke only `apply.sh`; package-specific behavior stays in focused leaf scripts.

Prefer a dependency floor in `ingestion/setup.py` and the applicable constraints file whenever a
fixed package exists. Add a leaf script here only when version metadata cannot express the required
runtime state, such as replacing a wheel-bundled native library or pruning foreign-platform files.

Temporary overrides must:

- pin the upstream version they were designed for;
- fail when that version changes, forcing review and cleanup;
- verify the installed runtime artifact, not only command success;
- explain the removal path in their failure message.

Persistent optimizations must fail safely: an unsuccessful cleanup may leave a larger image, but
must not remove the runtime artifact for the current platform.

Current steps:

- `install_flightsql_registry_override.sh` replaces the `1.12.0` Python wheel's bundled driver with
  the signed FlightSQL `1.12.1` registry artifact. Remove it when a verified PyPI wheel contains the
  fixed driver.
- `prune_teradatasql_platform_libs.sh` keeps the current platform and FIPS libraries while removing
  bundled libraries the image cannot load. This is a persistent image-size optimization.

When adding or removing a step, update `apply.sh`, its behavioral tests, and this README together.
