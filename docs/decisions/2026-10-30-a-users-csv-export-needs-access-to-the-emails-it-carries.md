# A users CSV export needs access to the emails it carries

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `UserResourceIT.test_usersExportNeedsAccessToEmails`
- **Related:** open-metadata/openmetadata-collate#7797

## Context
A users CSV lists each member of a team with their email in the clear. Reads of a user mask the
email for anyone but an admin or a bot (`PIIMasker.maskUser`), but exporting needed only ViewAll on
users, which the default policies give every user.

## Decision
- Exporting users, synchronously or as a job, needs `authorizePII` with no owner: an admin or a bot.
  Everyone else gets 403.
- The file is not masked for other callers instead. A users CSV is meant to be imported again, and
  an import writes the email column, so a masked file would overwrite each member's email with the
  mask.

## Consequences
A non-admin who could export users before, through ViewAll on users, now gets 403.
