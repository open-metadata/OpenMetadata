# Tag and classification names follow the entityName schema in the UI

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `regex.constants.test.ts`, `TagsForm.test.tsx`, `tagFormFields.test.tsx`, `EntityNameModal.test.tsx` (`openmetadata-ui/src/main/resources/ui/src/`)
- **Related:** Issue #37908, PR #37932

## Context

`createTag.json` and `createClassification.json` take `name` from
`basic.json#/definitions/entityName`: 1 to 256 characters, with no `::`, `>`, `"` or ASCII control
characters. The UI still validated tag and classification names against an older
`TAG_NAME_REGEX` (letters, digits, `_ - . & ( )` and spaces) and `NAME_LENGTH_REGEX` (2 to 64
characters), and the rename modal capped names at 128. So the UI refused names the server accepts,
such as `ABC:DEF:SC:C`, `PII/Email`, a one-letter code, or anything over 64 characters.

## Decision

UI validation of tag and classification names mirrors `entityName`. `TAG_NAME_REGEX` is
`entityName`'s pattern with a non-empty quantifier, and the length limit is 1 to `MAX_NAME_LENGTH`
(256). The create and edit form (`getNameField`) and the tag rename modal (`getTagRenameRules`)
both apply it. The form also rejects a whitespace-only name, which the server pattern accepts.

`TAG_NAME_REGEX` and `NAME_LENGTH_REGEX` stay exported from `regex.constants.ts` because
`openmetadata-collate` imports them, although nothing in this repository uses
`NAME_LENGTH_REGEX` any more.

## Consequences

The UI accepts every name the server does, except a whitespace-only one. Names can now contain
`/`, `?`, `#`, `%` and `:`, so every REST path and route built from a tag or classification FQN has
to URI-encode it, as `getTagByFqn` and `getTagsDetailsPath` do. Narrowing `TAG_NAME_REGEX` again, or
deleting either export, needs a coordinated change in `openmetadata-collate`. Revisit if the
`entityName` schema changes.
