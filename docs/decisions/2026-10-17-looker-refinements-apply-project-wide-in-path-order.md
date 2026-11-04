# The Looker bulk parser applies view refinements project-wide, in file path order

- **Status:** Accepted
- **Revisions:** v1 2026-10-17 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_looker_bulk_parser_refinements.py`
- **Related:** issue #35684

## Context
A LookML refinement (`view: +orders { ... }`) changes the `orders` view in every model that includes
the refinement's file, and refinements apply in include order. `BulkLkmlParser` reads the repository
once, project-wide, with no model scope and no include graph. It stored each refinement as a separate
`+orders` view and only read `*.view.lkml` files, so refinements were never applied and each one was
ingested as its own data model. Resolving refinements per model would mean following each model's
includes, which the parser does not do.

## Decision
- Refinements are read from every `*.lkml` file. Base views are still read only from `*.view.lkml`.
- Files are read in sorted path order. Refinements are applied after every reader is parsed: in
  reader order, then path order, then top to bottom within a file. A later refinement overrides an
  earlier one.
- A refinement overrides the parameters it sets and keeps the rest. `extends` and field `filters`
  are appended, as Looker documents.
- A refinement whose view is not defined is dropped. Refinements in files under `imported_projects/`
  are skipped, because local wildcard includes never reach imported projects.

## Consequences
Each view is ingested once, with every refinement in the repository applied, whichever model
includes it. A model that does not include a refinement still gets it. Of two models that refine the
same parameter differently, both get the last one in path order. `final: yes` is not enforced.
Refinements in an imported project that the local project includes explicitly (`//project/...`) are
not applied. To revisit this, the parser would have to resolve includes per model.
