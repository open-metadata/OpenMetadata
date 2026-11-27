# dbt source metadata fills existing schemas on an opt-in workflow

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Contributors for #38832
- **Guard:** `test_dbt_schema_metadata.py` and `DatabaseSchemaResourceIT#conditionalIngestionPatchPreservesServerCertificationDates`
- **Related:** [#38832](https://github.com/open-metadata/OpenMetadata/issues/38832)

## Context

Existing manifests can contain declarations in `source_meta`, while OpenMetadata only applies table-level `meta` during dbt ingestion. Applying old declarations as part of an upgrade would change catalog data in already-configured jobs.

## Decision

`includeSchemaMetadata` defaults to false. An enabled run reads source declarations from active manifest sources that pass the existing filters. A uniquely bound table supplies the schema reference. With no such binding, an exact FQN in the configured service can select an existing schema. A mapping takes priority over the original catalog name. An ambiguous table match skips that declaration.

Collect declarations across the run before writing any schema. Preserve directly assigned ownership, domains, tiers, and certifications. Apply ownership only when `dbtUpdateOwners` is set. Add glossary terms and update only validated custom property keys explicitly supplied by the sources. Where declarations disagree about a field or property, skip that field or property and report the conflict.

Send one version-conditional patch per changed schema. After a stale version response, read the current entity and recompute the change before retrying. The server supplies certification dates. If the bot cannot read certification settings, a fully qualified tag can be validated by the schema API.

## Consequences

Disabling the option stops future schema writes. Schemas written by an earlier run retain their metadata. Operators can inspect schema versions to review those changes.
