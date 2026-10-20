# An alert source offers only the recipients delivery reaches

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `CapabilitiesIT.everyRecipientASourceOffersIsOneDeliveryReaches` (every catalog offer
  is reached), `RecipientReachTest` (what each category reaches)
- **Related:** #20504, PR #33970, PR #35782, ADR:2026-10-20-alert-forms-read-only-the-capabilities-answer

## Context
The alert catalog lists, for each source, the recipients inside the platform an alert on it may
be sent to; `POST /v1/events/subscriptions/capabilities` offers them in the form. The lists came
from the table the form held before, and several offered someone delivery can never find. A task
has no owners field, an announcement and a glossary term have no followers, and a user has
neither, so an alert on those sources with such a recipient sent nothing. Delivery decides who a
category reaches in its recipient resolvers, which nothing compared with the catalog.

## Decision
- Every recipient category declares which entity types it can reach:
  `RecipientResolutionStrategy.reaches(entityType)`, asked through `RecipientResolver.reaches`.
  A strategy that does not reach a type resolves no one for it, without looking anything up.
  - Users, Teams, Admins and External are named by the destination: they reach every event.
  - Owners and Followers reach a conversation, through the entity it is about, and any entity type
    whose schema holds the field. An entity type the server does not know is not judged.
  - Assignees reach a task; Mentions a conversation, an announcement or a task.
- A source's name is the entity type of its events, as event matching reads it.
- A source offers only recipients that `reaches` accepts for it. The catalog lists them explicitly
  where its default does not fit.
- Recipients stay offered, never enforced on save: a saved alert keeps a recipient it already has.

## Consequences
The form never offers a recipient that cannot receive anything, and a change to what a resolver
or an entity schema holds is caught by the guard before a release. Saved alerts that already
chose such a recipient, including alerts from 2.0, keep it and keep reaching no one; making a
task's owners mean the owners of what it is about, or an announcement's followers the followers
of what it is on, is a separate decision. A new category must say what it reaches before it can
be offered.
