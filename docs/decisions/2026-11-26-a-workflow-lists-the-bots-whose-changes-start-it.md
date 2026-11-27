# A workflow lists the bots whose changes start it

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Harsha
- **Guard:** `WorkflowTriggeringBotsIT`, `WorkflowEventConsumerTest`
- **Related:** ADR:2026-10-22-agent-glossary-proposals-are-decided-through-the-approval-workflow

## Context

Since 2.1 a bot's change starts no governance workflow and passes the approval gate unheld, so that
ingestion re-syncing source metadata never waits in a review queue or floods Flowable. Some
automation, though, exists to propose governed content for people to review: a scraper creates
glossary terms precisely so that a reviewer approves them before they are used. Writing as a
person instead would make the automation look like a person in the audit trail, and a global switch
would bring every ingestion write back into every workflow.

## Decision

An `eventBasedEntity` trigger lists, in `triggeringBots`, the bots whose changes start it. A
listed bot's change reaches that workflow as a person's change does, in either approval mode: a
Default-mode workflow runs on it, and an Enforce-mode workflow holds it for review. A change by
any other bot starts nothing and is never held, as before. The list is empty by default, so no
stored workflow changes behaviour.

Only a bot an admin created can be listed. Saving a workflow refuses a name that is not a bot, a
system bot (`provider: system`, such as ingestion-bot and governance-bot) and an application's
bot: they write in bulk on their own schedule. An application's bot is stored with
`provider: user`, so it is recognised by the application instead: an installed application links
to it, and every application names its bot `<application name>Bot`. A bot so named for an
installed or marketplace application is refused even without the link, because a bot left behind
by an uninstalled application loses the link and installing the application again reuses it. The
workflow builder's picker hides the same bots. Only names newly added are checked, so a listed bot
deleted later never blocks another edit; it simply starts nothing. Workflow automation, a write by
governance-bot or impersonating as it, never starts a workflow, whatever a list says.

`WorkflowEventConsumer` drops a bot's change before Flowable unless a workflow on that entity type
lists the bot, so an unlisted bot costs no process instance. A listed bot's change carries the bot
in the `triggeringBot` process variable, and each workflow's trigger filter starts the run only if
that workflow lists it. Both read the lists from `GovernanceApprovalRegistry`'s snapshot, which
maps each bot to the user it writes as.

## Consequences

An admin who wants an automation reviewed creates a bot for it and lists the bot on the workflow.
Listing a bot on a workflow for a high-volume entity type starts a trigger process for every
workflow on that type for each of the bot's changes; the other workflows filter it out. Revisit if
a system bot's changes need review, which would need a way to scope them more narrowly than an
entity type.
