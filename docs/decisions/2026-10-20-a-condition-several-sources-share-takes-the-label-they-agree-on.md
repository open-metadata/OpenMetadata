# A condition several sources share takes the label they agree on

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `SourceCapabilitiesTest` (shared labels, single-source labels, order), `SeveralSourcesTest`
  (the saved rule's label), `CapabilitiesIT.filterTheSourcesNameDifferentlyHasItsGeneralName`
- **Related:** #20504, PR #33970, PR #35782

## Context
The alert catalog defines each filter and trigger once, with a general label (`filterByFqn` is
"Entity FQN"), and lets a source rename one for its own assets: a pipeline calls it "Pipeline
Name", an ingestion pipeline "Ingestion Pipeline Name". An alert on several sources used the
first picked source's copy, both in `POST /v1/events/subscriptions/capabilities` and in the rules
the save stores. The name filter of a Pipeline and Ingestion Pipeline alert read "Pipeline Name",
or "Ingestion Pipeline Name" when picked the other way round, although it matches both kinds of
asset.

## Decision
- A filter or trigger shared by several sources carries the `displayName` and `description` that
  all of them give it. A source that does not rename it counts as giving the catalog's own label.
  When they disagree, it carries the catalog's own label.
- One source keeps its own label, as before.
- The sources are read in name order: a shared condition lists in the order the first source by
  name lists it, and every `sources` list is in name order. The answer does not depend on the
  order the user picked the sources in.
- `SharedConditions` is the only place that decides a shared label, for the capabilities answer
  and for the save alike.
- The text of the stored grouped trigger rule keeps the order the sources were saved in: it is
  read only by evaluation, where the order of its branches changes nothing.

## Consequences
A label is never wrong for some of the sources it applies to. A saved alert gets the new label the
next time it is saved; no form reads the stored label, so nothing needs migrating. A new source
that renames a shared condition makes that condition show its general label whenever it is
combined with a source that names it differently, so the general label must read well on its own.
