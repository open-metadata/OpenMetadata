# ODCS imports use one pipeline and profile-owned legacy normalization

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** ODCSImportPipelineTest; ODCSVersionedImportTest; ODCSCrossVersionRoundTripTest; DataContractResourceIT#testVersionedODCSImportMatrix
- **Related:** [#37450](https://github.com/open-metadata/OpenMetadata/pull/37450); ADR:2026-11-09-odcs-imports-validate-declared-published-profiles

## Context

Import already selected a version adapter, but the common compatibility helper also selected
behavior by checking version-string prefixes. Version resolution, published-schema validation,
historical-field validation and native projection were spread across that helper and the service.

## Decision

`ODCSProfiles.resolve` validates the document envelope and selects an `ODCSProfile` containing
the exact version, its pinned published schema and its adapter. `ODCSImportService` owns the
import sequence. `ODCSPublishedSchemaValidator` validates the original document first. A valid
published document bypasses legacy repairs. An invalid document goes through the selected adapter's
`normalizeLegacy` method and is validated again against the same unchanged published schema.

The v2.2, v3.0 and v3.1 adapter implementations explicitly select their applicable shared
compatibility transformations. The shared helper contains no version dispatch. v3.0 alone repairs
the historical team-object representation into its published team array. v3 profiles project
root quality declarations for validation while retaining their original scopes for native conversion.

`ODCSLegacyQualityValidator` validates fields before normalization consumes or encapsulates them.
It derives column-reference validation and legacy rule validation from the existing reader schema.
`ODCSNativeContractConverter` adapts the validated representation into the existing common reader
and retains the canonical document used by metadata preservation.

## Consequences

Adding a profile requires an explicit normalization policy on its adapter. Shared orchestration
and diagnostic categories remain consistent across JSON/YAML import, parse and preview. No
inheritance relationship between published versions is implied, and no schema, storage, endpoint
or accepted-version change is introduced. Existing compatibility transformations and preservation
semantics remain authoritative; the refactor changes their ownership and execution structure.
