# Python artifact stamping preserves locked dependency selections

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ingestion/tests/unit/test_update_version_script.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/36870; ADR:2026-10-27-local-python-environments-use-locked-profiles

## Context

Source builds assign artifact versions before packaging. Updating project metadata alone leaves
the local package version in an adjacent `uv.lock` inconsistent. Replacing unrelated version
assignments also changes dependency metadata that belongs to the selected dependency graph.

## Decision

- Stamp only `[project].version` and, when an adjacent `uv.lock` exists, the matching local
  editable/directory package record in that lock.
- Preserve dependency metadata and third-party lock selections.
- Validate an existing lock before and after stamping with `uv lock --check`.
- Use the public `make update_pyproject_version` command to prepare and select the required
  tooling environment. Propagate updater failures to the caller.

## Consequences

Artifact versions can change while retaining the selected dependency graph. Version stamping
does not perform dependency maintenance: stale dependency inputs fail validation and require a
separate lock update. Projects without an adjacent lock continue to receive project-version
updates.
