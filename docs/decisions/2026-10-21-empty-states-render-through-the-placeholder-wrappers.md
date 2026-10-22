# UI empty states render through the EmptyPlaceholder wrappers, never core EmptyPlaceholder directly

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** shah-harshit
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#35730, open-metadata/openmetadata-collate#7571

## Context
The legacy `ErrorPlaceHolder` family was replaced by the core `EmptyPlaceholder`. Pages then
rendered the core component directly in about 150 files, each restating its icon, title, variant
and copy. Changing how an empty state looks or reads meant editing every page, and the copies had
already drifted (missing icons, default text stacked over a page's own message).

## Decision
Every empty, no-results, no-access, error and onboarding state in `openmetadata-ui` renders through
a wrapper in `src/components/common/EmptyPlaceholder/`: `NoDataPlaceholder`,
`NoSearchResultsPlaceholder`, `NoFilteredResultsPlaceholder`, `PermissionPlaceholder`,
`SomethingWentWrongPlaceholder`, `CreatePlaceholder`, or `FeaturesPlaceholder` for the onboarding
`features` variant. Only those wrappers import the core `EmptyPlaceholder`.

Wrapper defaults fill only what the caller leaves blank: a caller title drops the default
description, and a page's own message replaces the default "No data available." rather than
stacking under it.

This is a deliberate exception to the AGENTS.md rule against wrappers that only pass props to a
core component. `FeaturesPlaceholder` adds no behaviour today; it exists so all empty states share
one entry point that can change in one place.

## Consequences
A new empty state picks the wrapper that matches its intent, and a change to empty-state icons,
copy or layout is made once in the wrapper folder. A page needing a look no wrapper covers adds or
extends a wrapper rather than importing the core component. Revisit if the wrappers grow
page-specific options that would be clearer as direct core usage.
