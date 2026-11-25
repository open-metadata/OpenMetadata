# Deleting a user removes only their suggestions, and only on a hard delete

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `TaskResourceIT` (`testSoftDeletingCreatorKeepsTheirTasks`,
  `testHardDeletingCreatorRemovesOnlyTheirSuggestions`,
  `testDeletingBotCreatorCleansUpOpenSuggestionTasks`)
- **Related:** #35962, #17988, #25894

## Context
When a user is deleted, the tasks they created have to be dealt with. #17988 removed the user's
suggestions so nobody would keep reviewing one from a user who no longer exists. The task redesign
(#25894) widened that to every `MetadataUpdate` task, and the cleanup ran on soft deletes too. A
soft delete is the normal offboarding action and can be undone, yet it permanently removed the
user's description, tag, owner, tier and domain requests along with their suggestions, and a
restore brought none of them back (#35962).

## Decision
- A soft delete keeps every task the user created. They stay readable and actionable, and the user
  is still their creator after a restore.
- A hard delete removes the user's `Suggestion` tasks, whatever their status, as #17988 did. Every
  other task the user created stays and can still be resolved without its creator.
- Deleting a bot hard-deletes its user, so the bot's suggestions go with it.

## Consequences
A user's requests are work for their assignees, not for the requester, so they survive the requester
leaving. Widening the cleanup to another task type needs a reason that type, like a suggestion,
cannot be acted on once its creator is gone. The cleanup still deletes rows directly, so a removed
suggestion leaves its relationships, versions and workflow instance behind.
