# Model generators own their prepared schema workspaces

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** scripts/tests/test_prepare_model_schemas.py, scripts/tests/test_model_generation_workspaces.py, test_odcs_generated_models.py
- **Related:** [PR #36877](https://github.com/open-metadata/OpenMetadata/pull/36877), ADR:2026-11-05-odcs-exports-use-versioned-schema-backed-mappers

## Context

The shared preparation helper originally wrote every language's intermediate schemas under
`openmetadata-spec/target/model-schemas`. Python's existing image build reads schema inputs as
a non-root user and writes generated models under ingestion. The additional write into the
schema module introduced an ownership requirement and Dockerfile changes. Those requirements
came from the output location, rather than from ODCS schema conversion.

## Decision

Keep one preparation implementation, at `openmetadata-spec/scripts/prepare_model_schemas.py`.
The schema module is already copied into both ingestion CI images; its scripts directory is
not packaged as a runtime resource. No new Dockerfile copy or ownership instruction is needed.

Every caller supplies an output directory. Maven uses its existing module build directory.
Python uses a `TemporaryDirectory`, restores its working directory before cleanup, and retains
its existing generated-model destination. Both TypeScript entry points use temporary workspaces
and clean them on exit, including failure. The full TypeScript generator keeps prepared inputs
separate from the conversion tree it enumerates, preventing duplicate generated paths.

The source schemas are read-only inputs. Prepared copies retain relative paths, so references
and generated package names remain stable. Normal Make, Maven and UI commands still perform
preparation automatically.

## Consequences

Intermediate files belong to the process or build that creates them, and independent language
generation does not require another language's build directory to be writable. Temporary
preparation repeats per Python or UI invocation; Maven retains incremental prepared inputs.
The helper still requires Python 3, and the pinned upstream schema remains the runtime validator.
Cache and freshness fingerprints include the helper at its new location.
