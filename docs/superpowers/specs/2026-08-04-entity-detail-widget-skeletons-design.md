# Entity Detail Widget Skeletons Design

## Goal

Replace circular loaders inside entity-detail widgets with skeletons that match each widget's existing footprint and content shape across every supported entity detail page.

## Scope

The change applies only to loading states rendered inside individual widgets in entity-detail grids, including common metadata widgets such as description, owners, domains, data products, tags, glossary terms, and entity-specific widgets such as table or topic schema.

Whole-page loaders and whole-tab loaders remain unchanged. The change does not alter when data or lazy component chunks are fetched.

## Architecture

Keep each widget's existing loading condition and Suspense boundary. Replace only its circular-loader fallback with a shared entity-detail widget skeleton component.

The shared component accepts a visual variant appropriate to the widget:

- `text` for description and other prose-oriented widgets.
- `list` for compact metadata collections such as domains, data products, owners, tags, and glossary terms.
- `table` for schemas and other row-oriented entity widgets.

The skeleton fills the widget container already reserved by the detail-page grid. Variant-specific rows and blocks approximate the loaded widget without introducing new loading state, context, or fetch behavior.

Common widget fallbacks use the shared component so all entity types receive the same behavior. Entity-specific widget loaders use the same component with the matching variant. Existing loaders outside widget rendering continue using the current circular indicator.

## Behavior

- A loading widget retains its configured width and height.
- Skeleton animation communicates progress without causing layout shift.
- Skeleton markup exposes a stable test identifier and an accessible loading state.
- Empty, error, permission, and loaded states are unchanged.
- Version views and customized entity-detail layouts receive the same widget-level behavior.

## Testing

Add focused component tests that first fail against the circular-loader behavior and then verify:

- Common metadata widgets render the expected skeleton variant while loading.
- Schema and other row-oriented widgets render the table skeleton variant.
- Skeletons occupy the widget container instead of collapsing it.
- Existing full-page and whole-tab fallbacks still render the circular loader.
- Loaded widget content, empty states, and error states are unaffected.

Run the focused Jest tests, UI checkstyle sequence for changed files, TypeScript validation appropriate to the affected UI package, and `git diff --check`.
