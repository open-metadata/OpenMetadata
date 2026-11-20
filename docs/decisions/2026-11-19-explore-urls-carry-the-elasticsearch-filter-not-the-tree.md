# Explore URLs carry the Advanced Search as its Elasticsearch filter, not the builder tree

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `exploreQueryFilterRoundTrip.test.ts` (every field and operator of every Explore tab,
  and every group shape the modal builds, reads back from the URL as the same filter and groups);
  `exploreLinks.test.ts` (View in Explore, Curated Assets, Persona AI Context and Data Insight
  links open Explore on the filter the screen applied, with the screen's rules shown)
- **Related:** HTTP 431 on Explore with an 8-rule Advanced Search

## Context
Explore kept its Advanced Search in `?queryFilter=` as the react-awesome-query-builder tree: ids,
paths, `asyncListValues` and widget state per rule, about 780 bytes a rule once encoded. Every API
call sends the page URL back as `Referer`, and Jetty counts the request line and all headers
against `maxRequestHeaderSize` (8 KiB by default). Eight rules were enough to fail search with
HTTP 431. Other screens built their Explore links the same way, from their own builder's tree.

## Decision
- `queryFilter` holds `{ "query": <Elasticsearch query> }` in Explore's own shape: a root
  `bool` of one `must` (AND) or `should` (OR) over groups, each group a `bool` of one `must` or
  `should` over its rules — what the modal writes.
- A link from another screen wraps its builder's filter as one group under an AND root
  (`getExploreQueryFilterParam`), so Explore shows that builder's rules as they were. A filter
  the link has scoped to an entity type goes in `quickFilter`, not in the group.
- Explore rebuilds the tree from the filter on load (`getExploreJsonTreeFromQueryFilter`), after
  custom properties have loaded, and searches with the filter that tree writes back — so the
  reader has to return exactly what was written. A custom-property rule is read under the entity
  type its `entityType` term names: several entity types can declare the same property name.
- A `queryFilter` holding a tree (`type: "group"`) stays a supported input: links written before
  this, and Collate's links until they move to this format, still open.

## Consequences
The param is about a seventh of the tree's size. Every field and operator the builders offer must
read back from its Elasticsearch clause: a new operator or field type needs its reader, and the
guards fail until it has one. A
`timeInterval` property's `end` bound under `is_null`/`is_not_null` reopens as its `start` (the
same filter). The Advanced Search can show a root over groups and nothing deeper; revisit if the
modal gains nested groups. Links into Explore from Collate should move to this format
(`getExploreQueryFilterParam`).
