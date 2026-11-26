# A core icon or assets/svg file is deleted only after no repository imports it

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Rohit Jain
- **Guard:** reviewer; `yarn tw-guard` blocks new `assets/svg` imports
- **Related:** open-metadata/OpenMetadata#37093, open-metadata/openmetadata-collate#8278, ADR:2026-10-13-core-icons-and-buttons-follow-the-figma-icon-spec

## Context
The UI is moving from `openmetadata-ui/.../assets/svg` files to the generated
`@openmetadata/ui-core-components/icons` set. Collate builds against this repository: collate-ui
and collate-local-webserver import OpenMetadata svgs by path (`openmetadata-ui/src/assets/svg/…`,
`@assets/svg/…`, the `src/openmetadata-ui` mirror) and import core icons by name. Deleting an svg
or a core icon export that Collate still imports breaks the Collate build. Many old svgs also baked
their colour into the file, while core icons draw with `currentColor`, so a straight swap loses the
colour.

## Decision
- An `assets/svg` file or a core icon export is removed only when no code in OpenMetadata,
  collate-ui or collate-local-webserver imports it, counting every path form above. Svgs loaded
  by name at runtime (`*Application.svg` globs, Collate onboarding icons) are never removed this way.
- Collate moves off an icon or svg in a PR that merges no later than the OpenMetadata PR that
  deletes it. A Collate PR built against an unmerged OpenMetadata branch points its `OpenMetadata`
  submodule `branch` at that branch and resets it to `main` before merging.
- Svgs used only as image URLs for brand or service logos (`getServiceTypeLogo`,
  `ServiceIconUtils`, plugin logos) stay svgs.
- When an old svg baked in a colour, the replacement core icon gets that colour as a `className`
  where it renders. Shared lookups return the class next to the icon
  (`getStatusBadgeClassName`, `STATUS_ICON_CLASS`, `getDimensionIconClassName`,
  `getTaskStatusIconClassName`). The `color` and `fill` props are not used for this.

## Consequences
Deleting an svg or icon needs a search of both repositories, not just this one. Colour lives at
the call site, so the same icon can be tinted differently per surface and follows dark mode
through `utility-*` tokens. To revisit this, Collate would have to stop importing OpenMetadata
assets by path, or the two repositories would have to release together.
