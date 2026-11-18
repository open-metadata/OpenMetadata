# A Suggestion task's form schema is the one named `<suggestionType>Suggestion`

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `TaskFormSchemaUtils.test.ts` (`getTaskFormSchemaName`), `playwright/e2e/Features/Tasks/TagSuggestionTask.spec.ts`
- **Related:** open-metadata/openmetadata-collate#8554, #38073

## Context

Every suggestion form schema (`DescriptionSuggestion`, `TagSuggestion`) has `taskType: Suggestion` and
`taskCategory: MetadataUpdate`. The UI used to resolve a task's form schema by taskType+taskCategory
with `limit: 1`. That always returned `DescriptionSuggestion`, so a Tag suggestion rendered its JSON
tag list as a "Suggested Description".

## Decision

The UI resolves a `Suggestion` task's form schema by name, `GET /taskFormSchemas/name/<payload.suggestionType>Suggestion`
(`getTaskFormSchemaName` in `utils/TaskFormSchemaUtils.ts`). It never uses taskType+taskCategory
for Suggestion tasks. Every other task type still resolves by taskType+taskCategory.

## Consequences

- A new `suggestionType` must seed a TaskFormSchema named `<suggestionType>Suggestion` under
  `openmetadata-service/src/main/resources/json/data/taskFormSchemas/`.
- Renaming a seeded suggestion schema breaks this lookup. When the lookup fails, the UI falls back
  to the type's built-in default form.
- A widget on a suggestion schema writes `suggestedValue` back in the type the schema declares (a
  JSON string for tags). The server validates the resolve payload against that schema.
- Revisit if suggestion schemas gain a distinguishing field the list API can filter on.
