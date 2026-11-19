# A Suggestion task's form schema is chosen by its stamped schema id, then by its `suggestionType`

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `TaskFormSchemaUtils.test.ts` (`getResolvedTaskFormSchema`, `getSuggestionSchemaName`), `playwright/e2e/Features/Tasks/TaskSuggestionForm.spec.ts`, `playwright/e2e/Features/Tasks/TagSuggestionTask.spec.ts`
- **Related:** open-metadata/openmetadata-collate#8554, #38033, #38061, #38073

This record documents, after the fact, the resolution order introduced by #38061. #38073 added it
because #38061 merged without one, and #38073 depends on the same order.

## Context

Both suggestion form schemas, `DescriptionSuggestion` and `TagSuggestion`, have `taskType: Suggestion` and
`taskCategory: MetadataUpdate`. The UI used to resolve a task's form schema by taskType+taskCategory
with `limit: 1`. That always returned `DescriptionSuggestion`, so a Tag suggestion rendered its JSON
tag list as a "Suggested Description".

## Decision

`getResolvedTaskFormSchema` (in `utils/TaskFormSchemaUtils.ts`) resolves a task's form schema in this
order:

1. **`task.taskFormSchemaId`.** This is the id the backend stamps on the task
   (`TaskFormSchemaRepository#resolve`). The UI fetches that schema by id.
2. **For a `Suggestion` task, its `payload.suggestionType`.** `getSuggestionSchemaName` in
   `rest/taskFormSchemasAPI.ts` maps it to a schema name, case-insensitively: `description` →
   `DescriptionSuggestion`, `tag` → `TagSuggestion`. This map must stay in step with the backend's
   `TaskFormSchemaRepository#mapSuggestionTypeToSchema`.
3. **Otherwise**, the taskType+taskCategory lookup, and then the built-in defaults.

The cache key includes the schema id and the suggestionType, so one variant's schema is never reused
for another.

A suggestion schema's `suggestedValue` keeps the type the schema declares. For tags it is a JSON
string: the `tagSelector` widget reads that string and writes it back as JSON. The server validates
the resolve payload against the schema and rejects an array.

## Consequences

- A new `suggestionType` needs a seeded schema, an entry in the backend's `mapSuggestionTypeToSchema`,
  and the same entry in `getSuggestionSchemaName`. Otherwise its tasks fall back to the
  type+category lookup and render the wrong form.
- A schema that a task's stamped id no longer points to (deleted or replaced) falls through to steps
  2 and 3; it does not break the task view.
- Revisit if the list API gains a filter that can tell suggestion schemas apart.
