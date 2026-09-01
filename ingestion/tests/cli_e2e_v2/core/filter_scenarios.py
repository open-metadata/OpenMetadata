#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared filter scenario matrix for per-connector `test_filter` parametrization.

`FilterScenario.filter_kwargs` references only common-baseline table/schema
names so it is portable across all SQL connectors. Per-connector expected-
table lists are not portable and must be provided by each connector's test module.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FilterScenario:
    """One row in the filter-parametrize matrix.

    `variant` is appended to the service name to isolate per-variant OM services.
    `filter_kwargs` are passed directly to `WorkflowConfig.with_filter`.
    """

    variant: str
    id: str
    filter_kwargs: dict[str, list[str]] = field(default_factory=dict)


def expected_tables_for(
    scenario: FilterScenario,
    mapping: dict[str, list[str] | None],
    *,
    connector: str,
) -> list[str] | None:
    """Look up `scenario.variant` in `mapping`; raises `AssertionError` naming the missing variant if absent."""
    try:
        return mapping[scenario.variant]
    except KeyError as exc:
        raise AssertionError(
            f"[{connector}] no expected_tables entry for filter scenario "
            f"{scenario.variant!r} (pytest id: {scenario.id}). Add it to "
            f"the connector's _EXPECTED_TABLES_BY_VARIANT mapping."
        ) from exc


# Ordered by increasing complexity; an earlier failure points to a more fundamental issue.
COMMON_FILTER_SCENARIOS: tuple[FilterScenario, ...] = (
    FilterScenario(
        variant="inc_exact",
        id="tables_include_exact",
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_include": ["customers"],
        },
    ),
    FilterScenario(
        variant="exc_exact",
        id="tables_exclude_exact",
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_exclude": ["transactions"],
        },
    ),
    FilterScenario(
        variant="sch_inc",
        id="schemas_include_only_e2e",
        filter_kwargs={"schemas_include": ["e2e"]},
    ),
    FilterScenario(
        variant="regex_prio",
        id="regex_exclude_has_priority_over_include",
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_include": ["customer.*"],
            "tables_exclude": ["customer_txn.*"],
        },
    ),
)
