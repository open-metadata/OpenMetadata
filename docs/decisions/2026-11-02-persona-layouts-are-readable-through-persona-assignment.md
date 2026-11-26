# A persona's UI layout is readable by every user the persona is assigned to

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DocStoreResourceIT#personaLayoutIsReadableThroughPersonaAssignment`, `PersonaLayoutDocumentTest`
- **Related:** #36082

## Context
A persona's UI customization (navigation, page layouts, app mode) is stored as the document
`persona.<personaFqn>`. The UI reads it with `GET /v1/docStore/name/persona.<personaFqn>` for the
user's selected or default persona, and that read required `ViewBasic` on `document`. A user whose
policies grant no document access got a 403. The UI then fell back to the stock navigation and
landing page without telling anyone, while the persona editor kept showing the saved layout, so the
customization looked saved but never applied. The only workaround was to grant `ViewBasic` on all
documents.

## Decision
- On `GET /v1/docStore/name/{name}`, a document whose FQN is exactly `persona.<personaFqn>` (two FQN
  parts) is returned without a document policy check when that persona is assigned to the caller:
  directly, through a team, or as their default persona, which falls back to the system default
  persona. This is `SubjectContext.hasPersona`, the rule the persona's AI context is read under
  (`PersonaContextAccess`).
- The assignment is the grant, so a `Deny` on documents does not hide the caller's own persona
  layout.
- Everything else keeps the policy check: the layout of a persona the caller does not hold, every
  other document, and the by-id, list, version and write endpoints.

## Consequences
- Persona customization applies to users with no document access, and admins no longer grant
  `ViewBasic` on all documents to make it work.
- A persona's layout is exactly as private as that persona's assignments. Document policies cannot
  restrict it for anyone who holds the persona. Who may hold or assign a persona is decided where
  assignments are written, not here. Restricting layouts on their own would need a dedicated
  operation on personas and a new record.
- A layout is UI configuration. The data its widgets show is still fetched under the reader's own
  permissions.
- Only the by-name read the UI uses is covered; a client reading a layout by id still needs
  document access.
