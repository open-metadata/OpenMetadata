# ODCS exports use versioned schema-backed mappers

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial) · v2 2026-11-05 (centralized schema provenance and attribution) · v3 2026-11-05 (published historical export profiles) · v4 2026-11-05 (shared build-time model schemas) · v5 2026-11-05 (caller-owned generation workspaces)
- **Deciders:** OpenMetadata maintainers
- **Guard:** ODCSNativeExportTest, ODCSNativeCustomPropertiesTest, ODCSExportServiceTest, scripts/tests/test_generate_odcs_export_models.py, scripts/tests/test_prepare_model_schemas.py
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

## Amendment — published historical export profiles (v3)

The export registry supports exactly `v3.1.0`, `v3.0.2`, `v3.0.1`, `v3.0.0`, `v2.2.2`, and
`v2.2.1`; the default remains `v3.1.0`. The upstream v2.2.0 release has no JSON Schema, so it is
excluded rather than given an invented validation authority. Each generated export model constrains
`apiVersion` to its exact target and describes that profile. This also avoids copying the v2.2.1
upstream schema's v2.3.0 default annotation into the v2.2.1 model; the pinned source is unchanged.
The compatibility import reader remains unchanged; version-specific
import adapters are deferred.

The v3.0 family uses a team array, legacy library rule names, and the older logical type vocabulary.
Timestamp columns map to logical `date`, and time columns to logical `string`, retaining their native
physical types. Stable quality IDs move to custom properties in versions without an ID field.
Native quality rules requiring parameters or assertions the old library/SQL shapes
cannot express become custom rules with their OpenMetadata test definition and parameters. Source
rule metadata is retained in that implementation. Rules with no native executable mapping retain an
explicit `odcs` custom payload; export does not promise an older external tool can execute it.

The v2.2 family maps IDs to `uuid`, owners to `stakeholders`, and table/column schemas to
`dataset`/`columns`. Nested columns flatten to qualified paths, quoting literal dots in names to
preserve identity. Quality declarations move to table-level quality with column references, tool and
template identifiers, and their complete source rule in custom properties. SLA column references use
`column`. Nullability is explicit because the legacy `isNullable` default is the inverse of the
newer `required` default. Open extension fields permitted by those published schemas retain metadata such as primitive
array element types and native custom properties. Older consumers may ignore these extension fields;
validation guarantees schema conformance, not identical feature support across versions.

The native v3.1 export model provides shared conversion facts. Family adapters serialize through
their own generated model and expose a preservation view using canonical identities before restoring
the target representation. This avoids duplicating native mappings and prevents reordering or version
field aliases from moving metadata to another column. Model generation respects open object policies
in historical schemas. Native collections also take precedence over incompatible saved container
shapes; the original source remains preserved in the payload. Final validation still uses each unmodified upstream document; incompatible
preserved metadata produces an error rather than being discarded. A redundant physical name equal to
the column name needs no separate field in v3.0.0/v3.0.1; a distinct unsupported name is reported.

Published schemas pinned for these additional profiles:

| Profile | Upstream source | SHA-256 |
| --- | --- | --- |
| `v3.0.2` | [Tagged schema](https://github.com/bitol-io/open-data-contract-standard/blob/v3.0.2/schema/odcs-json-schema-v3.0.2.json) | `fc9d774ea73d13b473a52868eb8e66784f3a031794d1d22dd94d76f8c9c07c79` |
| `v3.0.1` | [Tagged schema](https://github.com/bitol-io/open-data-contract-standard/blob/v3.0.1/schema/odcs-json-schema-v3.0.1.json) | `346408469a760b4a484f7ad3d7c6779de810b93761c8c11d3d7111f323273cc6` |
| `v3.0.0` | [Tagged schema](https://github.com/bitol-io/open-data-contract-standard/blob/v3.0.0/schema/odcs-json-schema-v3.0.0.json) | `421d1bbcead745784d91c3f198f45aaea536fbadbceb83f3bbfa5b4ad1305922` |
| `v2.2.2` | [Tagged schema](https://github.com/bitol-io/open-data-contract-standard/blob/v2.2.2/schema/odcs-json-schema.json) | `a17f0d2ffa06deac2f3d1becd9828a0bb3e006a4bf9a189195dcef6786ad85d4` |
| `v2.2.1` | [Tagged schema](https://github.com/bitol-io/open-data-contract-standard/blob/v2.2.1/schema/odcs-json-schema.json) | `c44695489e24d9c33b367e904916b14418443f81e5c5e290ac5f945d2544cc82` |

## Amendment — shared build-time model schemas (v4)

Only the unchanged upstream ODCS schemas are checked in. `scripts/prepare_model_schemas.py`
copies the OpenMetadata schema tree and derives the ODCS model inputs under
`openmetadata-spec/target/model-schemas/`, preserving their relative paths and model names.
Java, Python, and both TypeScript generation entry points prepare and consume this tree independently;
Python and TypeScript do not require a preceding Maven build. The adaptation remains necessary for
the current generators' handling of composed fields and annotation defaults, but its output is a
build artifact rather than a second committed schema set.

Preparation preserves unchanged file timestamps, replaces changed files atomically, and removes
obsolete schema inputs so subsequent generators do not read deleted definitions or export profiles.
`--check` verifies the prepared tree without writing it. Model freshness hashes the checked-in sources
and preparation script rather than the disposable tree. Runtime export validation continues to load
the unchanged upstream schemas from `odcs/<version>/schema.json`.

## Amendment — caller-owned preparation workspaces (v5)

ADR:2026-11-05-model-generators-own-prepared-schema-workspaces supersedes the shared output
location in v4. The helper moves to `openmetadata-spec/scripts/prepare_model_schemas.py`,
requires an explicit output directory, and remains one implementation used by all three languages.
Maven retains its own target directory; Python and TypeScript own temporary workspaces. Existing
ingestion image copy instructions include the helper, so both CI Dockerfiles match the base branch.
