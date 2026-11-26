# Data contract refresh frequency supports whole minutes

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** DataContractResourceIT, ContractSlaValidatorTest, ODCSSlaMapperTest, ODCSQualityRuleMapperTest
- **Related:** [#30584](https://github.com/open-metadata/OpenMetadata/issues/30584), ADR:2026-11-09-odcs-imports-validate-declared-published-profiles

## Context

A contract can require data to be fresher than one hour. Its refresh interval is an integer in
native models and must round-trip through the UI and the supported ODCS profiles.

## Decision

Extend the native refresh frequency unit enum with the singular string `minute`. Any present
native refresh frequency interval across all units must be an exact signed 32-bit integer so
fractional numbers are rejected rather than truncated, while missing or null intervals remain
readable for legacy non-minute units and are rejected for `minute`. The UI requires a positive
whole number (minimum 1) for every refresh frequency unit. The ODCS freshness metric keeps its
existing positive interval requirement and follows the native enum for units. Declared ODCS
freshness retains precedence over freshness inferred from a quality rule.

The evaluator measures elapsed minutes from the last observed refresh to the existing validation
time. An observation exactly at the cutoff meets the requirement. Validation scheduling is
independent of the selected interval.

## Consequences

The extra unit leaves previously stored units valid. Older clients that use the native enum need
an upgrade before reading new minute-valued contracts, including historical versions.
