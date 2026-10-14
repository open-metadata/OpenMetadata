# Classic settings forms reuse the AI-mode core form when one exists

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-antd-imports-are-frozen-by-eslint-suppressions, ADR:2026-10-11-migrated-antd-components-adopt-core-styling, open-metadata/OpenMetadata#35285

## Context
Several classic settings pages (access-control rules, field value boosts, the permission
debugger, custom properties, learning resources) had an antd form while AI mode already had a
`@openmetadata/ui-core-components` version of the same form with the same payload. Migrating the
classic copy to core in place would leave two core forms for one entity, with fields,
validation and payload mapping that drift apart over time.

## Decision
When a classic form migrates off antd and AI mode already has a core version of that form, the
classic page renders the shared AI component and the antd copy is deleted. If the AI form is
embedded in an AI-only page shell, its fields and payload mapping are extracted into a shared
component, hook or `*.utils.ts` that both pages use (for example `CustomPropertyFormFields`,
`useLearningResourceFields`). A second core copy of the form is not written.

## Consequences
One place to change a form's fields, validation and payload, at the cost of classic pages
taking the AI form's layout. Classic-only behaviour (a doc side panel, a drawer shell) stays in
the classic page around the shared fields. Revisit if classic and AI forms are meant to diverge
for the same entity.
