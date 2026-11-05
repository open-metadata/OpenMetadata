# ODCS exports use versioned schema-backed mappers

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial) · v2 2026-11-05 (centralized schema provenance and attribution)
- **Deciders:** OpenMetadata maintainers
- **Guard:** ODCSNativeExportTest, ODCSNativeCustomPropertiesTest, ODCSExportServiceTest, scripts/tests/test_generate_odcs_export_models.py
- **Related:** [PR #36877](https://github.com/open-metadata/OpenMetadata/pull/36877), ADR:2026-11-04-odcs-native-exports-follow-published-schema, ADR:2026-11-04-odcs-preserves-unmapped-fields-as-generic-json

## Context

The compatibility reader accepts several historical ODCS shapes. Serializing that reader and
repairing its output required hand-maintained lists of column fields and logical types. Those
lists could drift from the published standard. Native property deletion also cannot be inferred
from whether a property definition exists: an imported value may never have been applied.

## Decision

Each supported export version has an explicit OM-to-ODCS mapper and an export-only model derived
from its pinned official schema. Initially the export profile is v3.1.0; existing imports remain
compatible with their accepted versions. The optional `odcsVersion` query parameter selects a
supported profile and rejects unknown versions.

The upstream schema is copied unchanged with its source and checksum. A deterministic projection
exposes inherited and conditional fields to the existing model generators and suppresses annotation
defaults that would otherwise invent data. Normal `make generate`, Maven builds, and TypeScript
generation prepare this projection automatically; no separate ODCS generation command is required.
The unchanged official schema validates the complete document after preserved metadata is restored.
An incompatible preserved field produces an export error with validation locations; stored metadata
is retained for correction or a future compatible profile.

Generic preserved JSON stays independent of these models. Native values take precedence. Registered
root custom properties are imported only when the normal OM property validator accepts their values;
unknown or rejected values remain preserved and are reported. Generic binding metadata records which
source values actually acquired native ownership. Only those values are omitted after native deletion.
Reimporting a source collection replaces its old ownership bindings; unrelated metadata merges keep them.

## Consequences

Upstream field additions require regeneration rather than new preservation lists. A new export
version still requires a deliberate semantic mapper and tests: generated types cannot decide how an
OM type, owner, or quality test should be represented. Explicit mappers keep those decisions visible
at the cost of some version-specific duplication.

The projection is a generator compatibility layer, not a second validator. Conditional constraints
remain authoritative in the pinned upstream schema, so generation success alone is insufficient.
Builds now require Python 3 for this dependency-free preparation step, including Maven and TypeScript
generation. Pinning means reproducible offline builds, but upstream updates are intentional changes
rather than automatic network downloads.

Final validation can reject legacy preserved documents that previous exports emitted without checking.
This favors a valid advertised export format over silently discarding source metadata. It does not
change the permissive import reader or expose opaque preserved fields as editable native OM fields.

## Amendment — schema provenance and attribution (v2)

The pinned v3.1.0 schema is copied unchanged from
[Bitol's versioned source](https://github.com/bitol-io/open-data-contract-standard/blob/v3.1.0/schema/odcs-json-schema-v3.1.0.json).
Its SHA-256 is `2cb7dd6fe43344d2233e0406438622681dc3ebadcf8f0d606a15b40c8f6752c0`.
The version directory contains only `schema.json`. Source provenance lives here; attribution lives
in the repository `NOTICE`. The specification artifact packages the shared root `LICENSE` and
`NOTICE` under `META-INF`, avoiding per-version copies of the same Apache-2.0 license.
