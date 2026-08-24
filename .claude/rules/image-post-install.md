---
description: Centralized runtime-image dependency fixes and cleanup
paths: "{ingestion/Dockerfile,ingestion/Dockerfile.ci,ingestion/operators/docker/Dockerfile,ingestion/operators/docker/Dockerfile.ci,ingestion/scripts/image_post_install/**,ingestion/setup.py,ingestion/airflow-constraints-*.txt}"
---

# Runtime image post-install conventions

Use dependency metadata first: when a fixed release exists, set the minimum in `ingestion/setup.py`
and update every applicable constraint. Do not use a Dockerfile `pip install` to override it.

Runtime mutations that cannot be represented by dependency metadata belong in
`ingestion/scripts/image_post_install/`. Release-image Dockerfiles copy that directory and invoke
only `apply.sh` after their final ingestion-extra install. Build-tool-only cleanup may follow;
never copy or call a leaf script directly.

Temporary upstream workarounds must guard the exact version they handle and fail when it changes.
The failure must tell the maintainer to verify the new artifact, set the dependency floor, and
remove the workaround. Persistent optimizations must be identified as such and preserve a working
runtime when cleanup cannot be proven safe.

Test observable effects: package-absent no-op, version-guard failure, runtime artifact selection,
and safe cleanup. Update the directory README when adding or removing a step.
