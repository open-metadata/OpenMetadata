# The AI-mode service page owns its Insights tab, Agents tab and AutoPilot trigger

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial); v2 2026-11-27 (data assets lead the tabs)
- **Deciders:** karanh37
- **Guard:** `ConnectionServiceDetailsPage.test.tsx` (`insights, agents and AutoPilot` describe
  block), `ServiceAgentsTab.test.tsx`
- **Related:** ADR:2026-10-12-failed-test-connection-and-run-actions

## Context
`ConnectionServiceDetailsPage` (AI mode) shipped with only Data Assets and Connection, on the
assumption that a downstream plugin contributes Insights, Agents and the AutoPilot header button
through `SERVICE_DETAILS_TABS` and `SERVICE_DETAILS_ACTIONS`. Without that plugin, AI mode had no
way to view, edit, run or read the logs of a service's agents, no Insights tab and no AutoPilot
trigger. Classic mode has all three in OSS.

## Decision
- The page renders built-in `insights` (order 30) and `agents` (order 40) tabs, after the data
  assets (20, their secondary asset tabs 21+) and ahead of the connection (50), so the service's
  assets stay the first tab and the default. Insights is skipped where classic skips it, for
  metadata and security services; Agents, as classic, only for admins and the service's owners
  (or their teams) and never for security services. Insights reuses the classic
  `ServiceInsightsTab`.
- The page renders the AutoPilot trigger in its header, gated as classic `DataAssetsHeader` gates
  it, and hides it on a soft-deleted service.
- One page-level hook, `useServiceAgents`, owns the agent lists, the AutoPilot workflow state and
  the trigger, so the Agents tab, its badge, Insights and the header button read one fetch.
- A plugin contribution under `insights` or `agents` in `SERVICE_DETAILS_TABS`, or under
  `trigger-auto-pilot` in `SERVICE_DETAILS_ACTIONS`, is dropped: the page's own wins.
- The parts only a downstream build has are filled through three extension points, read only by
  this page:
  - `service-details.agents.ai-widget` (`AiAgentsWidgetContribution`): the widget listing AI
    agents. Its presence adds the AI sub-tab and is what makes the page fetch the AI automations
    (an endpoint OSS does not serve), as classic gates on `getAgentsTabWidgets()`.
  - `service-details.agents.add-action` (`AddAgentActionContribution`): replaces the default
    add-agent control.
  - `service-details.agents.run-actions` (`AgentRunActionContribution`): an action rendered beside a
    failed or partial run.

## Consequences
OSS AI mode reaches parity with classic for agents, insights and AutoPilot without a plugin, and a
plugin no longer re-fetches the same lists in each contribution. A downstream build that still
contributes these tabs or that action sees them silently dropped and must move to the three slots.
Renaming a slot id or changing its props breaks downstream builds without a compile error, so
change them only together with their consumers.
