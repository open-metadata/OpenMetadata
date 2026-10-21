# Playwright specs that write an intake form run only in the single-worker IntakeForm project

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** #35416; merge-queue flakes on #35338 and #32840

## Context
Intake forms are global, one per entityType. While a form with a `required: true` field is
enabled, every create of that entity type fails with
`400 Missing required field(s) per intake form '<type>'`. `IntakeForm.spec.ts` already ran in its
own project for this reason, but `ProfileGovernance.spec.ts` › "Intake Forms CRUD" did not. It ran
in the parallel `chromium` lane, and its required `dataProduct` field failed
`DataProduct.create()` in `RestoreEntityInheritedFields.spec.ts`.

## Decision
Any Playwright spec that creates, edits or enables an intake form is listed in the `IntakeForm`
project's `testMatch` in `playwright.config.ts` (`fullyParallel: false`, `workers: 1`) and in
`chromium`'s `testIgnore`. The planner routes that project to the single-worker `global-state` lane.

## Consequences
Intake-form specs never overlap each other or any other spec, so they may leave a required field
enabled between their own steps. Adding a spec that writes intake forms means touching both
lists. The nightly AUT does not read this config: it copies its own overlay
(`openmetadata-nightly/automate-upgrade-tests/scripts/k8s/playwright.config.ts`, `INTAKE_FORM_SPECS`).
That overlay has to list the same specs. Revisit if intake forms become scoped per test (for
example per domain), so specs no longer share one form per entityType.
