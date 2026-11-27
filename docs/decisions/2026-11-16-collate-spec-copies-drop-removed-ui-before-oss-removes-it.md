# A Collate spec copy drops its assertions on removed UI before OSS removes the UI

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** UI team
- **Guard:** merge-order review; Collate `ui-coverage-tests` and Playwright CI fail if the order is reversed
- **Related:** [OpenMetadata #37828](https://github.com/open-metadata/OpenMetadata/pull/37828), [Collate #8573](https://github.com/open-metadata/openmetadata-collate/pull/8573), ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate

## Context

`OntologyNativeDataMode.spec.ts` moved to Collate with the Ontology Studio UI. It asserts the table
page's Linked concepts section (`table-linked-concepts` and the
`/ontologyConcepts/boundTo/table/...` response). Product removed that section: concept bindings are
no longer shown on the table page and are viewed and edited only in Ontology Studio's Data mode.
Collate CI builds against OpenMetadata `main`, not the pinned submodule, so once OSS removes the UI
every Collate run that still asserts it fails.

## Decision

When an OpenMetadata PR removes UI that a Collate-owned Playwright spec or Jest test asserts, the
Collate PR that drops those assertions merges first and the OSS PR second. This is the reverse of
the OSS-first order in ADR:2026-10-10-alert-widgets-use-values-and-oss-merges-before-collate and
ADR:2026-11-02-ssis-package-storage-accepts-adls-and-oss-merges-before-collate, which govern
*adding* something Collate consumes; removal goes Collate first.

`GET /ontologyConcepts/boundTo/{type}/{id}` stays, with no OSS UI consumer.

## Consequences

The Collate PR is green against current `main` because it only deletes assertions. For a short
window Collate no longer tests a section OSS still renders. Revisit if Collate CI starts pinning
OpenMetadata to the submodule commit instead of `main`.
