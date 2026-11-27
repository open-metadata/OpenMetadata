# A persona's entity header is an ordered list of property ids on its page

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `EntityHeaderProperties.utils.test.ts`, `CustomizeEntityHeader.spec.ts`
- **Related:** #19518

## Context
Which metadata matters in an entity header differs by organization and by persona. The header drew a
fixed set (Domains, Owners, Tier, Certification, Retention Period, then entity-specific read-only
facts), and custom properties were only reachable on their own tab. Personas already store a `Page`
per entity type in their document store entry, so the header choice belongs there too.

## Decision
- `Page.entityHeader` (`system/ui/page.json`) holds `properties`, an ordered array of property ids,
  and `showEmptyProperties` (default `true`). Unset means the page type's default header: its
  standard properties in their built-in order, no custom properties.
- A standard property id is a `HeaderPropertyId` value (`owners`, `tier`, …); a custom property id
  is `extension.<propertyName>`. Ids are stored, not labels, so renaming a label never breaks a
  saved header; renaming an id does, so ids are never renamed.
- Ids the entity type does not have are skipped when drawing, not removed from the saved list, so a
  custom property that is still loading, or one re-created under the same name, keeps its place.
- An empty read-only property never shows. An empty editable one shows only while
  `showEmptyProperties` is on.
- A header equal to the page type's default is stored as unset, so Reset puts the persona back on
  the default and later default properties reach it. Applying an unchanged header changes nothing.
- The customize panel is a `Popover` from the Customize Header button, docked to the viewport's
  top-right corner at full height, not the `SlideoutMenu` drawer: the design asks for a floating
  panel over the page, the way the prompt input's menus open, and `SlideoutMenu` is a flush,
  full-height drawer.
- The header shows the first five shown properties and puts the rest behind "Show N more"
  (ADR:2026-11-27-entity-header-shows-five-properties-behind-show-more).

## Consequences
The customize page and the entity page must build the same property catalog for a type, or a
property missing from the panel is silently dropped from every header saved there. A new header
property needs a new `HeaderPropertyId`; it stays out of personas that saved a header before it
existed until they pin it. Changing the collapse count moves properties in and out of view on every
page, so revisit it only together with the design.
