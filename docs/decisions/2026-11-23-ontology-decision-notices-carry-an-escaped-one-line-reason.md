# Ontology decision notices carry the reviewer's reason as escaped one-line text

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `OntologyDecisionNoticeTest`
- **Related:** #38467, #38468, #38233, open-metadata/openmetadata-collate#8872

## Context
`OntologyDecisionNotice` writes the Inbox activity entry that tells an author a reviewer approved or
rejected their ontology release. The entry's `summary` is rich text: the Inbox and the activity feed
card render it with `RichTextEditorPreviewerV1`. Since #38233 the task Reject dialog is a rich text
editor, so the reviewer's comment arrives as HTML. Appended as-is, `<p>…</p>` put the reason on a
line of its own after a dangling colon, and the 300-character cut could split a tag.

## Decision
The reason in the summary is the comment's text content (jsoup body-fragment `text()`: tags dropped,
entities decoded, whitespace collapsed to single spaces), HTML-escaped, then truncated to 300
characters. The cut backs off before an entity it would split, so the escaped reason never grows
past the limit and never ends in a stray `&l`. A comment with no text content adds no reason. Readers render the summary as rich
text, so the escaped reason displays as the reviewer typed it, `<Customer>` included, on the same
line as the decision.

## Consequences
The summary stays one line and cannot carry markup from the comment. A reader that shows the summary
as plain text would see `&lt;` for `<`; none does today. Entries written between #38233 and this
change keep their HTML reason and are not migrated: the Inbox Activity tab shows only recent events.
