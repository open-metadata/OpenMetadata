# Unit tests default to four pytest-xdist workers

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Pablo Takara
- **Guard:** `ingestion/tests/unit/test_python_tooling.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/36338

## Context

Automatic CPU-based worker counts can overwhelm a developer machine because each Python worker
duplicates imports and memory. A predictable default should leave capacity for other local work.

## Decision

The Nox `unit-tests` session defaults to four workers with `--dist loadfile`, shared by Make and
direct Nox commands. Explicit pytest arguments override it: `-n 2` reduces resource use, `-n 0`
disables workers, and `-n auto` requests CPU-based selection. CI may also select its own count.

## Consequences

Four is a practical cap, not a measured optimum for every machine. Larger runners may finish
faster with more workers; memory-constrained machines should select fewer. Revisit the default
when measured suite durations or memory use justify changing it.
