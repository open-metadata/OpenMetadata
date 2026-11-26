# SSIS package storage accepts an Azure Blob container, and OSS merges before the Collate connector

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Mayur Singal
- **Guard:** `SsisConnectionClassConverterTest`; Collate `test_ssis.py::test_every_step_in_the_openmetadata_definition_has_a_function`; merge-order review
- **Related:** [OpenMetadata #36832](https://github.com/open-metadata/OpenMetadata/issues/36832), [OpenMetadata #36833](https://github.com/open-metadata/OpenMetadata/pull/36833), [Collate #8105](https://github.com/open-metadata/openmetadata-collate/pull/8105)

## Context

A customer keeps SSIS packages in Azure Blob Storage and does not use AWS. The SSIS connector
lives in Collate, but its connection schema and secret converter live here, so the two
repositories must agree on the `packageConnection` shape.

Test-connection steps are declared in `testConnections/pipeline/ssis.json` here and implemented
by the connector. `test_connection_steps` looks each declared step up with `test_fn[step.name]`,
so a step declared before the connector implements it raises `KeyError` for every SSIS test
connection.

## Decision

SSIS `packageConnection` is `oneOf` `s3Connection | adlsConnection | localProjectsPath`, and
`SsisConnectionClassConverter` lists `ADLSConnection` among its candidates so an Azure client
secret is typed, masked and encrypted.

Merge OSS #36833 before Collate #8105. A step is added to `testConnections/pipeline/ssis.json`
only after the connector that defines its test function has merged; the Azure access step
(`CheckAzureAccess`) therefore lands in a follow-up OSS PR.

## Consequences

Existing S3 and local-path configurations are unchanged and need no migration. Until Collate
#8105 merges, an Azure package connection validates and stores but no connector reads it. Any
future SSIS step follows the same order: connector first, step declaration second. Revisit only
if `test_connection_steps` stops failing on an undeclared function.
