# Document extraction keeps no personal data, like chat capture

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryExtractorTest`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

Chat capture never saves personal data or credentials. Document extraction had no such rule: a
document listing an escalation contact became an Approved memory carrying the person's name, phone
and email, readable by everyone who could read the file.

## Decision

Automatic extraction follows the same rule whatever the source. The extraction prompt forbids
names, email addresses, phone numbers and other contact details of a person, and credentials,
tokens, keys and connection strings, and asks for the role or team instead. A provider that
replaces the prompt (Collate's extraction agent) must carry the same rule.

## Consequences

Contact details stay in the document, not in memories. A memory can still say which team or role
handles something.
