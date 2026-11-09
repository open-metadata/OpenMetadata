# A Sigma workbook's latest version is a number dashboard custom property

- **Status:** Accepted
- **Revisions:** v1 2026-11-07 (initial)
- **Deciders:** Sigma connector maintainers (PR #37300)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py`
  (`test_the_workbook_version_is_patched_onto_its_dashboard`,
  `test_a_latest_version_property_of_another_type_is_left_alone`,
  `test_no_workbook_version_is_set_without_custom_properties`,
  `test_a_failed_registration_sets_no_version_and_is_not_retried`, `test_a_registered_latest_version_property_is_reused`)
- **Related:** ADR:2026-11-02-run-changing-dashboard-custom-properties-are-patched-after-the-dashboard, PR #37300

## Context

A Sigma workbook's `latestVersion` is its most recently published version, and it changes each time the workbook is
republished. The spec types it as `number` (`double`). A value that changes between runs is patched after the
dashboard, behind `includeCustomProperties`
(ADR:2026-11-02-run-changing-dashboard-custom-properties-are-patched-after-the-dashboard). A custom property definition
applies to every dashboard in the instance, whatever its service, so its name and type are shared with every
connector.

## Decision

- Sigma registers one dashboard custom property, `latestVersion`, of type `number`, because the spec types the value
  as a double. Once per run, when the first workbook with a version is patched, Sigma looks the property up and
  registers it if it is missing.
- An existing `latestVersion` property of type `number` is reused. One of another type is left alone: Sigma sets no
  value, and the run logs a warning.
- A failed registration sets no value for the rest of the run and is not retried in that run.

## Consequences

- The name and the type are a contract. Renaming or retyping the property orphans the values stored under the old
  definition.
- The name is generic. A `latestVersion` property that another connector or a user registered with another type turns
  Sigma's value off until it is removed.
