# Intake forms are deprecated and are removed in the next release

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Harsha (product), Anuj Kumar (UI)
- **Guard:** `IntakeFormDesignerModal.test.tsx`, `GovernancePanel.test.tsx` (Deprecated badge in
  the classic designer and the AI-mode headers)
- **Related:** #37573, ADR:2026-10-14-intake-form-specs-run-in-the-single-worker-intakeform-project

## Context
Intake forms let an admin mark optional fields as required for Data Products, Domains, Glossary
Terms and Metrics, enforced at the API and in the create forms. Playbooks and Lifecycle workflows
now cover the same need, and keeping two ways to enforce required fields confuses users.

## Decision
- Intake forms (the `IntakeForm` entity, `/v1/governance/intakeForms` API and the settings UI) are
  deprecated as of this release and removed in the next one.
- Until removal they keep working: existing intake forms are still enforced at the API layer.
- The API marks every intake-form operation `deprecated` in the OpenAPI spec. The UI shows the
  shared *Deprecated* badge (`DeprecatedFeatureBadge`, as on Column Bulk Operations) in the Intake
  Forms headers only (the classic settings page and designer, and the AI-mode Governance panel);
  no banner repeats it.

## Consequences
The removal release deletes the entity, API, UI, intake-form validation in the governance-entity
repositories, and the `IntakeForm` Playwright project, which retires
ADR:2026-10-14-intake-form-specs-run-in-the-single-worker-intakeform-project. It also needs a
migration that drops the intake-form table. Admins relying on intake forms must move the rules to
Playbooks or Lifecycle workflows before upgrading to that release.
